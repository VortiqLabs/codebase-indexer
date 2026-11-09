import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { IndexManager } from '../src/core/IndexManager.js';

async function waitFor(assertion: () => Promise<boolean>, timeoutMs = 8_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  assert.fail(`Condition was not met within ${timeoutMs}ms`);
}

test('background watcher incrementally indexes additions, edits, deletions and ignores excluded directories', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-index-watch-'));
  const workspace = path.join(temporary, 'workspace');
  const indexDir = path.join(temporary, 'indexes');
  let managerForCleanup: IndexManager | undefined;
  try {
    await mkdir(workspace);
    await writeFile(path.join(workspace, 'base.ts'), 'export const base = 1;');
    const manager = await IndexManager.create({ workspacePath: workspace, indexDir });
    managerForCleanup = manager;
    await manager.index();
    await manager.startWatching({ debounceMs: 100 });
    assert.equal(manager.getWatchingStatus().watching, true);

    await mkdir(path.join(workspace, 'nested'));
    await writeFile(path.join(workspace, 'nested', '.gitignore'), 'private.ts\n');
    await writeFile(path.join(workspace, 'nested', 'private.ts'), 'export const privateThing = true;');
    await writeFile(path.join(workspace, 'nested', 'added.ts'), 'export function addedFeature() { return 1; }');
    await waitFor(async () => (await manager.getFile('nested/added.ts')) !== undefined);
    assert.ok((await manager.findSymbol('addedFeature')).length > 0);
    assert.equal(await manager.getFile('nested/private.ts'), undefined);

    await writeFile(path.join(workspace, 'nested', 'added.ts'), 'export function changedFeature() { return 2; }');
    await waitFor(async () => (await manager.findSymbol('changedFeature')).length > 0);
    assert.equal((await manager.findSymbol('addedFeature')).length, 0);

    await mkdir(path.join(workspace, 'node_modules'), { recursive: true });
    await writeFile(path.join(workspace, 'node_modules', 'ignored.ts'), 'export const ignored = true;');
    await writeFile(path.join(workspace, 'nested', 'added.ts'), 'export function changedAgain() { return 3; }');
    await waitFor(async () => (await manager.findSymbol('changedAgain')).length > 0);
    assert.equal(await manager.getFile('node_modules/ignored.ts'), undefined);

    await rm(path.join(workspace, 'nested', 'added.ts'));
    await waitFor(async () => (await manager.getFile('nested/added.ts')) === undefined);
    const status = manager.getWatchingStatus();
    assert.ok(status.lastIndexCompletedAt);
    assert.equal(status.lastError, undefined);
  } finally {
    await managerForCleanup?.stopWatching();
    await rm(temporary, { recursive: true, force: true });
  }
});
