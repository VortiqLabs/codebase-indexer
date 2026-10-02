import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CodebaseIndexer } from '../src/core/CodebaseIndexer.js';
import { IndexManager } from '../src/core/IndexManager.js';
import { createDashboardApp } from '../src/dashboard/DashboardServer.js';
import type { GitHubRepositoryIndexResult } from '../src/github/GitHubRepositoryIndexer.js';

test('dashboard serves index summaries, resolved graph data, and cross-index search', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-dashboard-'));
  const workspace = path.join(temporary, 'workspace');
  const indexDir = path.join(temporary, 'indexes');
  await mkdir(path.join(workspace, 'src'), { recursive: true });
  const generatedSymbols = Array.from({ length: 85 }, (_, index) =>
    `export function helper${index}() { return ${index}; }`);
  await writeFile(
    path.join(workspace, 'src', 'auth.ts'),
    ['export function authenticate() { return findUser(); }', 'function findUser() { return "alice"; }', 'app.get("/health", () => "ok");', ...generatedSymbols].join('\n')
  );
  const indexer = new CodebaseIndexer({ workspacePath: workspace, indexDir });
  await indexer.initialize();
  await indexer.index();

  const server = createDashboardApp(indexDir).listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const page = await fetch(baseUrl);
    assert.equal(page.status, 200);
    const pageText = await page.text();
    assert.match(pageText, /Codebase Index Dashboard/u);
    assert.match(pageText, /Filter workspaces/u);
    assert.match(pageText, /Relation makeup/u);

    const indexResponse = await fetch(`${baseUrl}/api/indexes`);
    const indexPayload = await indexResponse.json() as {
      indexes: Array<{ metadata: { uid: string; fileCount: number } }>;
    };
    assert.equal(indexPayload.indexes.length, 1);
    assert.equal(indexPayload.indexes[0]?.metadata.fileCount, 1);

    const uid = indexPayload.indexes[0]!.metadata.uid;
    const graphResponse = await fetch(`${baseUrl}/api/indexes/${uid}`);
    const graphPayload = await graphResponse.json() as {
      metadata: { symbolCount: number };
      graph: { nodes: Array<{ name: string; startLine: number; endLine: number }>; edges: Array<{ kind: string }>; truncated: boolean };
    };
    assert.equal(graphPayload.graph.nodes.length, 80);
    assert.equal(graphPayload.graph.truncated, true);
    assert.ok(graphPayload.graph.edges.some((edge) => edge.kind === 'calls'));
    const authenticate = graphPayload.graph.nodes.find((node) => node.name === 'authenticate');
    assert.deepEqual({ startLine: authenticate?.startLine, endLine: authenticate?.endLine }, { startLine: 1, endLine: 1 });

    const intelligenceResponse = await fetch(`${baseUrl}/api/indexes/${uid}/intelligence`);
    const intelligencePayload = await intelligenceResponse.json() as {
      repositoryMap: { areas: Array<{ path: string; kind: string; files: number }> };
      apiEndpoints: Array<{ method: string; path: string; fileId: string }>;
    };
    assert.ok(intelligencePayload.repositoryMap.areas.some((area) => area.path === 'src/auth.ts' && area.kind === 'source' && area.files === 1));
    assert.ok(intelligencePayload.apiEndpoints.some((endpoint) => endpoint.method === 'GET' && endpoint.path === '/health' && endpoint.fileId === 'src/auth.ts'));

    const sourceResponse = await fetch(`${baseUrl}/api/indexes/${uid}/source?path=src%2Fauth.ts`);
    const sourcePayload = await sourceResponse.json() as { path: string; language: string; content: string };
    assert.equal(sourcePayload.path, 'src/auth.ts');
    assert.equal(sourcePayload.language, 'typescript');
    assert.match(sourcePayload.content, /function authenticate/u);
    const unindexedSourceResponse = await fetch(`${baseUrl}/api/indexes/${uid}/source?path=..%2Fpackage.json`);
    assert.equal(unindexedSourceResponse.status, 404);

    const fullGraphResponse = await fetch(`${baseUrl}/api/indexes/${uid}?all=true`);
    const fullGraphPayload = await fullGraphResponse.json() as {
      metadata: { symbolCount: number };
      graph: { nodes: unknown[]; truncated: boolean };
    };
    assert.equal(fullGraphPayload.graph.nodes.length, fullGraphPayload.metadata.symbolCount);
    assert.ok(fullGraphPayload.graph.nodes.length > 80);
    assert.equal(fullGraphPayload.graph.truncated, false);

    const graphPageResponse = await fetch(`${baseUrl}/graph/${uid}`);
    const graphPage = await graphPageResponse.text();
    assert.match(graphPage, /data-index-uid="[a-f\d]{32}"/u);
    assert.match(graphPage, /id="source-editor"/u);
    assert.match(graphPage, /MONACO/u);
    const graphClientResponse = await fetch(`${baseUrl}/assets/graph-client.js`);
    assert.equal(graphClientResponse.status, 200);
    assert.match(graphClientResponse.headers.get('content-type') ?? '', /javascript/u);
    assert.ok((await graphClientResponse.text()).length > 10_000);
    for (const asset of ['loader.js', 'editor/editor.main.js', 'editor/editor.worker.js']) {
      const monacoAssetResponse = await fetch(`${baseUrl}/assets/monaco/vs/${asset}`);
      assert.equal(monacoAssetResponse.status, 200, `missing Monaco asset ${asset}`);
    }

    const searchResponse = await fetch(`${baseUrl}/api/search?q=authenticate`);
    const searchPayload = await searchResponse.json() as {
      results: Array<{ path: string; excerpt?: string }>;
    };
    assert.equal(searchPayload.results[0]?.path, 'src/auth.ts');
    assert.match(searchPayload.results[0]?.excerpt ?? '', /authenticate/u);
  } finally {
    server.close();
    await once(server, 'close');
    await rm(temporary, { recursive: true, force: true });
  }
});

test('dashboard indexes a submitted GitHub URL and streams progress logs', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-github-dashboard-'));
  const result: GitHubRepositoryIndexResult = {
    owner: 'AcmeOrg',
    repository: 'sample-repo',
    ref: 'main',
    workspacePath: path.join(temporary, '.github-repositories', 'sample-repo'),
    indexPath: path.join(temporary, 'sample-repo.index'),
    uid: 'a'.repeat(32),
    fileCount: 3,
    symbolCount: 5,
    relationCount: 7,
    chunkCount: 3,
    errors: 0
  };
  const server = createDashboardApp(temporary, {
    githubRepositoryIndexer: async (_owner, _repository, _ref, options) => {
      options?.onProgress?.({ stage: 'download', message: 'Downloaded test archive' });
      options?.onProgress?.({ stage: 'parse', current: 1, total: 3, message: 'Parsing files: 1 of 3' });
      return result;
    }
  }).listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const page = await (await fetch(baseUrl)).text();
    assert.match(page, /id="github-form"/u);
    assert.match(page, /id="github-log"/u);
    assert.match(page, /id="github-size"[^>]*step="0\.001"/u);

    const invalidResponse = await fetch(`${baseUrl}/api/github/index`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://not-github.example/acme/repo' })
    });
    assert.equal(invalidResponse.status, 400);

    const startResponse = await fetch(`${baseUrl}/api/github/index`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://github.com/AcmeOrg/sample-repo/tree/main',
        patterns: ['**/tests/**'],
        maxFileSize: 128 * 1024
      })
    });
    assert.equal(startResponse.status, 202);
    const job = await startResponse.json() as { id: string; eventsUrl: string };

    const eventsResponse = await fetch(`${baseUrl}${job.eventsUrl}`);
    assert.match(eventsResponse.headers.get('content-type') ?? '', /text\/event-stream/u);
    const eventStream = await eventsResponse.text();
    assert.match(eventStream, /event: log/u);
    assert.match(eventStream, /Downloaded test archive/u);
    assert.match(eventStream, /Parsing files: 1 of 3/u);
    assert.match(eventStream, /event: completed/u);

    const statusResponse = await fetch(`${baseUrl}/api/github/jobs/${job.id}`);
    const status = await statusResponse.json() as { status: string; result?: GitHubRepositoryIndexResult };
    assert.equal(status.status, 'completed');
    assert.equal(status.result?.uid, result.uid);
  } finally {
    server.close();
    await once(server, 'close');
    await rm(temporary, { recursive: true, force: true });
  }
});

test('dashboard groups repository index parts and searches them as one collection', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-dashboard-group-'));
  const indexDir = path.join(temporary, 'indexes');
  const workspaces = [path.join(temporary, 'part-one'), path.join(temporary, 'part-two')];
  try {
    for (let index = 0; index < workspaces.length; index++) {
      const workspace = workspaces[index]!;
      await mkdir(workspace, { recursive: true });
      await writeFile(path.join(workspace, `part-${index + 1}.ts`), `export function groupedNeedle${index + 1}() { return "combined"; }\n`);
      const manager = await IndexManager.create({
        workspacePath: workspace,
        indexDir,
        partitionId: `dashboard-group-test-${index}`,
        indexGroup: 'acme/repo@main',
        indexLabel: `acme/repo@main · part ${index + 1} of 2`,
        indexPart: index + 1,
        indexPartCount: 2
      });
      await manager.index();
    }

    const server = createDashboardApp(indexDir).listen(0, '127.0.0.1');
    try {
      await once(server, 'listening');
      const address = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const indexPayload = await (await fetch(`${baseUrl}/api/indexes`)).json() as {
        indexes: Array<{ metadata: { indexGroup?: string; indexPart?: number } }>;
      };
      assert.equal(indexPayload.indexes.length, 2);
      assert.ok(indexPayload.indexes.every((item) => item.metadata.indexGroup === 'acme/repo@main'));
      assert.deepEqual(indexPayload.indexes.map((item) => item.metadata.indexPart), [1, 2]);

      const groupedSearch = await (await fetch(`${baseUrl}/api/search?q=combined&group=acme%2Frepo%40main`)).json() as {
        results: Array<{ path: string }>;
      };
      assert.deepEqual(groupedSearch.results.map((result) => result.path).sort(), ['part-1.ts', 'part-2.ts']);
      const limitedSearch = await (await fetch(`${baseUrl}/api/search?q=combined&group=acme%2Frepo%40main&limit=1`)).json() as {
        results: Array<{ path: string }>;
      };
      assert.equal(limitedSearch.results.length, 1);
    } finally {
      server.close();
      await once(server, 'close');
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});