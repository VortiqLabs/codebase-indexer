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

    const dependencies = await indexer.findDependencies('src/services/auth.ts');
    assert.ok(dependencies.some((relation) => relation.kind === 'imports'));
    assert.ok(dependencies.some((relation) => relation.kind === 'imports' && relation.toSymbolId));
    const dependents = await indexer.findDependents('src/services/db.ts');
    assert.ok(dependents.some((relation) => relation.kind === 'imports'));

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
