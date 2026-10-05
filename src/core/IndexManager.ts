import { createHash } from 'node:crypto';
import { readFile, realpath, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileScanner, type FileScannerOptions } from '../scanner/FileScanner.js';
import { TreeSitterParser } from '../parser/TreeSitterParser.js';
import { SemanticChunker } from '../chunks/SemanticChunker.js';
import { IndexReader, IndexWriter } from '../storage/BinaryIndex.js';
import { StagingDatabase } from '../storage/StagingDatabase.js';
import { INDEX_FORMAT_VERSION, type IndexMetadata, type IndexSnapshot } from '../storage/IndexFormat.js';
import type { CodeChunk } from '../types/CodeChunk.js';
import type { FileRecord } from '../types/FileRecord.js';
import type { RelationRecord } from '../types/Relation.js';
import type { SymbolRecord } from '../types/Symbol.js';
import type { VectorRecord } from '../types/VectorRecord.js';
import type { EmbeddingProvider } from '../embeddings/EmbeddingProvider.js';
import { EmbeddingQueue } from '../embeddings/EmbeddingQueue.js';
import { detectApiEndpoints, type ApiEndpoint } from '../intelligence/ApiDetector.js';
import { findDependencyRelations, findSymbolPath, findGraphCycles, type GraphQueryOptions, type GraphPathResult, type GraphCycle } from '../intelligence/GraphQuery.js';
import { buildRepositoryMap, type RepositoryMap } from '../intelligence/RepositoryMap.js';
import { classifyQuery, type QueryIntent } from '../intelligence/QueryIntent.js';
import { detectSensitiveRegions, type SensitiveRegion } from '../intelligence/SensitiveDetector.js';
import { analyzeImpact, type ImpactAnalysisResult } from '../intelligence/ImpactAnalyzer.js';
import { findTests, findAffectedTests, type TestMapping } from '../intelligence/TestAnalyzer.js';
import { analyzeDatabaseSchema, type DatabaseModelInfo } from '../intelligence/DatabaseAnalyzer.js';
import { getGitHistory, type GitHistoryResult } from '../intelligence/GitHistory.js';
import { analyzeChangeCoupling, detectHotspots, type FileChangeCoupling, type Hotspot } from '../intelligence/ChangeAnalyzer.js';
import { analyzeComplexity, type FileComplexity } from '../intelligence/ComplexityAnalyzer.js';
import { detectDuplicates, type DuplicateMatch } from '../intelligence/DuplicateDetector.js';
import { explainSymbol, type SymbolExplanation } from '../intelligence/ExplainSymbol.js';

export interface IndexManagerOptions extends FileScannerOptions {
  workspacePath: string;
  indexDir?: string;
  partitionId?: string;
  indexLabel?: string;
  indexGroup?: string;
  indexPart?: number;
  indexPartCount?: number;
  embeddingProvider?: EmbeddingProvider;
  workers?: number;
  memoryLimitMb?: number;
  verboseMemory?: boolean;
  noEmbeddings?: boolean;
  profile?: 'default' | 'large';
}

export interface IndexUpdateResult {
  indexPath: string;
  snapshot: IndexSnapshot;
  added: number;
  changed: number;
  unchanged: number;
  deleted: number;
  errors: number;
}

export interface IndexProgress {
  stage: 'scan' | 'parse' | 'relations' | 'embedding' | 'persist' | 'complete';
  message: string;
  current?: number;
  total?: number;
}

export class IndexManager {
  readonly workspacePath: string;
  readonly uid: string;
  readonly indexPath: string;
  private readonly options: IndexManagerOptions;
  private readonly parser = new TreeSitterParser();
  private readonly chunker = new SemanticChunker();
  private readonly embeddingQueue = new EmbeddingQueue();

  private constructor(options: IndexManagerOptions, workspacePath: string, uid: string, indexPath: string) {
    this.options = options;
    this.workspacePath = workspacePath;
    this.uid = uid;
    this.indexPath = indexPath;
  }

  static async create(options: IndexManagerOptions): Promise<IndexManager> {
    const workspacePath = await realpath(options.workspacePath);
    const uid = createHash('sha256')
      .update(options.partitionId ? `${workspacePath}\0${options.partitionId}` : workspacePath)
      .digest('hex').slice(0, 32);
    const indexDir = options.indexDir ?? path.join(os.homedir(), '.cache', 'codebase-indexer');
    return new IndexManager(options, workspacePath, uid, path.join(path.resolve(indexDir), `${uid}.index`));
  }

  async index(force = false, onProgress?: (progress: IndexProgress) => void): Promise<IndexUpdateResult> {
    const isLarge = this.options.profile === 'large';
    const numWorkers = Math.max(1, this.options.workers ?? 2);
    const memoryLimit = (this.options.memoryLimitMb ?? 4096) * 1024 * 1024;
    const verboseMem = this.options.verboseMemory ?? isLarge;
    const skipEmbeddings = this.options.noEmbeddings ?? (isLarge && !this.options.embeddingProvider);

    const stagingDbPath = `${this.indexPath}.staging.db`;
    await rm(stagingDbPath, { force: true });
    const db = new StagingDatabase(stagingDbPath);

    let previous: IndexSnapshot | undefined;
    if (!force) {
      try {
        previous = await IndexReader.read(this.indexPath, this.uid);
      } catch (error) {
        if (!isMissingFile(error)) throw error;
      }
    }

    const previousFilesMap = new Map(previous?.files.map((f) => [f.path, f]) ?? []);

    const scanner = await FileScanner.create(this.workspacePath, this.options);
    onProgress?.({ stage: 'scan', message: `Scanning ${this.workspacePath}` });

    let added = 0;
    let changed = 0;
    let unchanged = 0;
    let parseErrors = 0;

    const workQueue: Array<{ file: FileRecord }> = [];
    const resultQueue: Array<{
      file: FileRecord;
      symbols: SymbolRecord[];
      relations: RelationRecord[];
      chunks: CodeChunk[];
    }> = [];

    let discoveryDone = false;
    let writerDone = false;

    const writerPromise = (async () => {
      while (!writerDone || resultQueue.length > 0) {
        if (resultQueue.length === 0) {
          await new Promise((r) => setTimeout(r, 10));
          continue;
        }
        const batch = resultQueue.splice(0, 32);
        db.insertFilesBatch(batch.map((b) => b.file));
        db.insertSymbolsBatch(batch.flatMap((b) => b.symbols));
        db.insertRelationsBatch(batch.flatMap((b) => b.relations));
        db.insertChunksBatch(batch.flatMap((b) => b.chunks));
      }
    })();

    const processFile = async (item: { file: FileRecord }) => {
      const { file } = item;
      try {
        const source = await readFile(path.join(this.workspacePath, file.path), 'utf8');
        const terms = [...new Set(source.match(/[\p{L}\p{N}_$.-]+/gu)?.map((t) => t.toLowerCase()) ?? [])];
        const fileWithTerms = { ...file, terms };
        const parsed = await this.parser.parse(file.path, source, file.language);
        if (parsed) {
          resultQueue.push({
            file: fileWithTerms,
            symbols: parsed.symbols,
            relations: parsed.relations,
            chunks: parsed.chunks.length > 0 ? parsed.chunks : this.chunker.chunk(file.path, source)
          });
        } else {
          resultQueue.push({
            file: fileWithTerms,
            symbols: [],
            relations: [],
            chunks: this.chunker.chunk(file.path, source)
          });
        }
      } catch {
        parseErrors++;
        try {
          const source = await readFile(path.join(this.workspacePath, file.path), 'utf8');
          const terms = [...new Set(source.match(/[\p{L}\p{N}_$.-]+/gu)?.map((t) => t.toLowerCase()) ?? [])];
          resultQueue.push({
            file: { ...file, terms },
            symbols: [],
            relations: [],
            chunks: this.chunker.chunk(file.path, source)
          });
        } catch {
          parseErrors++;
        }
      }
    };

    let parsedCount = 0;
    const workerLoop = async () => {
      while (!discoveryDone || workQueue.length > 0) {
        if (workQueue.length === 0) {
          await new Promise((r) => setTimeout(r, 10));
          continue;
        }

        while (resultQueue.length >= 32) {
          await new Promise((r) => setTimeout(r, 10));
        }

        const mem = process.memoryUsage();
        if (mem.rss > memoryLimit || mem.heapUsed > memoryLimit * 0.9) {
          if (global.gc) global.gc();
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }

        const task = workQueue.shift();
        if (!task) continue;

        await processFile(task);

        parsedCount++;
        if (parsedCount === 1 || parsedCount % 250 === 0) {
          onProgress?.({
            stage: 'parse',
            current: parsedCount,
            message: `Parsing files: ${parsedCount.toLocaleString()}`
          });
        }
        if (verboseMem && parsedCount % 500 === 0) {
          const curMem = process.memoryUsage();
          console.log(`[MEM] files=${parsedCount} rss=${Math.round(curMem.rss / 1024 / 1024)}MB heap=${Math.round(curMem.heapUsed / 1024 / 1024)}MB external=${Math.round(curMem.external / 1024 / 1024)}MB`);
        }
      }
    };

    const workerPromises = Array.from({ length: numWorkers }, () => workerLoop());

    for await (const item of scanner.discoverFiles()) {
      if (item.status === 'accepted' && item.file) {
        const oldFile = previousFilesMap.get(item.file.path);
        previousFilesMap.delete(item.file.path);
        if (oldFile?.hash === item.file.hash) {
          unchanged++;
          db.insertFilesBatch([oldFile]);
          if (previous) {
            const fileSymbols = previous.symbols.filter((s) => s.filePath === oldFile.path);
            const fileRelations = previous.relations.filter((r) => r.filePath === oldFile.path);
            const fileChunks = previous.chunks.filter((c) => c.filePath === oldFile.path);
            const fileChunkIds = new Set(fileChunks.map((c) => c.id));
            const fileVectors = previous.vectors.filter((v) => fileChunkIds.has(v.chunkId));

            db.insertSymbolsBatch(fileSymbols);
            db.insertRelationsBatch(fileRelations);
            db.insertChunksBatch(fileChunks);
            if (fileVectors.length > 0) {
              db.insertVectorsBatch(fileVectors);
            }
          }
        } else {
          if (oldFile) changed++;
          else added++;

          while (workQueue.length >= 32) {
            await new Promise((r) => setTimeout(r, 10));
          }
          workQueue.push({ file: item.file });
        }
      }
    }

    discoveryDone = true;
    await Promise.all(workerPromises);

    writerDone = true;
    await writerPromise;

    const deleted = previousFilesMap.size;

    onProgress?.({ stage: 'relations', message: 'Resolving relations' });
    db.resolveRelations();

    const provider = this.options.embeddingProvider;
    if (!skipEmbeddings && provider) {
      const providerId = provider.id ?? provider.constructor.name;
      const existingVectorChunkIds = new Set(
        (db.db.prepare('SELECT chunkId FROM vectors').all() as Array<{ chunkId: string }>).map((row) => row.chunkId)
      );
      for (const batch of db.streamChunks(200)) {
        const chunkBatch = batch as CodeChunk[];
        const missingInBatch = chunkBatch.filter((c) => !existingVectorChunkIds.has(c.id));
        if (missingInBatch.length > 0) {
          const uniqueMissing = [...new Map(missingInBatch.map((c) => [c.hash, c])).values()];
          const vectors = await this.embeddingQueue.embed(provider, uniqueMissing as CodeChunk[], providerId);
          db.insertVectorsBatch(vectors);
        }
      }
    }

    const now = new Date().toISOString();
    const counts = db.getCounts();

    const metadata: IndexMetadata = {
      uid: this.uid,
      workspaceRoot: this.workspacePath,
      formatVersion: INDEX_FORMAT_VERSION,
      indexerVersion: '0.1.0',
      createdAt: previous?.metadata.createdAt ?? now,
      updatedAt: now,
      fileCount: counts.files,
      symbolCount: counts.symbols,
      relationCount: counts.relations,
      chunkCount: counts.chunks,
      vectorCount: counts.vectors,
      ...(provider ? { embeddingProvider: provider.id ?? provider.constructor.name, embeddingDimensions: provider.dimensions() } : {}),
      ...(this.options.indexLabel ? { indexLabel: this.options.indexLabel } : {}),
      ...(this.options.indexGroup ? { indexGroup: this.options.indexGroup } : {}),
      ...(this.options.indexPart ? { indexPart: this.options.indexPart } : {}),
      ...(this.options.indexPartCount ? { indexPartCount: this.options.indexPartCount } : {}),
      configurationHash: createHash('sha256').update(JSON.stringify({
        maxFileSize: this.options.maxFileSize ?? 5 * 1024 * 1024,
        patterns: this.options.patterns ?? [],
        partitionId: this.options.partitionId,
        includeFiles: this.options.includeFiles
      })).digest('hex')
    };

    db.setMetadata(metadata);

    onProgress?.({ stage: 'persist', message: 'Writing binary index atomically' });
    await IndexWriter.writeAtomicFromDatabase(this.indexPath, db);

    const snapshot = (isLarge || counts.symbols > 100000)
      ? { metadata, files: [], symbols: [], relations: [], chunks: [], vectors: [] }
      : db.toSnapshot();
    db.close();
    await rm(stagingDbPath, { force: true });

    onProgress?.({ stage: 'complete', current: counts.files, total: counts.files, message: 'Indexing complete' });
    return { indexPath: this.indexPath, snapshot, added, changed, unchanged, deleted, errors: parseErrors };
  }

  async generateEmbeddings(provider?: EmbeddingProvider, onProgress?: (progress: IndexProgress) => void): Promise<number> {
    const embedProvider = provider ?? this.options.embeddingProvider;
    if (!embedProvider) {
      throw new Error('No embedding provider configured. Specify an embedding provider to generate embeddings.');
    }
    const dimensions = embedProvider.dimensions();
    const providerId = embedProvider.id ?? embedProvider.constructor.name;

    const stagingDbPath = `${this.indexPath}.staging.db`;
    await rm(stagingDbPath, { force: true });
    const db = new StagingDatabase(stagingDbPath);

    let previous: IndexSnapshot | undefined;
    try {
      previous = await IndexReader.read(this.indexPath, this.uid);
    } catch (error) {
      db.close();
      await rm(stagingDbPath, { force: true });
      throw new Error(`Cannot generate embeddings: no valid index found at ${this.indexPath}`);
    }

    db.setMetadata(previous.metadata);
    db.insertFilesBatch(previous.files);
    db.insertSymbolsBatch(previous.symbols);
    db.insertRelationsBatch(previous.relations);
    db.insertChunksBatch(previous.chunks);
    db.insertVectorsBatch(previous.vectors);

    const existingVectorChunkIds = new Set(previous.vectors.map((v) => v.chunkId));
    let addedVectors = 0;

    for (const batch of db.streamChunks(200)) {
      const chunkBatch = batch as CodeChunk[];
      const missingInBatch = chunkBatch.filter((c) => !existingVectorChunkIds.has(c.id));
      if (missingInBatch.length > 0) {
        const uniqueMissing = [...new Map(missingInBatch.map((c) => [c.hash, c])).values()];
        const vectors = await this.embeddingQueue.embed(embedProvider, uniqueMissing as CodeChunk[], providerId);
        db.insertVectorsBatch(vectors);
        addedVectors += vectors.length;
        onProgress?.({
          stage: 'embedding',
          current: addedVectors,
          total: previous.chunks.length,
          message: `Generated embeddings: ${addedVectors.toLocaleString()}`
        });
      }
    }

    const counts = db.getCounts();
    const metadata: IndexMetadata = {
      ...previous.metadata,
      vectorCount: counts.vectors,
      embeddingProvider: providerId,
      embeddingDimensions: dimensions,
      updatedAt: new Date().toISOString()
    };
    db.setMetadata(metadata);

    await IndexWriter.writeAtomicFromDatabase(this.indexPath, db);
    db.close();
    await rm(stagingDbPath, { force: true });

    return counts.vectors;
  }

  async read(): Promise<IndexSnapshot> {
    return IndexReader.read(this.indexPath, this.uid);
  }

  async remove(): Promise<boolean> {
    try {
      await rm(this.indexPath);
      return true;
    } catch (error) {
      if (isMissingFile(error)) return false;
      throw error;
    }
  }

  async search(query: string, limit = 10): Promise<Array<{ file: FileRecord; score: number }>> {
    const snapshot = await this.read();
    const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}_$.-]+/gu) ?? [])];
    if (terms.length === 0) return [];
    const symbolsByPath = new Map<string, SymbolRecord[]>();
    for (const symbol of snapshot.symbols) {
      symbolsByPath.set(symbol.filePath, [...(symbolsByPath.get(symbol.filePath) ?? []), symbol]);
    }
    return snapshot.files.map((file) => {
      const haystack = new Set(file.terms);
      const matches = terms.filter((term) => haystack.has(term));
      const pathMatches = terms.filter((term) => file.path.toLowerCase().includes(term));
      const symbolMatches = (symbolsByPath.get(file.path) ?? []).reduce((count, symbol) =>
        count + terms.filter((term) => symbol.name.toLowerCase().includes(term)).length, 0);
      return { file, score: matches.length * 2 + pathMatches.length + symbolMatches * 4 };
    }).filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score || left.file.path.localeCompare(right.file.path))
      .slice(0, limit);
  }

  async findSymbol(query: string): Promise<SymbolRecord[]> {
    const normalized = query.toLowerCase();
    return (await this.read()).symbols.filter((symbol) => symbol.name.toLowerCase().includes(normalized));
  }

  async findReferences(query: string): Promise<RelationRecord[]> {
    const normalized = query.toLowerCase();
    return (await this.read()).relations.filter((relation) => relation.targetName.toLowerCase() === normalized);
  }

  async findCallers(query: string): Promise<RelationRecord[]> {
    const snapshot = await this.read();
    const symbolIds = new Set(snapshot.symbols.filter((symbol) => symbol.name.toLowerCase() === query.toLowerCase()).map((symbol) => symbol.id));
    return snapshot.relations.filter((relation) => relation.kind === 'calls' && relation.toSymbolId && symbolIds.has(relation.toSymbolId));
  }

  async findCallees(query: string): Promise<RelationRecord[]> {
    const snapshot = await this.read();
    const symbolIds = new Set(snapshot.symbols.filter((symbol) => symbol.name.toLowerCase() === query.toLowerCase()).map((symbol) => symbol.id));
    return snapshot.relations.filter((relation) => relation.kind === 'calls' && relation.fromSymbolId && symbolIds.has(relation.fromSymbolId));
  }

  async findDependencies(query: string, depth = 1): Promise<RelationRecord[]> {
    const snapshot = await this.read();
    return findDependencyRelations(snapshot, query, false, depth);
  }

  async findDependents(query: string, depth = 1): Promise<RelationRecord[]> {
    const snapshot = await this.read();
    return findDependencyRelations(snapshot, query, true, depth);
  }

  async findPath(from: string, to: string, options: GraphQueryOptions = {}): Promise<GraphPathResult> {
    return findSymbolPath(await this.read(), from, to, options);
  }

  async getRepositoryMap(): Promise<RepositoryMap> {
    return buildRepositoryMap(await this.read());
  }

  async classifyQuery(query: string): Promise<QueryIntent> {
    return classifyQuery(query);
  }

  async findApiEndpoints(): Promise<ApiEndpoint[]> {
    return detectApiEndpoints(await this.read());
  }

  async findSensitiveRegions(): Promise<SensitiveRegion[]> {
    return detectSensitiveRegions(await this.read());
  }

  async analyzeImpact(target: string, maxDepth = 5): Promise<ImpactAnalysisResult> {
    return analyzeImpact(await this.read(), target, maxDepth);
  }

  async findTests(query: string): Promise<TestMapping[]> {
    return findTests(await this.read(), query);
  }

  async findAffectedTests(changedFiles: string[]): Promise<TestMapping[]> {
    return findAffectedTests(await this.read(), changedFiles);
  }

  async getDatabaseSchema(): Promise<DatabaseModelInfo[]> {
    return analyzeDatabaseSchema(await this.read());
  }

  async getGitHistory(limit = 20): Promise<GitHistoryResult> {
    return getGitHistory(this.workspacePath, limit);
  }

  async getChanges(): Promise<GitHistoryResult> {
    return getGitHistory(this.workspacePath, 20);
  }

  async getChangeCoupling(limit = 50): Promise<FileChangeCoupling[]> {
    return analyzeChangeCoupling(this.workspacePath, limit);
  }

  async getHotspots(limit = 10): Promise<Hotspot[]> {
    return detectHotspots(this.workspacePath, limit);
  }

  async getComplexity(): Promise<FileComplexity[]> {
    return analyzeComplexity(await this.read());
  }

  async getDuplicates(minLines = 3): Promise<DuplicateMatch[]> {
    return detectDuplicates(await this.read(), minLines);
  }

  async explainSymbol(symbolName: string): Promise<SymbolExplanation> {
    return explainSymbol(await this.read(), symbolName);
  }

  async findDependencyCycles(): Promise<GraphCycle[]> {
    return findGraphCycles(await this.read());
  }

  async semanticSearch(query: string, limit = 10): Promise<Array<{ file: FileRecord; chunk: CodeChunk; score: number }>> {
    const provider = this.options.embeddingProvider;
    if (!provider) throw new Error('Semantic search requires an explicitly configured embedding provider');
    const snapshot = await this.read();
    const dimensions = provider.dimensions();
    if (snapshot.metadata.embeddingProvider !== (provider.id ?? provider.constructor.name) || snapshot.metadata.embeddingDimensions !== dimensions) {
      throw new Error('Embedding provider does not match vectors stored in this index; reindex with the configured provider');
    }
    const queryVector = await provider.embed(query);
    if (queryVector.length !== dimensions || queryVector.some((value) => !Number.isFinite(value))) {
      throw new Error('Embedding provider returned an invalid query vector');
    }
    const files = new Map(snapshot.files.map((file) => [file.path, file]));
    const chunks = new Map(snapshot.chunks.map((chunk) => [chunk.id, chunk]));
    return snapshot.vectors.flatMap((vector) => {
      const chunk = chunks.get(vector.chunkId);
      const file = chunk ? files.get(chunk.filePath) : undefined;
      return file && chunk ? [{ file, chunk, score: cosineSimilarity(queryVector, vector.values) }] : [];
    }).sort((left, right) => right.score - left.score).slice(0, limit);
  }

  async hybridSearch(query: string, limit = 10): Promise<Array<{ file: FileRecord; score: number }>> {
    const lexical = await this.search(query, limit * 2);
    if (!this.options.embeddingProvider) return lexical.slice(0, limit);
    const semantic = await this.semanticSearch(query, limit * 2);
    const maximumLexical = Math.max(1, ...lexical.map((result) => result.score));
    const combined = new Map<string, { file: FileRecord; score: number }>();
    for (const result of lexical) combined.set(result.file.path, { file: result.file, score: result.score / maximumLexical * 0.5 });
    for (const result of semantic) {
      const existing = combined.get(result.file.path);
      const score = (result.score + 1) / 2 * 0.5;
      combined.set(result.file.path, { file: result.file, score: (existing?.score ?? 0) + score });
    }
    return [...combined.values()].sort((left, right) => right.score - left.score).slice(0, limit);
  }

  async status(): Promise<{ indexed: boolean; snapshot?: IndexSnapshot; size?: number }> {
    try {
      const [snapshot, fileStats] = await Promise.all([this.read(), stat(this.indexPath)]);
      return { indexed: true, snapshot, size: fileStats.size };
    } catch (error) {
      if (isMissingFile(error)) return { indexed: false };
      throw error;
    }
  }
}

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function resolveRelations(relations: RelationRecord[], symbols: SymbolRecord[]): void {
  const byName = new Map<string, SymbolRecord[]>();
  for (const symbol of symbols) {
    const names = new Set<string>([symbol.name, normalizeRelationTarget(symbol.name), normalizeRelationTarget(symbol.filePath), symbol.filePath.split('/').at(-1)?.replace(/\.[^/.]+$/u, '') ?? '']);
    for (const name of names) {
      if (!name) continue;
      byName.set(name, [...(byName.get(name) ?? []), symbol]);
    }
  }
  for (let index = 0; index < relations.length; index++) {
    const relation = relations[index]!;
    const candidates = new Set<SymbolRecord>();
    for (const candidateName of relationTargetCandidates(relation.targetName)) {
      for (const candidate of byName.get(candidateName) ?? []) candidates.add(candidate);
    }
    const local = [...candidates].find((candidate) => candidate.filePath === relation.filePath);
    const target = local ?? [...candidates][0];
    if (target) relations[index] = { ...relation, toSymbolId: target.id, confidence: local ? 0.9 : 0.72 };
  }
}

function relationTargetCandidates(targetName: string): string[] {
  const normalized = normalizeRelationTarget(targetName);
  const values = new Set<string>([targetName, normalized]);
  const split = targetName.split(/[\/]/u).filter(Boolean);
  for (const part of split) {
    const cleaned = normalizeRelationTarget(part);
    if (cleaned) values.add(cleaned);
  }
  if (normalized) values.add(normalized.replace(/\.[^/.]+$/u, ''));
  return [...values].filter(Boolean);
}

function normalizeRelationTarget(value: string): string {
  return value
    .replace(/^['"]|['"]$/gu, '')
    .replace(/^\.?\.?\//u, '')
    .replace(/^[A-Za-z]+:/u, '')
    .replace(/[?#].*$/u, '')
    .replace(/\/index$/u, '')
    .replace(/\.[a-z0-9]+$/iu, '')
    .split(/[\\/]+/u).filter(Boolean).at(-1) ?? value
    .replace(/^['"]|['"]$/gu, '');
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length) return -1;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index++) {
    dot += left[index]! * right[index]!;
    leftMagnitude += left[index]! ** 2;
    rightMagnitude += right[index]! ** 2;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}
