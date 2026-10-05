import { IndexManager, type IndexManagerOptions, type IndexUpdateResult } from './IndexManager.js';
import type { FileRecord } from '../types/FileRecord.js';
import type { RelationRecord } from '../types/Relation.js';
import type { SymbolRecord } from '../types/Symbol.js';
import { ContextBuilder, type CodeContext, type ContextOptions } from '../context/ContextBuilder.js';
import type { ApiEndpoint } from '../intelligence/ApiDetector.js';
import { classifyQuery, type QueryIntent } from '../intelligence/QueryIntent.js';
import { findDependencyRelations, findSymbolPath, type GraphPathResult, type GraphCycle } from '../intelligence/GraphQuery.js';
import { buildRepositoryMap, type RepositoryMap } from '../intelligence/RepositoryMap.js';
import { detectSensitiveRegions, type SensitiveRegion } from '../intelligence/SensitiveDetector.js';
import type { ImpactAnalysisResult } from '../intelligence/ImpactAnalyzer.js';
import type { TestMapping } from '../intelligence/TestAnalyzer.js';
import type { DatabaseModelInfo } from '../intelligence/DatabaseAnalyzer.js';
import type { GitHistoryResult } from '../intelligence/GitHistory.js';
import type { FileChangeCoupling, Hotspot } from '../intelligence/ChangeAnalyzer.js';
import type { FileComplexity } from '../intelligence/ComplexityAnalyzer.js';
import type { DuplicateMatch } from '../intelligence/DuplicateDetector.js';
import type { SymbolExplanation } from '../intelligence/ExplainSymbol.js';

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

  async findDependencies(name: string, depth = 1): Promise<RelationRecord[]> {
    return this.getManager().findDependencies(name, depth);
  }

  async findDependents(name: string, depth = 1): Promise<RelationRecord[]> {
    return this.getManager().findDependents(name, depth);
  }

  async findPath(from: string, to: string, options?: { maxDepth?: number; maxNodes?: number }): Promise<GraphPathResult> {
    return this.getManager().findPath(from, to, options);
  }

  async getRepositoryMap(): Promise<RepositoryMap> {
    return this.getManager().getRepositoryMap();
  }

  async classifyQuery(query: string): Promise<QueryIntent> {
    return this.getManager().classifyQuery(query);
  }

  async findApiEndpoints(): Promise<ApiEndpoint[]> {
    return this.getManager().findApiEndpoints();
  }

  async findSensitiveRegions(): Promise<SensitiveRegion[]> {
    return this.getManager().findSensitiveRegions();
  }

  async analyzeImpact(target: string, maxDepth = 5): Promise<ImpactAnalysisResult> {
    return this.getManager().analyzeImpact(target, maxDepth);
  }

  async findTests(query: string): Promise<TestMapping[]> {
    return this.getManager().findTests(query);
  }

  async findAffectedTests(changedFiles: string[]): Promise<TestMapping[]> {
    return this.getManager().findAffectedTests(changedFiles);
  }

  async getDatabaseSchema(): Promise<DatabaseModelInfo[]> {
    return this.getManager().getDatabaseSchema();
  }

  async getGitHistory(limit = 20): Promise<GitHistoryResult> {
    return this.getManager().getGitHistory(limit);
  }

  async getChanges(): Promise<GitHistoryResult> {
    return this.getManager().getChanges();
  }

  async getChangeCoupling(limit = 50): Promise<FileChangeCoupling[]> {
    return this.getManager().getChangeCoupling(limit);
  }

  async getHotspots(limit = 10): Promise<Hotspot[]> {
    return this.getManager().getHotspots(limit);
  }

  async getComplexity(): Promise<FileComplexity[]> {
    return this.getManager().getComplexity();
  }

  async getDuplicates(minLines = 3): Promise<DuplicateMatch[]> {
    return this.getManager().getDuplicates(minLines);
  }

  async explainSymbol(symbolName: string): Promise<SymbolExplanation> {
    return this.getManager().explainSymbol(symbolName);
  }

  async findDependencyCycles(): Promise<GraphCycle[]> {
    return this.getManager().findDependencyCycles();
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