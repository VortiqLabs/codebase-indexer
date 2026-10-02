import express, { type Express } from 'express';
import { Worker } from 'node:worker_threads';
import { indexGitHubRepository } from '../github/GitHubRepositoryIndexer.js';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INDEX_CHECKSUM_SIZE, INDEX_HEADER_SIZE, INDEX_MAGIC, type IndexMetadata, type IndexSnapshot } from '../storage/IndexFormat.js';
import { IndexReader } from '../storage/BinaryIndex.js';
import { detectSensitiveRegions } from '../intelligence/SensitiveDetector.js';
import { DASHBOARD_PAGE } from './DashboardPage.js';
import { GitHubIndexJobs } from './GitHubIndexJobs.js';
import { GRAPH_PAGE } from './GraphPage.js';

const graphClientPath = fileURLToPath(new URL('../../dashboard/graph-client.js', import.meta.url));
const monacoAssetsPath = fileURLToPath(new URL('../../dashboard/monaco', import.meta.url));
const indexWorkerPath = fileURLToPath(new URL('./IndexSnapshotWorker.js', import.meta.url));

export interface DashboardAppOptions {
  githubRepositoryIndexer?: typeof indexGitHubRepository;
}

interface CachedIndex {
  modifiedAt: number;
  size: number;
  summary: DashboardIndexSummary;
}

interface LoadedIndex {
  summary: DashboardIndexSummary;
  fileName: string;
  filePath: string;
}

interface DashboardIndexSummary {
  metadata: IndexMetadata;
  relationKinds: Record<string, number>;
}

const MAX_CACHE_ENTRIES = 100;

export function defaultIndexDirectory(): string {
  return path.join(os.homedir(), '.cache', 'codebase-indexer');
}

export function createDashboardApp(indexDirectory: string, options: DashboardAppOptions = {}): Express {
  const app = express();
  const resolvedDirectory = path.resolve(indexDirectory);
  const cache = new Map<string, CachedIndex>();
  const githubJobs = new GitHubIndexJobs(resolvedDirectory, options.githubRepositoryIndexer);
  app.use(express.json({ limit: '16kb' }));

  app.get('/', (_request, response) => response.type('html').send(DASHBOARD_PAGE));
  app.get('/graph/:uid', (request, response) => {
    if (!/^[a-f\d]{32}$/iu.test(request.params.uid)) {
      response.status(400).send('Invalid index UID');
      return;
    }
    response.type('html').send(GRAPH_PAGE.replace('__INDEX_UID__', request.params.uid));
  });
  app.get('/assets/graph-client.js', (_request, response) => response.sendFile(graphClientPath));
  app.use('/assets/monaco', express.static(monacoAssetsPath));

  app.get('/api/system/memory', (_request, response) => {
    const mem = process.memoryUsage();
    response.json({
      rssMb: Math.round(mem.rss / (1024 * 1024)),
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
      externalMb: Math.round(mem.external / (1024 * 1024)),
      cacheSize: cache.size
    });
  });

  app.post('/api/github/index', (request, response) => {
    try {
      const body = request.body as Record<string, unknown>;
      const repository = parseGitHubUrl(body.url);
      const ref = typeof body.ref === 'string' && body.ref.trim() ? body.ref.trim() : repository.ref ?? 'HEAD';
      const patterns = parseIgnorePatterns(body.patterns);
      const maxFileSize = parseMaxFileSize(body.maxFileSize);
      const job = githubJobs.start(repository.owner, repository.repository, {
        ref,
        ...(patterns.length ? { patterns } : {}),
        ...(maxFileSize ? { maxFileSize } : {})
      });
      response.status(202).json({ ...job, eventsUrl: `/api/github/jobs/${job.id}/events` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      response.status(message.includes('already running') ? 409 : 400).json({ error: message });
    }
  });

  app.get('/api/github/jobs/:jobId', (request, response) => {
    const job = githubJobs.get(request.params.jobId);
    if (!job) {
      response.status(404).json({ error: 'GitHub indexing job not found' });
      return;
    }
    response.json(job);
  });

  app.get('/api/github/jobs/:jobId/events', (request, response) => {
    if (!githubJobs.get(request.params.jobId)) {
      response.status(404).json({ error: 'GitHub indexing job not found' });
      return;
    }
    response.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    response.flushHeaders();
    const lastEventHeader = request.get('last-event-id') ?? request.query.after;
    const afterEventId = typeof lastEventHeader === 'string' && /^\d+$/u.test(lastEventHeader) ? Number(lastEventHeader) : 0;
    const unsubscribe = githubJobs.subscribe(request.params.jobId, (event) => {
      response.write(`id: ${event.id}\nevent: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
      if (event.event === 'completed' || event.event === 'failed') response.end();
    }, afterEventId);
    const heartbeat = response.writableEnded ? undefined : setInterval(() => response.write(': keepalive\n\n'), 15_000);
    response.on('close', () => {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    });
  });

  app.get('/api/indexes', async (_request, response) => {
    const { indexes, errors } = await loadIndexes(resolvedDirectory, cache);
    response.json({
      indexes: indexes.map(({ summary, fileName }) => ({
        fileName,
        metadata: summary.metadata,
        relationKinds: summary.relationKinds
      })),
      errors
    });
  });

  app.get('/api/indexes/:uid', async (request, response) => {
    const uid = request.params.uid;
    if (!/^[a-f\d]{32}$/iu.test(uid)) {
      response.status(400).json({ error: 'Invalid index UID' });
      return;
    }
    const { indexes } = await loadIndexes(resolvedDirectory, cache);
    const loaded = indexes.find(({ summary }) => summary.metadata.uid === uid);
    if (!loaded) {
      response.status(404).json({ error: 'Index not found' });
      return;
    }
    response.json({
      metadata: loaded.summary.metadata,
      graph: await runIndexWorker(loaded.filePath, { operation: 'graph', all: request.query.all === 'true' })
    });
  });

  app.get('/api/indexes/:uid/export', async (request, response) => {
    const uid = request.params.uid;
    if (!/^[a-f\d]{32}$/iu.test(uid)) {
      response.status(400).json({ error: 'Invalid index UID' });
      return;
    }
    const { indexes } = await loadIndexes(resolvedDirectory, cache);
    const loaded = indexes.find(({ summary }) => summary.metadata.uid === uid);
    if (!loaded) {
      response.status(404).json({ error: 'Index not found' });
      return;
    }
    const snapshot = await IndexReader.read(loaded.filePath, uid);
    const format = typeof request.query.format === 'string' ? request.query.format.toLowerCase() : 'json';

    if (format === 'csv') {
      const csvRows = ['Name,Kind,FilePath,StartLine,EndLine'];
      for (const sym of snapshot.symbols) {
        csvRows.push(`"${sym.name.replace(/"/g, '""')}","${sym.kind}","${sym.filePath.replace(/"/g, '""')}",${sym.startLine},${sym.endLine}`);
      }
      response.setHeader('Content-Type', 'text/csv');
      response.setHeader('Content-Disposition', `attachment; filename="${uid}-symbols.csv"`);
      response.send(csvRows.join('\n'));
      return;
    }

    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Content-Disposition', `attachment; filename="${uid}-export.json"`);
    response.json({
      metadata: snapshot.metadata,
      files: snapshot.files.map(f => ({ path: f.path, language: f.language, size: f.size })),
      symbols: snapshot.symbols,
      relations: snapshot.relations
    });
  });

  app.get('/api/indexes/:uid/intelligence', async (request, response) => {
    const uid = request.params.uid;
    if (!/^[a-f\d]{32}$/iu.test(uid)) {
      response.status(400).json({ error: 'Invalid index UID' });
      return;
    }
    const { indexes } = await loadIndexes(resolvedDirectory, cache);
    const loaded = indexes.find(({ summary }) => summary.metadata.uid === uid);
    if (!loaded) {
      response.status(404).json({ error: 'Index not found' });
      return;
    }
    response.json(await runIndexWorker(loaded.filePath, { operation: 'intelligence' }));
  });

  app.get('/api/indexes/:uid/files', async (request, response) => {
    const uid = request.params.uid;
    if (!/^[a-f\d]{32}$/iu.test(uid)) {
      response.status(400).json({ error: 'Invalid index UID' });
      return;
    }
    const { indexes } = await loadIndexes(resolvedDirectory, cache);
    const loaded = indexes.find(({ summary }) => summary.metadata.uid === uid);
    if (!loaded) {
      response.status(404).json({ error: 'Index not found' });
      return;
    }
    const snapshot = await IndexReader.read(loaded.filePath, uid);
    const query = typeof request.query.q === 'string' ? request.query.q.trim().toLowerCase() : '';
    const language = typeof request.query.language === 'string' ? request.query.language : undefined;
    const files = snapshot.files.filter((file) => {
      if (language && file.language !== language) return false;
      if (!query) return true;
      return file.path.toLowerCase().includes(query) || file.language.toLowerCase().includes(query) || file.terms.some((term) => term.toLowerCase().includes(query));
    });
    response.json({ files });
  });

  app.get('/api/indexes/:uid/symbols', async (request, response) => {
    const uid = request.params.uid;
    if (!/^[a-f\d]{32}$/iu.test(uid)) {
      response.status(400).json({ error: 'Invalid index UID' });
      return;
    }
    const { indexes } = await loadIndexes(resolvedDirectory, cache);
    const loaded = indexes.find(({ summary }) => summary.metadata.uid === uid);
    if (!loaded) {
      response.status(404).json({ error: 'Index not found' });
      return;
    }
    const snapshot = await IndexReader.read(loaded.filePath, uid);
    const query = typeof request.query.q === 'string' ? request.query.q.trim().toLowerCase() : '';
    const filtered = query
      ? snapshot.symbols.filter((symbol) => symbol.name.toLowerCase().includes(query) || symbol.filePath.toLowerCase().includes(query))
      : snapshot.symbols;
    response.json({ symbols: filtered });
  });

  app.get('/api/indexes/:uid/security', async (request, response) => {
    const uid = request.params.uid;
    if (!/^[a-f\d]{32}$/iu.test(uid)) {
      response.status(400).json({ error: 'Invalid index UID' });
      return;
    }
    const { indexes } = await loadIndexes(resolvedDirectory, cache);
    const loaded = indexes.find(({ summary }) => summary.metadata.uid === uid);
    if (!loaded) {
      response.status(404).json({ error: 'Index not found' });
      return;
    }
    const snapshot = await IndexReader.read(loaded.filePath, uid);
    response.json({ findings: await detectSensitiveRegions(snapshot) });
  });

  app.get('/api/indexes/:uid/inspect', async (request, response) => {
    const uid = request.params.uid;
    if (!/^[a-f\d]{32}$/iu.test(uid)) {
      response.status(400).json({ error: 'Invalid index UID' });
      return;
    }
    const { indexes } = await loadIndexes(resolvedDirectory, cache);
    const loaded = indexes.find(({ summary }) => summary.metadata.uid === uid);
    if (!loaded) {
      response.status(404).json({ error: 'Index not found' });
      return;
    }
    const buffer = await readFile(loaded.filePath);
    const magic = buffer.subarray(0, INDEX_MAGIC.length).toString('ascii');
    const version = buffer.readUInt16BE(8);
    const flags = buffer.readUInt16BE(10);
    const uidLength = buffer.readUInt16BE(12);
    const payloadLength = Number(buffer.readBigUInt64BE(14));
    const headerSize = INDEX_HEADER_SIZE;
    const checksumSize = INDEX_CHECKSUM_SIZE;
    const bodyLength = headerSize + uidLength + payloadLength;
    const snapshot = await IndexReader.read(loaded.filePath, uid);
    response.json({
      filePath: loaded.filePath,
      magic,
      version,
      flags,
      uid,
      headerSize,
      uidLength,
      payloadLength,
      bodyLength,
      checksumSize,
      fileSize: buffer.length,
      sections: [
        { name: 'header', size: headerSize },
        { name: 'uid', size: uidLength },
        { name: 'payload', size: payloadLength },
        { name: 'checksum', size: checksumSize }
      ],
      snapshot: {
        metadata: snapshot.metadata,
        fileCount: snapshot.files.length,
        symbolCount: snapshot.symbols.length,
        relationCount: snapshot.relations.length,
        chunkCount: snapshot.chunks.length,
        vectorCount: snapshot.vectors.length
      }
    });
  });

  app.get('/api/indexes/:uid/source', async (request, response) => {
    const uid = request.params.uid;
    const relativeFilePath = typeof request.query.path === 'string' ? request.query.path : '';
    if (!/^[a-f\d]{32}$/iu.test(uid) || !relativeFilePath) {
      response.status(400).json({ error: 'A valid index UID and file path are required' });
      return;
    }
    const { indexes } = await loadIndexes(resolvedDirectory, cache);
    const loaded = indexes.find(({ summary }) => summary.metadata.uid === uid);
    if (!loaded) {
      response.status(404).json({ error: 'Index not found' });
      return;
    }
    const indexedFile = await runIndexWorker<{ path: string; language: string } | undefined>(loaded.filePath, {
      operation: 'file',
      relativeFilePath
    });
    if (!indexedFile) {
      response.status(404).json({ error: 'File is not part of this index' });
      return;
    }
    const workspaceRoot = await realpath(loaded.summary.metadata.workspaceRoot);
    const candidatePath = path.resolve(workspaceRoot, indexedFile.path);
    if (!isPathInside(workspaceRoot, candidatePath)) {
      response.status(403).json({ error: 'File path is outside the indexed workspace' });
      return;
    }
    const actualPath = await realpath(candidatePath);
    if (!isPathInside(workspaceRoot, actualPath)) {
      response.status(403).json({ error: 'File resolves outside the indexed workspace' });
      return;
    }
    response.json({
      path: indexedFile.path,
      language: indexedFile.language,
      content: await readFile(actualPath, 'utf8')
    });
  });

  app.get('/api/search', async (request, response) => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim() : '';
    const indexUid = typeof request.query.index === 'string' ? request.query.index : undefined;
    const indexGroup = typeof request.query.group === 'string' ? request.query.group : undefined;
    const language = typeof request.query.language === 'string' && request.query.language ? request.query.language : undefined;
    const requestedLimit = typeof request.query.limit === 'string' ? Number(request.query.limit) : 50;
    const limit = Number.isSafeInteger(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 50;
    const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}_$.-]+/gu) ?? [])];
    if (terms.length === 0) {
      response.json({ results: [] });
      return;
    }

    const { indexes } = await loadIndexes(resolvedDirectory, cache);
    let results: Array<{ uid: string; workspace: string; path: string; language: string; score: number; excerpt?: string }> = [];
    for (const loaded of indexes) {
      if (indexUid && loaded.summary.metadata.uid !== indexUid) continue;
      if (indexGroup && dashboardIndexGroup(loaded.summary.metadata) !== indexGroup) continue;
      const indexResults = await runIndexWorker<typeof results>(loaded.filePath, { operation: 'search', query, limit });
      results.push(...indexResults);
    }
    if (language) {
      results = results.filter(r => r.language === language);
    }
    results.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
    response.json({ results: results.slice(0, limit) });
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Dashboard request failed' });
  });

  return app;
}

async function loadIndexes(
  indexDirectory: string,
  cache: Map<string, CachedIndex>
): Promise<{ indexes: LoadedIndex[]; errors: Array<{ fileName: string; message: string }> }> {
  let entries;
  try {
    entries = await readdir(indexDirectory, { withFileTypes: true });
  } catch (error) {
    if (isMissingFile(error)) return { indexes: [], errors: [] };
    throw error;
  }

  const indexFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.index'));
  const presentPaths = new Set(indexFiles.map((entry) => path.join(indexDirectory, entry.name)));
  for (const cachedPath of cache.keys()) {
    if (!presentPaths.has(cachedPath)) cache.delete(cachedPath);
  }

  const indexes: LoadedIndex[] = [];
  const errors: Array<{ fileName: string; message: string }> = [];
  for (const entry of indexFiles) {
    const filePath = path.join(indexDirectory, entry.name);
    try {
      const fileStats = await stat(filePath);
      const cached = cache.get(filePath);
      let summary: DashboardIndexSummary;
      if (cached && cached.modifiedAt === fileStats.mtimeMs && cached.size === fileStats.size) {
        summary = cached.summary;
      } else {
        summary = await runIndexWorker<DashboardIndexSummary>(filePath, { operation: 'summary' });
        if (cache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey !== undefined) cache.delete(oldestKey);
        }
        cache.set(filePath, { modifiedAt: fileStats.mtimeMs, size: fileStats.size, summary });
      }
      indexes.push({ summary, fileName: entry.name, filePath });
    } catch (error) {
      cache.delete(filePath);
      errors.push({ fileName: entry.name, message: error instanceof Error ? error.message : String(error) });
    }
  }
  indexes.sort((left, right) => left.summary.metadata.workspaceRoot.localeCompare(right.summary.metadata.workspaceRoot));
  return { indexes, errors };
}

function isPathInside(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate);
  return relativePath !== '' && relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath);
}

interface IndexWorkerRequest {
  operation: 'summary' | 'graph' | 'search' | 'file' | 'intelligence';
  all?: boolean;
  query?: string;
  limit?: number;
  relativeFilePath?: string;
}

function runIndexWorker<T>(filePath: string, request: IndexWorkerRequest): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const worker = new Worker(indexWorkerPath, {
      workerData: { ...request, filePath },
      resourceLimits: { maxOldGenerationSizeMb: 1024, maxYoungGenerationSizeMb: 128 }
    });
    let settled = false;
    worker.once('message', (message: { ok: boolean; value?: T; error?: string }) => {
      settled = true;
      if (message.ok) resolve(message.value as T);
      else reject(new Error(message.error ?? 'Index worker failed'));
    });
    worker.once('error', (error) => {
      settled = true;
      reject(error);
    });
    worker.once('exit', (code) => {
      if (!settled && code !== 0) reject(new Error(`Index worker exited with code ${code}; the index may exceed its 1 GB memory limit`));
      else if (!settled) reject(new Error('Index worker exited without returning a result'));
    });
  });
}

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function dashboardIndexGroup(metadata: IndexMetadata): string | undefined {
  if (metadata.indexGroup) return metadata.indexGroup;
  const label = metadata.indexLabel;
  if (!label) return undefined;
  const groupedLabel = label.replace(/\s+·\s+part\s+\d+\s+of\s+\d+$/iu, '');
  return groupedLabel === label ? undefined : groupedLabel;
}

function parseGitHubUrl(value: unknown): { owner: string; repository: string; ref?: string } {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Enter a GitHub repository URL');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid GitHub repository URL');
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com' || url.username || url.password) {
    throw new Error('Repository URL must use https://github.com');
  }
  const parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
  if (parts.length < 2) throw new Error('GitHub URL must include an owner and repository');
  const owner = parts[0]!;
  const repository = parts[1]!.replace(/\.git$/iu, '');
  if (parts.length === 2) return { owner, repository };
  if (parts[2] === 'tree' && parts[3]) return { owner, repository, ref: parts[3] };
  throw new Error('Use a repository URL or a /tree/<branch> URL');
}

function parseIgnorePatterns(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50 || value.some((item) => typeof item !== 'string' || item.length > 300)) {
    throw new Error('Ignore patterns must be up to 50 strings of 300 characters or fewer');
  }
  return value.map((pattern) => pattern.trim()).filter(Boolean);
}

function parseMaxFileSize(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const size = Number(value);
  if (!Number.isSafeInteger(size) || size < 1024 || size > 100 * 1024 * 1024) {
    throw new Error('Maximum file size must be between 1 KB and 100 MB');
  }
  return size;
}