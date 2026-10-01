import type { EmbeddingProvider } from './EmbeddingProvider.js';
import type { CodeChunk } from '../types/CodeChunk.js';
import type { VectorRecord } from '../types/VectorRecord.js';

export class EmbeddingQueue {
  constructor(private readonly batchSize = 32) {}

  async embed(provider: EmbeddingProvider, chunks: CodeChunk[], providerId: string): Promise<VectorRecord[]> {
    const vectors: VectorRecord[] = [];
    for (let offset = 0; offset < chunks.length; offset += this.batchSize) {
      const batch = chunks.slice(offset, offset + this.batchSize);
      const embeddings = await provider.embedBatch(batch.map((chunk) => chunk.text));
      if (embeddings.length !== batch.length) throw new Error('Embedding provider returned an unexpected batch size');
      for (let index = 0; index < batch.length; index++) {
        const values = embeddings[index]!;
        if (values.length !== provider.dimensions() || values.some((value) => !Number.isFinite(value))) {
          throw new Error('Embedding provider returned a vector with invalid dimensions or values');
        }
        vectors.push({
          chunkId: batch[index]!.id,
          chunkHash: batch[index]!.hash,
          providerId,
          dimensions: values.length,
          values
        });
      }
    }
    return vectors;
  }
}