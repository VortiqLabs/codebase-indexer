import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CodebaseIndexer, Codebase, createCodebase } from '../src/index.js';

test('public API indexes a workspace and exposes searchable persisted code data', async () => {
	const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-api-'));
	const workspace = path.join(temporary, 'workspace');
	const indexDir = path.join(temporary, 'indexes');
	try {
		await mkdir(path.join(workspace, 'src'), { recursive: true });
		await writeFile(
			path.join(workspace, 'src', 'auth.ts'),
			'export function authenticate() { return findUser(); }\nfunction findUser() { return "alice"; }\n'
		);

		const indexer = new CodebaseIndexer({ workspacePath: workspace, indexDir });
		await indexer.initialize();
		const update = await indexer.index();

		assert.equal(update.added, 1);
		assert.equal((await indexer.search('authenticate'))[0]?.file.path, 'src/auth.ts');
		assert.equal((await indexer.getFile('src/auth.ts'))?.language, 'typescript');
		assert.ok((await indexer.findSymbol('authenticate')).some((symbol) => symbol.kind === 'function'));
		assert.ok((await indexer.findDefinition('authenticate')).some((symbol) => symbol.name === 'authenticate'));
		assert.ok((await indexer.findReferences('findUser')).some((relation) => relation.targetName === 'findUser'));
		assert.equal((await indexer.findCallers('findUser'))[0]?.targetName, 'findUser');
		assert.equal((await indexer.findCallees('authenticate'))[0]?.targetName, 'findUser');

		const context = await indexer.getContext('authenticate', { maxTokens: 1000 });
		assert.ok(context.files.some((file) => file.path === 'src/auth.ts'));
		assert.ok(context.chunks.some((chunk) => chunk.text.includes('authenticate')));
		assert.equal((await indexer.getStats()).fileCount, 1);

		const reopenedIndexer = new CodebaseIndexer({ workspacePath: workspace, indexDir });
		await reopenedIndexer.initialize();
		assert.equal((await reopenedIndexer.search('authenticate'))[0]?.file.path, 'src/auth.ts');
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
});


test('high-level Codebase SDK auto-initializes and exposes chunks, graph data and lifecycle helpers', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-sdk-api-'));
  const workspace = path.join(temporary, 'workspace');
  const indexDir = path.join(temporary, 'indexes');
  try {
    await mkdir(path.join(workspace, 'src'), { recursive: true });
    await writeFile(path.join(workspace, 'src', 'auth.ts'), 'export function authenticate() { return findUser(); }\nfunction findUser() { return "alice"; }\n');

    const codebase = await createCodebase({ workspacePath: workspace, indexDir });
    assert.ok(codebase instanceof Codebase);
    const update = await codebase.index();
    assert.equal(update.added, 1);
    assert.equal((await codebase.getFiles()).length, 1);
    assert.ok((await codebase.getChunks({ query: 'authenticate' })).length > 0);
    assert.ok((await codebase.getSymbols()).some((symbol) => symbol.name === 'authenticate'));
    assert.ok((await codebase.getRelations()).some((relation) => relation.targetName === 'findUser'));
    assert.equal((await codebase.getSnapshot()).metadata.fileCount, 1);
    assert.equal((await codebase.getStatus()).indexed, true);
    assert.equal((await codebase.getStats()).chunkCount > 0, true);
    assert.ok((await codebase.findDependencies('src/auth.ts')).length >= 0);
    await codebase.close();

    const reopened = await Codebase.open({ workspacePath: workspace, indexDir });
    assert.equal((await reopened.search('authenticate'))[0]?.file.path, 'src/auth.ts');
    await reopened.close();
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
