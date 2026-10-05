#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import path from 'node:path';
import { stat } from 'node:fs/promises';
import { watch } from 'node:fs/promises';
import { IndexManager } from '../src/core/IndexManager.js';
import { IndexReader } from '../src/storage/BinaryIndex.js';
import type { IndexSnapshot } from '../src/storage/IndexFormat.js';
import { createDashboardApp, defaultIndexDirectory } from '../src/dashboard/DashboardServer.js';
import { indexGitHubRepository } from '../src/github/GitHubRepositoryIndexer.js';

interface Arguments {
  positionals: string[];
  flags: Set<string>;
  values: Map<string, string[]>;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return;
  }
  const parsed = parseArguments(args);
  const json = parsed.flags.has('--json');

  if (command === 'mcp') {
    const { startCodebaseIndexerMcpServer } = await import('../src/mcp/CodebaseIndexerMcpServer.js');
    await startCodebaseIndexerMcpServer({
      ...(firstValue(parsed, '--index-dir') ? { indexDir: path.resolve(firstValue(parsed, '--index-dir')!) } : {})
    });
    return;
  }

  if (command === 'index-github') {
    const repositorySlug = requiredPositional(parsed, 0, 'index-github requires an owner/repository');
    const repository = parseGitHubRepository(repositorySlug);
    const indexDir = path.resolve(firstValue(parsed, '--index-dir') ?? defaultIndexDirectory());
    const result = await indexGitHubRepository(repository.owner, repository.repository, firstValue(parsed, '--ref') ?? 'HEAD', { indexDir });
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`GitHub repository indexed: ${result.owner}/${result.repository}@${result.ref}`);
      console.log(`Workspace: ${result.workspacePath}`);
      console.log(`Index: ${result.indexPath}`);
      console.log(`Files: ${result.fileCount}; symbols: ${result.symbolCount}; relations: ${result.relationCount}`);
      if (result.errors > 0) console.log(`Indexing errors: ${result.errors}`);
    }
    return;
  }

  if (command === 'dashboard') {
    const indexDirectory = path.resolve(firstValue(parsed, '--index-dir') ?? defaultIndexDirectory());
    const host = firstValue(parsed, '--host') ?? '127.0.0.1';
    const port = parsePort(firstValue(parsed, '--port') ?? '4173');
    const server = createDashboardApp(indexDirectory).listen(port, host);
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    const actualPort = address && typeof address === 'object' ? address.port : port;
    console.log(`Dashboard: http://${host}:${actualPort}`);
    console.log(`Index directory: ${indexDirectory}`);
    return;
  }

  if (command === 'inspect') {
    const indexPath = requiredPositional(parsed, 0, 'inspect requires an index file');
    const resolved = path.resolve(indexPath);
    const [snapshot, fileStats] = await Promise.all([IndexReader.read(resolved), stat(resolved)]);
    printStatus(snapshot, resolved, fileStats.size, json);
    return;
  }

  const workspacePath = path.resolve(firstValue(parsed, '--path') ?? parsed.positionals[0] ?? '.');
  const profile = (firstValue(parsed, '--profile') as 'default' | 'large' | undefined) ?? 'default';
  const workers = firstValue(parsed, '--workers') ? Number(firstValue(parsed, '--workers')) : undefined;
  const memoryLimitMb = firstValue(parsed, '--memory-limit') ? Number(firstValue(parsed, '--memory-limit')) : undefined;
  const noEmbeddings = parsed.flags.has('--no-embeddings');
  const verboseMemory = parsed.flags.has('--verbose-memory');

  const manager = await IndexManager.create({
    workspacePath,
    ...(firstValue(parsed, '--index-dir') ? { indexDir: path.resolve(firstValue(parsed, '--index-dir')!) } : {}),
    ...(firstValue(parsed, '--max-file-size') ? { maxFileSize: parseSize(firstValue(parsed, '--max-file-size')!) } : {}),
    ...(parsed.values.has('--ignore') ? { patterns: parsed.values.get('--ignore')! } : {}),
    ...(workers ? { workers } : {}),
    ...(memoryLimitMb ? { memoryLimitMb } : {}),
    ...(profile ? { profile } : {}),
    noEmbeddings,
    verboseMemory
  });

  switch (command) {
    case 'index': {
      const startTime = Date.now();
      let peakRss = process.memoryUsage().rss;
      const memInterval = setInterval(() => {
        const rss = process.memoryUsage().rss;
        if (rss > peakRss) peakRss = rss;
      }, 100);

      try {
        const result = await manager.index(parsed.flags.has('--force'), (progress) => {
          if (!json && progress.message) {
            console.log(progress.message);
          }
        });
        const duration = (Date.now() - startTime) / 1000;
        if (json) {
          console.log(JSON.stringify({
            uid: manager.uid,
            indexPath: result.indexPath,
            added: result.added,
            changed: result.changed,
            unchanged: result.unchanged,
            deleted: result.deleted,
            errors: result.errors,
            metadata: result.snapshot.metadata,
            durationSeconds: duration,
            peakMemoryMb: Math.round(peakRss / 1024 / 1024)
          }, null, 2));
        } else {
          console.log(`Index updated: ${result.indexPath}`);
          console.log(`Files: ${result.snapshot.metadata.fileCount} (${result.added} added, ${result.changed} changed, ${result.unchanged} unchanged, ${result.deleted} deleted)`);
          console.log(`Duration: ${duration.toFixed(2)}s, Peak Memory: ${Math.round(peakRss / 1024 / 1024)}MB`);
          if (result.errors > 0) console.log(`Scan/Parse errors: ${result.errors}`);
        }
      } finally {
        clearInterval(memInterval);
      }
      return;
    }
    case 'embeddings': {
      const count = await manager.generateEmbeddings(undefined, (progress) => {
        if (!json) console.log(`${progress.stage}: ${progress.message}`);
      });
      if (json) console.log(JSON.stringify({ embeddings: count, indexPath: manager.indexPath }));
      else console.log(`Embeddings generated: ${count} vectors in ${manager.indexPath}`);
      return;
    }
    case 'status': {
      const status = await manager.status();
      if (!status.indexed || !status.snapshot || status.size === undefined) {
        if (json) console.log(JSON.stringify({ indexed: false, workspace: manager.workspacePath }));
        else console.log(`No index found for ${manager.workspacePath}`);
        return;
      }
      if (json) console.log(JSON.stringify({ indexed: true, indexPath: manager.indexPath, size: status.size, ...status.snapshot.metadata }, null, 2));
      else printStatus(status.snapshot, manager.indexPath, status.size, false);
      return;
    }
    case 'watch': {
      console.log(`Watching ${manager.workspacePath}`);
      let timer: NodeJS.Timeout | undefined;
      for await (const _event of watch(manager.workspacePath, { recursive: true })) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          void manager.index().then((result) => {
            if (parsed.flags.has('--verbose')) {
              console.log(`Updated ${result.indexPath}: ${result.added} added, ${result.changed} changed, ${result.deleted} deleted`);
            }
          }).catch((error: unknown) => {
            console.error(error instanceof Error ? error.message : String(error));
          });
        }, 300);
      }
      return;
    }
    case 'files': {
      const snapshot = await manager.read();
      const language = firstValue(parsed, '--language');
      const pattern = firstValue(parsed, '--pattern');
      const files = snapshot.files.filter((file) => (!language || file.language === language) && (!pattern || file.path.includes(pattern)));
      if (json) console.log(JSON.stringify(files, null, 2));
      else for (const file of files) console.log(`${file.path} (${file.language})`);
      return;
    }
    case 'search': {
      const query = parsed.positionals.join(' ');
      if (!query) throw new Error('search requires a query');
      const limit = Number(firstValue(parsed, '--limit') ?? 10);
      const results = parsed.flags.has('--semantic')
        ? await manager.semanticSearch(query, limit)
        : parsed.flags.has('--lexical')
          ? await manager.search(query, limit)
          : await manager.hybridSearch(query, limit);
      if (json) console.log(JSON.stringify(results, null, 2));
      else for (const result of results) console.log(`${result.file.path}  score ${result.score.toFixed(3)}`);
      return;
    }
    case 'symbols':
    case 'references':
    case 'callers':
    case 'callees':
    case 'deps':
    case 'dependents': {
      const name = parsed.positionals.join(' ');
      if (!name) throw new Error(`${command} requires a name`);
      const results = command === 'symbols'
        ? await manager.findSymbol(name)
        : command === 'references'
          ? await manager.findReferences(name)
          : command === 'callers'
            ? await manager.findCallers(name)
            : command === 'callees'
              ? await manager.findCallees(name)
              : command === 'deps'
                ? await manager.findDependencies(name, Number(firstValue(parsed, '--depth') ?? 1))
                : await manager.findDependents(name, Number(firstValue(parsed, '--depth') ?? 1));
      if (json) console.log(JSON.stringify(results, null, 2));
      else for (const result of results) {
        if ('targetName' in result) console.log(`${result.kind} ${result.filePath}:${result.line}  ${result.targetName}`);
        else console.log(`${result.kind} ${result.name}  ${result.filePath}:${result.startLine}`);
      }
      return;
    }
    case 'path': {
      const [from, to] = parsed.positionals;
      if (!from || !to) throw new Error('path requires a source and target symbol name');
      const result = await manager.findPath(from, to, { maxDepth: Number(firstValue(parsed, '--depth') ?? 4), maxNodes: Number(firstValue(parsed, '--max-nodes') ?? 32) });
      if (json) console.log(JSON.stringify(result, null, 2));
      else console.log(result.nodes.join(' -> '));
      return;
    }
    case 'map': {
      const map = await manager.getRepositoryMap();
      if (json) console.log(JSON.stringify(map, null, 2));
      else {
        console.log(`Repository: ${map.root}`);
        for (const area of map.areas) console.log(`${area.kind} ${area.path} (${area.files} files, ${area.symbols} symbols)`);
      }
      return;
    }
    case 'api':
    case 'apis': {
      const endpoints = await manager.findApiEndpoints();
      if (json) console.log(JSON.stringify(endpoints, null, 2));
      else for (const endpoint of endpoints) console.log(`${endpoint.method} ${endpoint.path} ${endpoint.fileId}`);
      return;
    }
    case 'intent': {
      const query = parsed.positionals.join(' ');
      if (!query) throw new Error('intent requires a query');
      const result = await manager.classifyQuery(query);
      if (json) console.log(JSON.stringify(result, null, 2));
      else console.log(`${result.kind} (${result.confidence.toFixed(2)})`);
      return;
    }
    case 'sensitive': {
      const regions = await manager.findSensitiveRegions();
      if (json) console.log(JSON.stringify(regions, null, 2));
      else for (const region of regions) console.log(`${region.filePath}:${region.line} ${region.kind} confidence=${region.confidence}`);
      return;
    }
    case 'impact': {
      const target = parsed.positionals.join(' ');
      if (!target) throw new Error('impact requires a target symbol or file');
      const impact = await manager.analyzeImpact(target);
      if (json) console.log(JSON.stringify(impact, null, 2));
      else {
        console.log(`Impact analysis for ${impact.target}:`);
        console.log(`  Direct dependents: ${impact.directDependents.length}`);
        for (const dep of impact.directDependents) console.log(`    - ${dep.name} (${dep.filePath})`);
        console.log(`  Transitive dependents: ${impact.transitiveDependents.length}`);
        for (const dep of impact.transitiveDependents) console.log(`    - ${dep.name} (${dep.filePath})`);
        console.log(`  Affected APIs: ${impact.affectedApis.join(', ') || 'None'}`);
        console.log(`  Affected Tests: ${impact.affectedTests.join(', ') || 'None'}`);
      }
      return;
    }
    case 'tests': {
      const query = parsed.positionals.join(' ');
      if (!query) throw new Error('tests requires a query');
      const tests = await manager.findTests(query);
      if (json) console.log(JSON.stringify(tests, null, 2));
      else for (const t of tests) console.log(`${t.testFile} -> ${t.targetSymbol ?? t.targetFile ?? ''} (${t.relationship})`);
      return;
    }
    case 'affected-tests': {
      const files = parsed.positionals;
      if (files.length === 0) throw new Error('affected-tests requires one or more changed files');
      const tests = await manager.findAffectedTests(files);
      if (json) console.log(JSON.stringify(tests, null, 2));
      else for (const t of tests) console.log(`${t.testFile} (${t.relationship})`);
      return;
    }
    case 'database': {
      const schema = await manager.getDatabaseSchema();
      if (json) console.log(JSON.stringify(schema, null, 2));
      else for (const model of schema) console.log(`${model.kind.toUpperCase()} ${model.name} (${model.filePath})`);
      return;
    }
    case 'history': {
      const history = await manager.getGitHistory();
      if (json) console.log(JSON.stringify(history, null, 2));
      else {
        console.log(`Git Branch: ${history.branch}`);
        for (const c of history.commits) console.log(`${c.hash} ${c.author} (${c.date}): ${c.subject}`);
      }
      return;
    }
    case 'changes': {
      const changes = await manager.getChanges();
      if (json) console.log(JSON.stringify(changes, null, 2));
      else {
        console.log(`Branch: ${changes.branch}`);
        console.log(`Uncommitted changed files: ${changes.changedFiles.length}`);
        for (const f of changes.changedFiles) console.log(`${f.code} ${f.filePath}`);
      }
      return;
    }
    case 'coupling': {
      const couplings = await manager.getChangeCoupling();
      if (json) console.log(JSON.stringify(couplings, null, 2));
      else for (const c of couplings) console.log(`${c.fileA} <-> ${c.fileB} = ${c.couplingPercentage}%`);
      return;
    }
    case 'complexity': {
      const complexity = await manager.getComplexity();
      if (json) console.log(JSON.stringify(complexity, null, 2));
      else for (const f of complexity) console.log(`${f.filePath} loc=${f.loc} complexity=${f.cyclomaticComplexity}`);
      return;
    }
    case 'hotspots': {
      const hotspots = await manager.getHotspots();
      if (json) console.log(JSON.stringify(hotspots, null, 2));
      else for (const h of hotspots) console.log(`${h.filePath} risk=${h.risk} (${h.explanation})`);
      return;
    }
    case 'duplicates': {
      const duplicates = await manager.getDuplicates();
      if (json) console.log(JSON.stringify(duplicates, null, 2));
      else for (const d of duplicates) console.log(`${d.type} ${d.filePath1}:${d.startLine1} <-> ${d.filePath2}:${d.startLine2}`);
      return;
    }
    case 'explain': {
      const name = parsed.positionals.join(' ');
      if (!name) throw new Error('explain requires a symbol name');
      const explanation = await manager.explainSymbol(name);
      if (json) console.log(JSON.stringify(explanation, null, 2));
      else {
        console.log(`Symbol: ${explanation.symbolName} (${explanation.kind ?? 'unknown'})`);
        if (explanation.definition) console.log(`Definition: ${explanation.definition.filePath}:${explanation.definition.startLine}`);
        console.log(`Exported: ${explanation.isExported}`);
        console.log(`Callers (${explanation.callers.length}): ${explanation.callers.join(', ')}`);
        console.log(`Callees (${explanation.callees.length}): ${explanation.callees.join(', ')}`);
        console.log(`Tests (${explanation.tests.length}): ${explanation.tests.join(', ')}`);
        console.log(`APIs (${explanation.apis.length}): ${explanation.apis.join(', ')}`);
      }
      return;
    }
    case 'cycles': {
      const cycles = await manager.findDependencyCycles();
      if (json) console.log(JSON.stringify(cycles, null, 2));
      else for (const c of cycles) console.log(`${c.id}: ${c.symbols.join(' -> ')}`);
      return;
    }
    case 'remove': {
      if (!parsed.flags.has('--force')) {
        const prompt = createInterface({ input: stdin, output: stdout });
        try {
          const answer = await prompt.question(`Remove index ${manager.indexPath}? [y/N] `);
          if (!/^y(es)?$/i.test(answer.trim())) return;
        } finally {
          prompt.close();
        }
      }
      const removed = await manager.remove();
      if (json) console.log(JSON.stringify({ removed, indexPath: manager.indexPath }));
      else console.log(removed ? `Removed ${manager.indexPath}` : 'No index found');
      return;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function parseArguments(args: string[]): Arguments {
  const positionals: string[] = [];
  const flags = new Set<string>();
  const values = new Map<string, string[]>();
  const valueOptions = new Set(['--index-dir', '--max-file-size', '--ignore', '--language', '--pattern', '--limit', '--path', '--index', '--host', '--port', '--ref', '--depth', '--max-nodes', '--workers', '--memory-limit', '--profile']);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (!arg.startsWith('--')) {
      positionals.push(arg);
    } else if (valueOptions.has(arg)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      values.set(arg, [...(values.get(arg) ?? []), value]);
    } else {
      flags.add(arg);
    }
  }
  return { positionals, flags, values };
}

function printStatus(snapshot: IndexSnapshot, indexPath: string, size: number, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...snapshot.metadata, indexPath, size }, null, 2));
    return;
  }
  console.log(`Workspace: ${snapshot.metadata.workspaceRoot}`);
  console.log(`UID: ${snapshot.metadata.uid}`);
  console.log(`Index: ${indexPath}`);
  console.log(`Indexer version: ${snapshot.metadata.indexerVersion}`);
  console.log(`Last indexed: ${snapshot.metadata.updatedAt}`);
  console.log(`Files: ${snapshot.metadata.fileCount}`);
  console.log(`Symbols: ${snapshot.metadata.symbolCount}`);
  console.log(`Relations: ${snapshot.metadata.relationCount}`);
  console.log(`Chunks: ${snapshot.metadata.chunkCount}`);
  console.log(`Vectors: ${snapshot.metadata.vectorCount}`);
  console.log(`Index size: ${size} bytes`);
}

function requiredPositional(parsed: Arguments, index: number, message: string): string {
  const value = parsed.positionals[index];
  if (!value) throw new Error(message);
  return value;
}

function firstValue(parsed: Arguments, name: string): string | undefined {
  return parsed.values.get(name)?.[0];
}

function parseSize(value: string): number {
  const match = /^(\d+)(kb|mb|gb)?$/i.exec(value);
  if (!match) throw new Error(`Invalid file size: ${value}`);
  const units = { kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
  const unit = match[2]?.toLowerCase() as keyof typeof units | undefined;
  return Number(match[1]) * (unit ? units[unit] : 1);
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid port: ${value}`);
  return port;
}

function parseGitHubRepository(value: string): { owner: string; repository: string } {
  const normalized = value.replace(/^https?:\/\/github\.com\//iu, '').replace(/\.git$/iu, '').replace(/\/$/u, '');
  const parts = normalized.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Expected owner/repository or a GitHub repository URL');
  }
  return { owner: parts[0], repository: parts[1] };
}

function printHelp(): void {
  console.log('codebase-indexer <index|index-github|status|search|symbols|references|callers|callees|deps|dependents|path|cycles|map|api|intent|sensitive|impact|tests|affected-tests|database|history|changes|coupling|complexity|hotspots|duplicates|explain|files|inspect|remove|watch|dashboard|mcp> [path or query] [options]');
  console.log('Options: --index-dir <path> --force --json --max-file-size <size> --ignore <pattern> --host <host> --port <port> --ref <github-ref> --workers <number> --memory-limit <MB> --profile <default|large> --no-embeddings --verbose-memory');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
