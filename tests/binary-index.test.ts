import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { IndexFormatError, IndexReader, IndexWriter } from '../src/storage/BinaryIndex.js';
import { INDEX_FORMAT_VERSION, type IndexSnapshot } from '../src/storage/IndexFormat.js';

function createSnapshot(uid = 'test-uid'): IndexSnapshot {
  const now = new Date().toISOString();
  return {
    metadata: {
      uid,
      workspaceRoot: '/workspace',
      formatVersion: INDEX_FORMAT_VERSION,
      indexerVersion: '0.1.0',
      createdAt: now,
      updatedAt: now,
      fileCount: 1,
      symbolCount: 0,
      relationCount: 0,
      chunkCount: 0,
      vectorCount: 0,
      configurationHash: 'config-hash'
    },
    files: [{ path: 'src/main.ts', language: 'typescript', hash: 'content-hash', size: 10, modifiedAt: 1, terms: ['main'] }],
    symbols: [],
    relations: [],
    chunks: [],
    vectors: []
  };
}

test('binary index is versioned, checksummed, UID-addressed, and round-trips', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'codebase-index-format-'));
  try {
    const indexPath = path.join(directory, 'test-uid.index');
    const snapshot = createSnapshot();
    await IndexWriter.writeAtomic(indexPath, snapshot);
    const bytes = await readFile(indexPath);
    assert.equal(path.extname(indexPath), '.index');
    assert.notEqual(bytes.subarray(0, 1).toString(), '{');
    assert.deepEqual(await IndexReader.read(indexPath, 'test-uid'), snapshot);
    await assert.rejects(IndexReader.read(indexPath, 'wrong-uid'), /UID mismatch/);

    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 0xff;
    const corruptPath = path.join(directory, 'corrupt.index');
    await writeFile(corruptPath, bytes);
    await assert.rejects(IndexReader.read(corruptPath), IndexFormatError);

    const versionPath = path.join(directory, 'version.index');
    const unsupported = Buffer.from(await readFile(indexPath));
    unsupported.writeUInt16BE(INDEX_FORMAT_VERSION + 1, 8);
    await writeFile(versionPath, unsupported);
    await assert.rejects(IndexReader.read(versionPath), /Unsupported index format version/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a failed write leaves the previous index intact', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'codebase-index-atomic-'));
  try {
    const indexPath = path.join(directory, 'test-uid.index');
    await IndexWriter.writeAtomic(indexPath, createSnapshot());
    const original = await readFile(indexPath);
    const invalid = createSnapshot('x'.repeat(0x10000));
    await assert.rejects(IndexWriter.writeAtomic(indexPath, invalid), /UID is too long/);
    assert.deepEqual(await readFile(indexPath), original);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});