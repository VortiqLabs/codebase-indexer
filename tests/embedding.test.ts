import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { IndexManager } from '../src/core/IndexManager.js';
import type { EmbeddingProvider } from '../src/embeddings/EmbeddingProvider.js';

class TestEmbeddingProvider implements EmbeddingProvider {
  id = 'test-provider-v1';
  calls = 0;

  dimensions(): number {
    return 2;
  }

  async embed(text: string): Promise<number[]> {
    return this.vector(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    this.calls++;
    return texts.map((text) => this.vector(text));
  }

  private vector(text: string): number[] {
    return text.toLowerCase().includes('amber') ? [1, 0] : [0, 1];
  }
}

test('optional embeddings persist, support semantic search, and reuse unchanged chunk hashes', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-index-embeddings-'));
  const workspace = path.join(temporary, 'workspace');
  const indexDir = path.join(temporary, 'indexes');
  const provider = new TestEmbeddingProvider();
  try {
    await mkdir(workspace);
    await writeFile(path.join(workspace, 'colors.md'), '# Amber\n\nAmber light.\n\n# Blue\n\nBlue light.');
    const manager = await IndexManager.create({ workspacePath: workspace, indexDir, embeddingProvider: provider });
    const first = await manager.index();
    assert.ok(first.snapshot.metadata.vectorCount > 0);
    const callsAfterIndex = provider.calls;
    assert.ok(callsAfterIndex > 0);
    assert.equal((await manager.semanticSearch('amber light'))[0]?.chunk.text.includes('Amber'), true);

    const second = await manager.index();
    assert.equal(second.unchanged, 1);
    assert.equal(provider.calls, callsAfterIndex);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});