import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createLiteRTEmbeddingWebviewHtml, LiteRTEmbeddingProvider, LiteRTWebviewEmbeddingTransport } from '../src/embeddings/LiteRTEmbeddingProvider.js';
import { OpenAICompatibleEmbeddingProvider } from '../src/embeddings/OpenAICompatibleEmbeddingProvider.js';
import { EmbeddingGemmaOnnxProvider } from '../src/embeddings/EmbeddingGemmaOnnxProvider.js';
import { EmbeddingQueue } from '../src/embeddings/EmbeddingQueue.js';
import type { CodeChunk } from '../src/types/CodeChunk.js';

test('OpenAI-compatible provider uses LiteRT-LM EmbeddingGemma 2 task prefixes and restores response order', async () => {
  let received: { model?: string; input?: string[]; dimensions?: number } | undefined;
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    received = JSON.parse(Buffer.concat(chunks).toString()) as typeof received;
    response.writeHead(200, { 'content-type': 'application/json' });
    const count = received?.input?.length ?? 0;
    response.end(JSON.stringify({ data: Array.from({ length: count }, (_, index) => ({ index: count - index - 1, embedding: index === 0 ? [0, 1] : [1, 0] })) }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    const provider = new OpenAICompatibleEmbeddingProvider({ baseUrl: `http://127.0.0.1:${address.port}/v1`, model: 'embeddinggemma-2', dimensions: 2 });
    const chunks: CodeChunk[] = [
      { id: '1', filePath: 'src/a.ts', startLine: 1, endLine: 2, hash: 'a', text: 'export function alpha() {}' },
      { id: '2', filePath: 'src/b.ts', startLine: 1, endLine: 2, hash: 'b', text: 'export function beta() {}' }
    ];
    const vectors = await provider.embedChunks(chunks);
    assert.deepEqual(vectors, [[1, 0], [0, 1]]);
    assert.equal(received?.model, 'embeddinggemma-2');
    assert.equal(received?.dimensions, 2);
    assert.deepEqual(received?.input, [
      'task: search result | text: file: src/a.ts\nexport function alpha() {}',
      'task: search result | text: file: src/b.ts\nexport function beta() {}'
    ]);
    await provider.embed('find where alpha is defined');
    assert.equal(received?.input?.[0], 'task: search query | text: find where alpha is defined');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('LiteRT provider applies asymmetric query and document prefixes through its transport', async () => {
  const calls: Array<{ texts: string[]; task: string }> = [];
  const provider = new LiteRTEmbeddingProvider({
    async computeEmbeddingBatch(texts, task) { calls.push({ texts, task }); return texts.map(() => [0.25, 0.75]); }
  }, { dimensions: 256 });
  assert.deepEqual(await provider.embed('  find auth  '), [0.25, 0.75]);
  assert.deepEqual(await provider.embedChunks([{ id: 'x', filePath: 'src/auth.ts', startLine: 1, endLine: 2, hash: 'h', text: '  export function auth() {}  ' }]), [[0.25, 0.75]]);
  assert.deepEqual(calls, [
    { task: 'search-query', texts: ['task: search query | text: find auth'] },
    { task: 'search-result', texts: ['task: search result | text: file: src/auth.ts\nexport function auth() {}'] }
  ]);
  assert.match(provider.id, /^litert-embeddinggemma-2:/);
});

test('LiteRT WebView transport waits for engine readiness and correlates batched responses', async () => {
  let listener: ((event: { data: unknown }) => void) | undefined;
  const sent: Array<Record<string, unknown>> = [];
  const transport = new LiteRTWebviewEmbeddingTransport({
    postMessage(message) { sent.push(message as Record<string, unknown>); return true; },
    onMessage(callback) { listener = callback; return { dispose() { listener = undefined; } }; },
    timeoutMs: 1000
  });
  const pending = transport.computeEmbeddingBatch(['task: search result | text: a'], 'search-result');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent.length, 0);
  listener?.({ data: { type: 'codebase-indexer:ready' } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent.length, 1);
  const requestId = sent[0]?.requestId;
  listener?.({ data: { type: 'codebase-indexer:embedding-result', requestId, vectors: [[1, 0]] } });
  assert.deepEqual(await pending, [[1, 0]]);
  transport.dispose();
});

test('LiteRT WebView transport rejects requests when initialization fails', async () => {
  let listener: ((event: { data: unknown }) => void) | undefined;
  const transport = new LiteRTWebviewEmbeddingTransport({
    postMessage() { return true; },
    onMessage(callback) { listener = callback; return { dispose() { listener = undefined; } }; },
    timeoutMs: 1000
  });
  const pending = transport.computeEmbeddingBatch(['text'], 'search-query');
  listener?.({ data: { type: 'codebase-indexer:init-error', error: 'WebGPU unavailable and CPU init failed' } });
  await assert.rejects(pending, /LiteRT-LM initialization failed/);
  transport.dispose();
});


test('LiteRT WebView HTML supports a local WASM URI and applies a restrictive CSP', () => {
  const html = createLiteRTEmbeddingWebviewHtml({
    scriptUri: 'vscode-webview://extension/litert-embedding-runtime.js',
    wasmUri: 'vscode-webview://extension/wasm',
    cspSource: 'vscode-webview://extension',
    nonce: 'nonce-value',
    dimensions: 512,
    backend: 'cpu'
  });
  assert.match(html, /vscode-webview:\/\/extension\/litert-embedding-runtime\.js/);
  assert.match(html, /vscode-webview:\/\/extension\/wasm\//);
  assert.match(html, /wasm-unsafe-eval/);
  assert.match(html, /connect-src https: data: vscode-webview:\/\/extension/);
  assert.match(html, /\"dimensions\":512/);
  assert.match(html, /\"backend\":\"cpu\"/);
});


test('EmbeddingGemma ONNX provider uses code retrieval prompts and re-normalizes CPU vectors after MRL truncation', async () => {
  const calls: string[][] = [];
  const provider = new EmbeddingGemmaOnnxProvider({ dimensions: 128, dtype: 'q8' }, {
    async embed(texts) { calls.push(texts); return texts.map(() => [3, 4, ...Array(126).fill(0)]); }
  });
  assert.deepEqual((await provider.embed('  find login handler  ')).slice(0, 2), [0.6, 0.8]);
  assert.deepEqual((await provider.embedChunks([{ id: 'a', filePath: 'src/auth.ts', startLine: 1, endLine: 2, hash: 'h', text: '  export function login() {}  ' }]))[0]?.slice(0, 2), [0.6, 0.8]);
  assert.deepEqual(calls, [
    ['task: code retrieval | query: find login handler'],
    ['title: src/auth.ts | text: export function login() {}']
  ]);
  assert.equal(provider.dimensions(), 128);
  assert.match(provider.id, /onnx:onnx-community\/embeddinggemma-2-ONNX:q8:128/);
});

test('EmbeddingGemma ONNX provider rejects vectors shorter than the configured output size', async () => {
  const provider = new EmbeddingGemmaOnnxProvider({ dimensions: 256 }, { async embed() { return [[1, 2]]; } });
  await assert.rejects(provider.embed('query'), /invalid 2-dimensional vector/);
});


test('Embedding queue bounds local ONNX micro-batches and reports incremental progress', async () => {
  const batchSizes: number[] = [];
  const progress: Array<[number, number]> = [];
  const provider = {
    id: 'embeddinggemma-2:onnx:test:q8:256',
    dimensions: () => 2,
    async embed() { return [1, 0]; },
    async embedBatch(texts: string[]) { batchSizes.push(texts.length); return texts.map(() => [1, 0]); }
  };
  const chunks = Array.from({ length: 9 }, (_, index) => ({
    id: `chunk-${index}`, filePath: `src/${index}.ts`, startLine: 1, endLine: 1, hash: `hash-${index}`, text: 'code'
  }));
  const vectors = await new EmbeddingQueue().embed(provider, chunks, provider.id, (completed, total) => progress.push([completed, total]));
  assert.deepEqual(batchSizes, [4, 4, 1]);
  assert.deepEqual(progress, [[4, 9], [8, 9], [9, 9]]);
  assert.equal(vectors.length, 9);
});
