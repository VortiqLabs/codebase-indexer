import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as tar from 'tar';
import { IndexManager } from '../src/core/IndexManager.js';
import { indexGitHubRepository } from '../src/github/GitHubRepositoryIndexer.js';
import { IndexReader } from '../src/storage/BinaryIndex.js';

test('GitHub archive indexing supports private tokens and public repositories', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-github-test-'));
  const archiveRoot = path.join(temporary, 'archive-root');
  const repositoryRoot = path.join(archiveRoot, 'sample-repository');
  const archivePath = path.join(temporary, 'repository.tar.gz');
  const indexDir = path.join(temporary, 'indexes');
  try {
    await mkdir(repositoryRoot, { recursive: true });
    await mkdir(indexDir, { recursive: true });
    await writeFile(path.join(repositoryRoot, 'src.ts'), 'export function githubSample() { return 42; }\n');
    await tar.c({ gzip: true, file: archivePath, cwd: archiveRoot }, ['sample-repository']);
    const archive = await readFile(archivePath);
    const apiRequests: Array<{ url: string; authorization: string | null }> = [];
    const archiveAuthorizations: Array<string | null> = [];
    const progressStages: string[] = [];
    const fetchImplementation: typeof fetch = async (_input, init) => {
      const url = String(_input);
      const authorization = new Headers(init?.headers).get('authorization');
      if (url.startsWith('https://api.github.com/')) {
        apiRequests.push({ url, authorization });
        return new Response(null, {
          status: 302,
          headers: { location: 'https://codeload.github.com/AcmeOrg/sample-repository/legacy.tar.gz/fixture' }
        });
      }
      archiveAuthorizations.push(authorization);
      return new Response(archive, { status: 200, headers: { 'content-type': 'application/gzip' } });
    };

    const privateResult = await indexGitHubRepository('AcmeOrg', 'private-repo', 'feature/work', {
      indexDir,
      token: 'private-test-token',
      fetchImplementation,
      onProgress: (progress) => progressStages.push(progress.stage)
    });
    assert.equal(privateResult.fileCount, 1);
    assert.equal(privateResult.symbolCount, 1);
    assert.match(privateResult.workspacePath, /\.github-repositories/u);
    for (const stage of ['download', 'extract', 'scan', 'parse', 'relations', 'persist', 'complete']) {
      assert.ok(progressStages.includes(stage), `missing ${stage} progress`);
    }

    const publicResult = await indexGitHubRepository('AcmeOrg', 'public-repo', 'main', {
      indexDir,
      token: '',
      fetchImplementation
    });
    assert.equal(publicResult.fileCount, 1);

    const defaultBranchResult = await indexGitHubRepository('AcmeOrg', 'default-branch-repo', 'HEAD', {
      indexDir,
      token: '',
      fetchImplementation
    });
    assert.equal(defaultBranchResult.fileCount, 1);
    assert.equal(apiRequests[0]?.authorization, 'Bearer private-test-token');
    assert.equal(apiRequests[1]?.authorization, null);
    assert.ok(apiRequests[1]?.url.endsWith('/repos/AcmeOrg/public-repo/tarball/main'));
    assert.ok(apiRequests[2]?.url.endsWith('/repos/AcmeOrg/default-branch-repo/tarball'));
    assert.ok(archiveAuthorizations.every((authorization) => authorization === null));

    const manager = await IndexManager.create({ workspacePath: publicResult.workspacePath, indexDir });
    const snapshot = await manager.read();
    assert.ok(snapshot.symbols.some((symbol) => symbol.name === 'githubSample'));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('large GitHub repositories are split into isolated bounded index parts', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-github-parts-'));
  const archiveRoot = path.join(temporary, 'archive-root');
  const repositoryRoot = path.join(archiveRoot, 'large-repository');
  const archivePath = path.join(temporary, 'large-repository.tar.gz');
  const indexDir = path.join(temporary, 'indexes');
  try {
    await mkdir(repositoryRoot, { recursive: true });
    await mkdir(indexDir, { recursive: true });
    for (let index = 0; index < 251; index++) {
      await writeFile(path.join(repositoryRoot, `file-${index.toString().padStart(3, '0')}.txt`), `small source file ${index}\n`);
    }
    await tar.c({ gzip: true, file: archivePath, cwd: archiveRoot }, ['large-repository']);
    const archive = await readFile(archivePath);
    const fetchImplementation: typeof fetch = async (_input, init) => {
      if (new Headers(init?.headers).get('authorization')) return new Response(null, { status: 403 });
      return new Response(archive, { status: 200 });
    };

    const result = await indexGitHubRepository('AcmeOrg', 'large-repository', 'main', {
      indexDir,
      token: '',
      fetchImplementation
    });

    assert.equal(result.fileCount, 251);
    assert.equal(result.parts?.length, 3);
    assert.deepEqual(result.parts?.map((part) => part.fileCount), [100, 100, 51]);
    assert.notEqual(result.parts?.[0]?.uid, result.parts?.[1]?.uid);
    assert.match(result.parts?.[0]?.indexLabel ?? '', /part 1 of 3/u);
    assert.equal((await readdir(indexDir)).filter((file) => file.endsWith('.index')).length, 3);
    const snapshots = await Promise.all(result.parts!.map((part) => IndexReader.read(part.indexPath, part.uid)));
    assert.deepEqual(snapshots.map((snapshot) => snapshot.files.length), [100, 100, 51]);
    assert.match(snapshots[2]!.metadata.indexLabel ?? '', /part 3 of 3/u);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});