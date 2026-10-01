import { IndexManager, type IndexManagerOptions, type IndexUpdateResult } from './IndexManager.js';
import type { FileRecord } from '../types/FileRecord.js';
import type { RelationRecord } from '../types/Relation.js';
import type { SymbolRecord } from '../types/Symbol.js';
import { ContextBuilder, type CodeContext, type ContextOptions } from '../context/ContextBuilder.js';

export class CodebaseIndexer {
  private manager?: IndexManager;
  private readonly contextBuilder = new ContextBuilder();

  constructor(private readonly options: IndexManagerOptions) {}

  async initialize(): Promise<void> {
    this.manager = await IndexManager.create(this.options);
  }

  async index(force = false): Promise<IndexUpdateResult> {
    return this.getManager().index(force);
  }

  async search(query: string, limit = 10): Promise<Array<{ file: FileRecord; score: number }>> {
    return this.getManager().search(query, limit);
  }

  async semanticSearch(query: string, limit = 10): Promise<Array<{ file: FileRecord; chunk: import('../types/CodeChunk.js').CodeChunk; score: number }>> {
    return this.getManager().semanticSearch(query, limit);
  }

  async hybridSearch(query: string, limit = 10): Promise<Array<{ file: FileRecord; score: number }>> {
    return this.getManager().hybridSearch(query, limit);
  }

  async getFile(filePath: string): Promise<FileRecord | undefined> {
    const snapshot = await this.getManager().read();
    return snapshot.files.find((file) => file.path === filePath);
  }

  async findSymbol(name: string): Promise<SymbolRecord[]> {
    return this.getManager().findSymbol(name);
  }

  async findDefinition(name: string): Promise<SymbolRecord[]> {
    return this.findSymbol(name);
  }

  async findReferences(name: string): Promise<RelationRecord[]> {
    return this.getManager().findReferences(name);
  }

  async findCallers(name: string): Promise<RelationRecord[]> {
    return this.getManager().findCallers(name);
  }

  async findCallees(name: string): Promise<RelationRecord[]> {
    return this.getManager().findCallees(name);
  }

  async getContext(query: string, options: ContextOptions = {}): Promise<CodeContext> {
    const manager = this.getManager();
    const results = await manager.search(query, options.maxFiles ?? 8);
    const snapshot = await manager.read();
    return this.contextBuilder.build(snapshot, query, results.map((result) => result.file), options);
  }

  async getStats(): Promise<{
    uid: string;
    indexPath: string;
    fileCount: number;
    symbolCount: number;
    relationCount: number;
    chunkCount: number;
    vectorCount: number;
    updatedAt: string;
  }> {
    const manager = this.getManager();
    const snapshot = await manager.read();
    return {
      uid: manager.uid,
      indexPath: manager.indexPath,
      fileCount: snapshot.metadata.fileCount,
      symbolCount: snapshot.metadata.symbolCount,
      relationCount: snapshot.metadata.relationCount,
      chunkCount: snapshot.metadata.chunkCount,
      vectorCount: snapshot.metadata.vectorCount,
      updatedAt: snapshot.metadata.updatedAt
    };
  }

  private getManager(): IndexManager {
    if (!this.manager) throw new Error('Call initialize() before using the indexer');
    return this.manager;
  }
}