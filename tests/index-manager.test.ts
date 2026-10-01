import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { IndexManager } from '../src/core/IndexManager.js';

test('incremental indexing reuses unchanged records and applies add, change, and delete updates', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-index-update-'));
  const workspace = path.join(temporary, 'workspace');
  const indexDir = path.join(temporary, 'indexes');
  try {
    await mkdir(workspace);
    await writeFile(path.join(workspace, 'a.ts'), 'export function alpha() { return beta(); }\nfunction beta() { return 1; }');
    await writeFile(path.join(workspace, 'b.py'), 'beta = 2');
    const manager = await IndexManager.create({ workspacePath: workspace, indexDir });

    const initial = await manager.index();
    assert.equal(initial.added, 2);
    assert.equal(initial.unchanged, 0);
    assert.equal(path.basename(initial.indexPath), `${manager.uid}.index`);

    const unchanged = await manager.index();
    assert.equal(unchanged.added, 0);
    assert.equal(unchanged.changed, 0);
    assert.equal(unchanged.unchanged, 2);

    await writeFile(path.join(workspace, 'a.ts'), 'export function alpha() { return beta(); }\nfunction beta() { return 3; }');
    await rm(path.join(workspace, 'b.py'));
    await writeFile(path.join(workspace, 'c.go'), 'package gamma');
    const update = await manager.index();
    assert.deepEqual({ added: update.added, changed: update.changed, deleted: update.deleted, unchanged: update.unchanged }, {
      added: 1, changed: 1, deleted: 1, unchanged: 0
    });
    assert.equal((await manager.search('gamma'))[0]?.file.path, 'c.go');
    const snapshot = await manager.read();
    assert.deepEqual(snapshot.files.map((file) => file.path), ['a.ts', 'c.go']);
    assert.ok(snapshot.symbols.some((symbol) => symbol.name === 'alpha'));
    assert.ok(snapshot.relations.some((relation) => relation.kind === 'calls' && relation.targetName === 'beta' && relation.toSymbolId));
    assert.equal((await manager.findCallers('beta')).length, 1);
    assert.equal((await manager.findCallees('alpha')).length, 1);
    assert.equal((await manager.findReferences('beta')).length, 1);
    assert.ok(snapshot.chunks.length >= 2);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});