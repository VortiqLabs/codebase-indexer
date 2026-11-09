import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CodebaseIndexer } from '../src/index.js';

test('graph intelligence exposes dependency paths, repository map, and intent routing', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-intelligence-'));
  const workspace = path.join(temporary, 'workspace');
  const indexDir = path.join(temporary, 'indexes');
  try {
    await mkdir(path.join(workspace, 'src', 'services'), { recursive: true });
    await mkdir(path.join(workspace, 'tests'), { recursive: true });
    await writeFile(
      path.join(workspace, 'src', 'services', 'auth.ts'),
      `import { getUser } from './db';\n\nexport function login() { return authenticate(getUser()); }\nfunction authenticate(user: string) { return user; }\n`
    );
    await writeFile(
      path.join(workspace, 'src', 'services', 'db.ts'),
      `export function getUser() { return 'alice'; }\n`
    );
    await writeFile(
      path.join(workspace, 'tests', 'auth.test.ts'),
      `import { login } from '../src/services/auth';\nlogin();\n`
    );
    await writeFile(
      path.join(workspace, 'package.json'),
      JSON.stringify({ name: 'demo-app', scripts: { test: 'vitest run' }, dependencies: { express: '^4.18.0' } }, null, 2)
    );

    const indexer = new CodebaseIndexer({ workspacePath: workspace, indexDir });
    await indexer.initialize();
    await indexer.index();

    const context = await indexer.getContext('login', { maxFiles: 4, maxTokens: 2000 });
    assert.ok(context.files.some((file) => file.path === 'src/services/auth.ts'));
    assert.ok(context.files.some((file) => file.path === 'src/services/db.ts'), 'context should pull in a directly related dependency');
    assert.ok(context.estimatedTokens <= 2000);

    const dependencies = await indexer.findDependencies('src/services/auth.ts');
    assert.ok(dependencies.some((relation) => relation.kind === 'imports'));
    assert.ok(dependencies.some((relation) => relation.kind === 'calls' && relation.toSymbolId), 'symbol calls should resolve to indexed definitions');
    const dependents = await indexer.findDependents('src/services/db.ts');
    assert.ok(dependents.some((relation) => relation.kind === 'imports'));

    const impact = await indexer.analyzeChangeImpact('getUser');
    assert.ok(impact.matchedSymbols.some((symbol) => symbol.name === 'getUser'));
    assert.ok(impact.affectedFiles.some((file) => file.filePath === 'src/services/auth.ts'));
    assert.ok(impact.caveats.some((caveat) => caveat.includes('static estimate')));

    const fileImpact = await indexer.analyzeChangeImpact('src/services/auth.ts');
    assert.ok(fileImpact.matchedFiles.includes('src/services/auth.ts'));
    assert.ok(fileImpact.affectedFiles.some((file) => file.filePath === 'tests/auth.test.ts'));

    const pathResult = await indexer.findPath('login', 'getUser');
    assert.ok(pathResult.nodes.includes('login'));
    assert.ok(pathResult.nodes.includes('getUser'));
    assert.ok(pathResult.depth >= 1);

    const repoMap = await indexer.getRepositoryMap();
    assert.ok(repoMap.areas.length > 0);
    assert.ok(repoMap.root === workspace);

    const intent = await indexer.classifyQuery('Who calls login?');
    assert.equal(intent.kind, 'caller');

    const apiEndpoints = await indexer.findApiEndpoints();
    assert.ok(apiEndpoints.length >= 0);

    const sensitive = await indexer.findSensitiveRegions();
    assert.ok(Array.isArray(sensitive));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('incremental graph refresh invalidates stale symbol edges and resolves renamed targets', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-graph-refresh-'));
  const workspace = path.join(temporary, 'workspace');
  const indexDir = path.join(temporary, 'indexes');
  try {
    await mkdir(path.join(workspace, 'src'), { recursive: true });
    await writeFile(path.join(workspace, 'src', 'service.ts'), `export function oldName() { return true; }\n`);
    await writeFile(path.join(workspace, 'src', 'consumer.ts'), `import { oldName } from './service'; export const result = oldName();\n`);
    const indexer = new CodebaseIndexer({ workspacePath: workspace, indexDir });
    await indexer.initialize();
    await indexer.index();
    const initial = await indexer.findDependencies('src/consumer.ts');
    assert.ok(initial.some((relation) => relation.kind === 'calls' && relation.targetName === 'oldName' && relation.toSymbolId), 'initial call should resolve to the exported symbol');

    await writeFile(path.join(workspace, 'src', 'service.ts'), `export function newName() { return true; }\n`);
    await indexer.index();
    const stale = await indexer.findDependencies('src/consumer.ts');
    assert.ok(stale.some((relation) => relation.kind === 'calls' && relation.targetName === 'oldName' && !relation.toSymbolId), 'edge to deleted symbol must be invalidated');

    await writeFile(path.join(workspace, 'src', 'consumer.ts'), `import { newName } from './service'; export const result = newName();\n`);
    await indexer.index();
    const refreshed = await indexer.findDependencies('src/consumer.ts');
    assert.ok(refreshed.some((relation) => relation.kind === 'calls' && relation.targetName === 'newName' && relation.toSymbolId), 'new edge should resolve to the replacement symbol');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('architecture analysis resolves relative imports and reports circular dependencies', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-architecture-'));
  const workspace = path.join(temporary, 'workspace');
  const indexDir = path.join(temporary, 'indexes');
  try {
    await mkdir(path.join(workspace, 'src'), { recursive: true });
    await writeFile(path.join(workspace, 'src', 'alpha.ts'), "import { beta } from './beta';\nexport function alpha() { return beta(); }\n");
    await writeFile(path.join(workspace, 'src', 'beta.ts'), "import { alpha } from './alpha';\nexport function beta() { return alpha.name; }\n");
    await writeFile(path.join(workspace, 'src', 'entry.ts'), "import { alpha } from './alpha';\nalpha();\n");

    const indexer = new CodebaseIndexer({ workspacePath: workspace, indexDir });
    await indexer.initialize();
    await indexer.index();

    const architecture = await indexer.analyzeArchitecture();
    assert.ok(architecture.dependencies.some((edge) => edge.from === 'src/alpha.ts' && edge.to === 'src/beta.ts'));
    assert.ok(architecture.dependencies.some((edge) => edge.from === 'src/beta.ts' && edge.to === 'src/alpha.ts'));
    assert.ok(architecture.cycles.some((cycle) => cycle.files.includes('src/alpha.ts') && cycle.files.includes('src/beta.ts')));
    assert.ok(architecture.files.find((file) => file.path === 'src/alpha.ts')?.fanIn);
    assert.ok(architecture.entryCandidates.includes('src/entry.ts'));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});


test('architecture analysis resolves TypeScript path aliases and inventories workspace and external packages', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-alias-architecture-'));
  const workspace = path.join(temporary, 'workspace');
  const indexDir = path.join(temporary, 'indexes');
  try {
    await mkdir(path.join(workspace, 'src', 'services'), { recursive: true });
    await mkdir(path.join(workspace, 'packages', 'shared', 'src'), { recursive: true });
    await writeFile(path.join(workspace, 'tsconfig.json'), JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }, null, 2));
    await writeFile(path.join(workspace, 'package.json'), JSON.stringify({ name: 'root-app' }));
    await writeFile(path.join(workspace, 'src', 'services', 'auth.ts'), "export const auth = () => true;\\n");
    await writeFile(path.join(workspace, 'src', 'main.ts'), "import { auth } from '@/services/auth';\\nimport { shared } from '@demo/shared';\\nimport express from 'express';\\nauth();\\n");
    await writeFile(path.join(workspace, 'packages', 'shared', 'package.json'), JSON.stringify({ name: '@demo/shared', main: 'src/index.ts' }));
    await writeFile(path.join(workspace, 'packages', 'shared', 'src', 'index.ts'), 'export const shared = true;\\n');

    const indexer = new CodebaseIndexer({ workspacePath: workspace, indexDir });
    await indexer.initialize();
    await indexer.index();
    const report = await indexer.analyzeArchitecture();
    assert.ok(report.dependencies.some((edge) => edge.from === 'src/main.ts' && edge.to === 'src/services/auth.ts'));
    assert.ok(report.dependencies.some((edge) => edge.from === 'src/main.ts' && edge.to === 'packages/shared/src/index.ts'));
    assert.ok(report.resolvedAliases.some((alias) => alias.alias === '@/*'));
    assert.ok(report.workspacePackages.some((item) => item.name === '@demo/shared'));
    assert.ok(report.externalPackages.some((item) => item.name === 'express'));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('change impact reports ambiguous symbol names instead of hiding the ambiguity', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-ambiguous-impact-'));
  const workspace = path.join(temporary, 'workspace');
  const indexDir = path.join(temporary, 'indexes');
  try {
    await mkdir(path.join(workspace, 'one'), { recursive: true });
    await mkdir(path.join(workspace, 'two'), { recursive: true });
    await writeFile(path.join(workspace, 'one', 'service.ts'), 'export function load() { return 1; }\n');
    await writeFile(path.join(workspace, 'two', 'service.ts'), 'export function load() { return 2; }\n');
    await writeFile(path.join(workspace, 'one', 'consumer.ts'), "import { load } from './service'; load();\n");
    await writeFile(path.join(workspace, 'one', 'facade.ts'), "import { load } from './service'; export const run = () => load();\n");
    await writeFile(path.join(workspace, 'one', 'facade.test.ts'), "import { run } from './facade'; run();\n");
    const indexer = new CodebaseIndexer({ workspacePath: workspace, indexDir });
    await indexer.initialize();
    await indexer.index();
    const impact = await indexer.analyzeChangeImpact('load');
    assert.equal(impact.ambiguous, true);
    assert.equal(impact.matchedSymbols.filter((symbol) => symbol.name === 'load').length, 2);
    assert.ok(impact.caveats.some((caveat) => caveat.includes('matches 2 definitions')));
    const specific = await indexer.analyzeChangeImpact('one/service.ts');
    assert.equal(specific.ambiguous, false);
    assert.ok(specific.affectedFiles.some((file) => file.filePath === 'one/consumer.ts'));
    assert.ok(specific.affectedFiles.some((file) => file.filePath === 'one/facade.ts' && file.depth === 1));
    assert.ok(specific.affectedFiles.some((file) => file.filePath === 'one/facade.test.ts' && file.depth === 2), 'file-level import traversal should include transitive dependents');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
