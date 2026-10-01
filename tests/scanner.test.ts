import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { FileScanner } from '../src/scanner/FileScanner.js';

test('scanner hashes supported text files and respects ignore, binary, and size rules', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-'));
  try {
    await mkdir(path.join(workspace, 'src'));
    await mkdir(path.join(workspace, 'src', 'generated'));
    await mkdir(path.join(workspace, 'node_modules'));
    await writeFile(path.join(workspace, '.gitignore'), 'ignored.ts\n');
    await writeFile(path.join(workspace, 'src', '.gitignore'), 'local.ts\ngenerated/\n!keep.ts\n');
    await writeFile(path.join(workspace, 'src', 'main.ts'), 'const x=1;\n');
    await writeFile(path.join(workspace, 'src', 'local.ts'), 'ignored');
    await writeFile(path.join(workspace, 'src', 'keep.ts'), 'const kept = 1;');
    await writeFile(path.join(workspace, 'src', 'generated', 'bundle.ts'), 'ignored');
    await writeFile(path.join(workspace, 'ignored.ts'), 'ignored');
    await writeFile(path.join(workspace, 'node_modules', 'dep.js'), 'ignored');
    await writeFile(path.join(workspace, 'image.bin'), Buffer.from([0, 1, 2, 3]));
    await writeFile(path.join(workspace, 'large.ts'), 'x'.repeat(32));

    const scanner = await FileScanner.create(workspace, { maxFileSize: 16 });
    const result = await scanner.scan();

    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.files.map((file) => file.path), ['.gitignore', 'src/keep.ts', 'src/main.ts']);
    const sourceFile = result.files.find((file) => file.path === 'src/main.ts');
    assert.equal(sourceFile?.language, 'typescript');
    assert.match(sourceFile?.hash ?? '', /^[a-f0-9]{64}$/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});