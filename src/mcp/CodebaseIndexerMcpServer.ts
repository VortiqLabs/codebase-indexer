import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { IndexManager } from '../core/IndexManager.js';
import { indexGitHubRepository } from '../github/GitHubRepositoryIndexer.js';
import { IndexReader } from '../storage/BinaryIndex.js';
import type { IndexSnapshot } from '../storage/IndexFormat.js';
import { buildRepositoryMap } from '../intelligence/RepositoryMap.js';
import { findDependencyRelations, findSymbolPath, findGraphCycles } from '../intelligence/GraphQuery.js';
import { ContextBuilder } from '../context/ContextBuilder.js';
import { analyzeImpact } from '../intelligence/ImpactAnalyzer.js';
import { findTests, findAffectedTests } from '../intelligence/TestAnalyzer.js';
import { detectApiEndpoints } from '../intelligence/ApiDetector.js';
import { analyzeDatabaseSchema } from '../intelligence/DatabaseAnalyzer.js';
import { getGitHistory } from '../intelligence/GitHistory.js';
import { analyzeChangeCoupling, detectHotspots } from '../intelligence/ChangeAnalyzer.js';
import { analyzeComplexity } from '../intelligence/ComplexityAnalyzer.js';
import { explainSymbol } from '../intelligence/ExplainSymbol.js';

export interface CodebaseIndexerMcpServerOptions {
  indexDir?: string;
  githubToken?: string;
}

interface LoadedIndex {
  snapshot: IndexSnapshot;
  filePath: string;
}

export function createCodebaseIndexerMcpServer(options: CodebaseIndexerMcpServerOptions = {}): McpServer {
  const indexDir = path.resolve(options.indexDir ?? process.env.CODEBASE_INDEX_DIR ?? path.join(os.homedir(), '.cache', 'codebase-indexer'));
  const server = new McpServer({ name: 'codebase-indexer', version: '0.1.0' });

  server.registerTool('list_indexes', {
    description: 'List all valid codebase indexes available in the configured index directory.',
    inputSchema: {}
  }, async () => {
    try {
      const { indexes, errors } = await loadIndexes(indexDir);
      return jsonResult({
        indexes: indexes.map(({ snapshot, filePath }) => ({ indexPath: filePath, metadata: snapshot.metadata })),
        errors
      });
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('search_code', {
    description: 'Search indexed files across all workspaces, or restrict the search to one index UID.',
    inputSchema: {
      query: z.string().min(1),
      indexUid: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional()
    }
  }, async ({ query, indexUid, limit }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      return jsonResult(searchIndexes(indexes, query, indexUid, limit ?? 10));
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('read_indexed_file', {
    description: 'Read a source file that is part of an existing index. Call list_indexes first to get an index UID.',
    inputSchema: {
      indexUid: z.string().regex(/^[a-f\d]{32}$/iu),
      filePath: z.string().min(1)
    }
  }, async ({ indexUid, filePath }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const loaded = indexes.find(({ snapshot }) => snapshot.metadata.uid === indexUid);
      if (!loaded) throw new Error('Index not found');
      return jsonResult(await readIndexedFile(loaded.snapshot, filePath));
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('get_symbol_relations', {
    description: 'Find symbol definitions and their indexed relations, optionally restricted to one index UID.',
    inputSchema: {
      name: z.string().min(1),
      indexUid: z.string().optional()
    }
  }, async ({ name, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const matches = indexes.filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
        .flatMap(({ snapshot }) => symbolRelations(snapshot, name));
      return jsonResult(matches);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('index_local_workspace', {
    description: 'Index or refresh a local workspace directory into the configured index directory.',
    inputSchema: {
      workspacePath: z.string().min(1),
      force: z.boolean().optional()
    }
  }, async ({ workspacePath, force }) => {
    try {
      const manager = await IndexManager.create({ workspacePath: path.resolve(workspacePath), indexDir });
      const result = await manager.index(force ?? false);
      return jsonResult({
        uid: manager.uid,
        indexPath: result.indexPath,
        workspacePath: manager.workspacePath,
        fileCount: result.snapshot.metadata.fileCount,
        symbolCount: result.snapshot.metadata.symbolCount,
        relationCount: result.snapshot.metadata.relationCount,
        chunkCount: result.snapshot.metadata.chunkCount,
        added: result.added,
        changed: result.changed,
        deleted: result.deleted,
        errors: result.errors
      });
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('index_github_repository', {
    description: 'Download and index a public or private GitHub repository. Private access uses GITHUB_TOKEN or GH_TOKEN from the MCP server environment, never a tool argument.',
    inputSchema: {
      owner: z.string().min(1),
      repository: z.string().min(1),
      ref: z.string().optional()
    }
  }, async ({ owner, repository, ref }) => {
    try {
      const result = await indexGitHubRepository(owner, repository, ref ?? 'HEAD', {
        indexDir,
        ...(options.githubToken ? { token: options.githubToken } : {})
      });
      return jsonResult(result);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('get_repository_map', {
    description: 'Get compact repository map containing directory areas, file counts, and key symbols.',
    inputSchema: { indexUid: z.string().optional() }
  }, async ({ indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const targets = indexes.filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid);
      const maps = targets.map(({ snapshot }) => buildRepositoryMap(snapshot));
      return jsonResult(indexUid ? maps[0] : maps);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('find_symbol', {
    description: 'Find matching symbol definitions across indexed workspaces.',
    inputSchema: { name: z.string().min(1), indexUid: z.string().optional() }
  }, async ({ name, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const matches = indexes
        .filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
        .flatMap(({ snapshot }) => snapshot.symbols.filter((s) => s.name.toLowerCase().includes(name.toLowerCase())));
      return jsonResult(matches);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('get_symbol', {
    description: 'Get exact symbol by ID or name.',
    inputSchema: { symbol: z.string().min(1), indexUid: z.string().optional() }
  }, async ({ symbol, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const matches = indexes
        .filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
        .flatMap(({ snapshot }) => snapshot.symbols.filter((s) => s.id === symbol || s.name === symbol));
      return jsonResult(matches);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('find_references', {
    description: 'Find all references to a given target symbol.',
    inputSchema: { name: z.string().min(1), indexUid: z.string().optional() }
  }, async ({ name, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const normalized = name.toLowerCase();
      const references = indexes
        .filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
        .flatMap(({ snapshot }) => snapshot.relations.filter((r) => r.targetName.toLowerCase() === normalized));
      return jsonResult(references);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('find_callers', {
    description: 'Find callers of a given symbol.',
    inputSchema: { name: z.string().min(1), indexUid: z.string().optional() }
  }, async ({ name, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const callers = indexes
        .filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
        .flatMap(({ snapshot }) => {
          const syms = new Set(snapshot.symbols.filter((s) => s.name.toLowerCase() === name.toLowerCase()).map((s) => s.id));
          return snapshot.relations.filter((r) => r.kind === 'calls' && r.toSymbolId && syms.has(r.toSymbolId));
        });
      return jsonResult(callers);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('find_callees', {
    description: 'Find callees invoked by a given symbol.',
    inputSchema: { name: z.string().min(1), indexUid: z.string().optional() }
  }, async ({ name, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const callees = indexes
        .filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
        .flatMap(({ snapshot }) => {
          const syms = new Set(snapshot.symbols.filter((s) => s.name.toLowerCase() === name.toLowerCase()).map((s) => s.id));
          return snapshot.relations.filter((r) => r.kind === 'calls' && r.fromSymbolId && syms.has(r.fromSymbolId));
        });
      return jsonResult(callees);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('find_implementations', {
    description: 'Find class/trait implementations or extensions for a symbol.',
    inputSchema: { name: z.string().min(1), indexUid: z.string().optional() }
  }, async ({ name, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const implementations = indexes
        .filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
        .flatMap(({ snapshot }) =>
          snapshot.relations.filter((r) => (r.kind === 'implements' || r.kind === 'extends') && r.targetName.toLowerCase() === name.toLowerCase())
        );
      return jsonResult(implementations);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('get_dependencies', {
    description: 'Get dependencies for a file or symbol.',
    inputSchema: { query: z.string().min(1), depth: z.number().int().min(1).max(5).optional(), indexUid: z.string().optional() }
  }, async ({ query, depth, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const deps = indexes
        .filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
        .flatMap(({ snapshot }) => findDependencyRelations(snapshot, query, false, depth ?? 1));
      return jsonResult(deps);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('get_dependents', {
    description: 'Get reverse dependents for a file or symbol.',
    inputSchema: { query: z.string().min(1), depth: z.number().int().min(1).max(5).optional(), indexUid: z.string().optional() }
  }, async ({ query, depth, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const dependents = indexes
        .filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
        .flatMap(({ snapshot }) => findDependencyRelations(snapshot, query, true, depth ?? 1));
      return jsonResult(dependents);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('find_dependency_path', {
    description: 'Find call or dependency path between two symbols.',
    inputSchema: { from: z.string().min(1), to: z.string().min(1), indexUid: z.string().optional() }
  }, async ({ from, to, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const target = indexes.find(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid);
      if (!target) throw new Error('Index not found');
      return jsonResult(findSymbolPath(target.snapshot, from, to));
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('find_dependency_cycles', {
    description: 'Detect dependency cycles in the symbol graph.',
    inputSchema: { indexUid: z.string().optional() }
  }, async ({ indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const cycles = indexes
        .filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
        .flatMap(({ snapshot }) => findGraphCycles(snapshot));
      return jsonResult(cycles);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('build_context', {
    description: 'Build prompt context within a token/character budget for AI agents.',
    inputSchema: { query: z.string().min(1), budget: z.number().int().optional(), indexUid: z.string().optional() }
  }, async ({ query, budget, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const target = indexes.find(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid);
      if (!target) throw new Error('Index not found');
      const builder = new ContextBuilder();
      const files = target.snapshot.files.slice(0, 10);
      const context = builder.build(target.snapshot, query, files, { ...(budget ? { maxTokens: budget } : {}) });
      return jsonResult(context);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('analyze_impact', {
    description: 'Perform impact analysis for a symbol or file change.',
    inputSchema: { target: z.string().min(1), maxDepth: z.number().int().min(1).max(10).optional(), indexUid: z.string().optional() }
  }, async ({ target, maxDepth, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const loaded = indexes.find(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid);
      if (!loaded) throw new Error('Index not found');
      const impact = await analyzeImpact(loaded.snapshot, target, maxDepth ?? 5);
      return jsonResult(impact);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('find_tests', {
    description: 'Find test files and test symbols for a target symbol or file.',
    inputSchema: { query: z.string().min(1), indexUid: z.string().optional() }
  }, async ({ query, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const tests = indexes
        .filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
        .flatMap(({ snapshot }) => findTests(snapshot, query));
      return jsonResult(tests);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('find_affected_tests', {
    description: 'Find affected test files for a list of changed files.',
    inputSchema: { changedFiles: z.array(z.string()), indexUid: z.string().optional() }
  }, async ({ changedFiles, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const tests = indexes
        .filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
        .flatMap(({ snapshot }) => findAffectedTests(snapshot, changedFiles));
      return jsonResult(tests);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('find_api', {
    description: 'Find specific API endpoint by route or handler name.',
    inputSchema: { route: z.string().min(1), indexUid: z.string().optional() }
  }, async ({ route, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const apis = (await Promise.all(
        indexes
          .filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
          .map(({ snapshot }) => detectApiEndpoints(snapshot))
      )).flat().filter((api) => api.path.toLowerCase().includes(route.toLowerCase()));
      return jsonResult(apis);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('list_apis', {
    description: 'List all detected API endpoints in the indexed workspace.',
    inputSchema: { indexUid: z.string().optional() }
  }, async ({ indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const apis = (await Promise.all(
        indexes
          .filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
          .map(({ snapshot }) => detectApiEndpoints(snapshot))
      )).flat();
      return jsonResult(apis);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('get_database_schema', {
    description: 'Get detected database schemas, tables, fields, and ORM models.',
    inputSchema: { indexUid: z.string().optional() }
  }, async ({ indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const schemas = (await Promise.all(
        indexes
          .filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
          .map(({ snapshot }) => analyzeDatabaseSchema(snapshot))
      )).flat();
      return jsonResult(schemas);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('get_git_history', {
    description: 'Get git commit history for an indexed workspace.',
    inputSchema: { indexUid: z.string().optional(), limit: z.number().int().optional() }
  }, async ({ indexUid, limit }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const target = indexes.find(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid);
      if (!target) throw new Error('Index not found');
      return jsonResult(await getGitHistory(target.snapshot.metadata.workspaceRoot, limit ?? 20));
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('get_changes', {
    description: 'Get recent uncommitted file changes for an indexed workspace.',
    inputSchema: { indexUid: z.string().optional() }
  }, async ({ indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const target = indexes.find(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid);
      if (!target) throw new Error('Index not found');
      return jsonResult(await getGitHistory(target.snapshot.metadata.workspaceRoot, 20));
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('get_complexity', {
    description: 'Get code complexity metrics for indexed files and symbols.',
    inputSchema: { indexUid: z.string().optional() }
  }, async ({ indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const metrics = (await Promise.all(
        indexes
          .filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
          .map(({ snapshot }) => analyzeComplexity(snapshot))
      )).flat();
      return jsonResult(metrics);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('get_hotspots', {
    description: 'Get high-risk / high-activity hotspots in the repository.',
    inputSchema: { indexUid: z.string().optional() }
  }, async ({ indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const target = indexes.find(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid);
      if (!target) throw new Error('Index not found');
      return jsonResult(await detectHotspots(target.snapshot.metadata.workspaceRoot));
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('explain_symbol', {
    description: 'Get deterministic structural explanation for a symbol.',
    inputSchema: { symbol: z.string().min(1), indexUid: z.string().optional() }
  }, async ({ symbol, indexUid }) => {
    try {
      const { indexes } = await loadIndexes(indexDir);
      const target = indexes.find(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid);
      if (!target) throw new Error('Index not found');
      return jsonResult(await explainSymbol(target.snapshot, symbol));
    } catch (error) {
      return errorResult(error);
    }
  });

  return server;
}

export async function startCodebaseIndexerMcpServer(options: CodebaseIndexerMcpServerOptions = {}): Promise<void> {
  const server = createCodebaseIndexerMcpServer(options);
  await server.connect(new StdioServerTransport());
}

async function loadIndexes(indexDir: string): Promise<{
  indexes: LoadedIndex[];
  errors: Array<{ indexPath: string; message: string }>;
}> {
  let entries;
  try {
    entries = await readdir(indexDir, { withFileTypes: true });
  } catch (error) {
    if (isMissingFile(error)) return { indexes: [], errors: [] };
    throw error;
  }
  const indexes: LoadedIndex[] = [];
  const errors: Array<{ indexPath: string; message: string }> = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.index')) continue;
    const filePath = path.join(indexDir, entry.name);
    try {
      const snapshot = await IndexReader.read(filePath);
      indexes.push({ snapshot, filePath });
    } catch (error) {
      errors.push({ indexPath: filePath, message: error instanceof Error ? error.message : String(error) });
    }
  }
  indexes.sort((left, right) => left.snapshot.metadata.workspaceRoot.localeCompare(right.snapshot.metadata.workspaceRoot));
  return { indexes, errors };
}

function searchIndexes(indexes: LoadedIndex[], query: string, indexUid: string | undefined, limit: number) {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}_$.-]+/gu) ?? [])];
  if (terms.length === 0) return [];
  return indexes.filter(({ snapshot }) => !indexUid || snapshot.metadata.uid === indexUid)
    .flatMap(({ snapshot }) => {
      const symbolsByPath = new Map<string, string[]>();
      for (const symbol of snapshot.symbols) {
        symbolsByPath.set(symbol.filePath, [...(symbolsByPath.get(symbol.filePath) ?? []), symbol.name]);
      }
      return snapshot.files.flatMap((file) => {
        const termMatches = terms.filter((term) => file.terms.includes(term)).length;
        const pathMatches = terms.filter((term) => file.path.toLowerCase().includes(term)).length;
        const symbolMatches = (symbolsByPath.get(file.path) ?? []).reduce((total, name) =>
          total + terms.filter((term) => name.toLowerCase().includes(term)).length, 0);
        const score = termMatches * 2 + pathMatches + symbolMatches * 4;
        if (score === 0) return [];
        const excerpt = snapshot.chunks.find((chunk) => chunk.filePath === file.path &&
          terms.some((term) => chunk.text.toLowerCase().includes(term)))?.text.slice(0, 500);
        return [{
          indexUid: snapshot.metadata.uid,
          workspacePath: snapshot.metadata.workspaceRoot,
          filePath: file.path,
          language: file.language,
          score,
          ...(excerpt ? { excerpt } : {})
        }];
      });
    })
    .sort((left, right) => right.score - left.score || left.filePath.localeCompare(right.filePath))
    .slice(0, limit);
}

async function readIndexedFile(snapshot: IndexSnapshot, filePath: string) {
  const indexedFile = snapshot.files.find((file) => file.path === filePath);
  if (!indexedFile) throw new Error('File is not part of this index');
  const root = await realpath(snapshot.metadata.workspaceRoot);
  const candidate = path.resolve(root, indexedFile.path);
  if (!isPathInside(root, candidate)) throw new Error('File path is outside the indexed workspace');
  const actualPath = await realpath(candidate);
  if (!isPathInside(root, actualPath)) throw new Error('File resolves outside the indexed workspace');
  const fileStats = await stat(actualPath);
  if (!fileStats.isFile()) throw new Error('Indexed path is not a file');
  return {
    filePath: indexedFile.path,
    language: indexedFile.language,
    content: await readFile(actualPath, 'utf8')
  };
}

function symbolRelations(snapshot: IndexSnapshot, name: string) {
  const normalizedName = name.toLowerCase();
  const symbols = snapshot.symbols.filter((symbol) => symbol.name.toLowerCase() === normalizedName);
  const symbolIds = new Set(symbols.map((symbol) => symbol.id));
  const symbolNames = new Map(snapshot.symbols.map((symbol) => [symbol.id, symbol.name]));
  const relations = snapshot.relations.filter((relation) =>
    relation.targetName.toLowerCase() === normalizedName ||
    Boolean(relation.fromSymbolId && symbolIds.has(relation.fromSymbolId)) ||
    Boolean(relation.toSymbolId && symbolIds.has(relation.toSymbolId)));
  return [{
    indexUid: snapshot.metadata.uid,
    workspacePath: snapshot.metadata.workspaceRoot,
    symbols,
    relations: relations.map((relation) => ({
      ...relation,
      fromName: relation.fromSymbolId ? symbolNames.get(relation.fromSymbolId) : undefined,
      toName: relation.toSymbolId ? symbolNames.get(relation.toSymbolId) : undefined
    }))
  }];
}

function isPathInside(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate);
  return relativePath !== '' && relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath);
}

function jsonResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(error: unknown) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }]
  };
}

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}