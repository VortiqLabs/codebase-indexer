# Codebase Indexer TypeScript / Node.js Library API

The `@vortiqlabs/codebase-indexer` package exports first-class, fully typed JavaScript / TypeScript APIs for local code intelligence.

## Installation

```bash
npm install @vortiqlabs/codebase-indexer
```

## Basic Usage

```typescript
import { CodebaseIndexer } from '@vortiqlabs/codebase-indexer';

const indexer = new CodebaseIndexer({
  workspacePath: '/path/to/your/project'
});

// Initialize and index workspace
await indexer.initialize();
const result = await indexer.index();

console.log(`Indexed ${result.snapshot.metadata.fileCount} files`);
```

---

## High-Level API Reference (`CodebaseIndexer`)

### Initialization & Indexing

#### `initialize(): Promise<void>`
Initializes the underlying `IndexManager` and staging database.

#### `index(force?: boolean): Promise<IndexUpdateResult>`
Indexes or incrementally updates the workspace. Set `force: true` to bypass incremental cache.

---

### Symbol & Relation Intelligence

#### `findSymbol(name: string): Promise<SymbolRecord[]>`
Finds symbols matching the given query string.

#### `findReferences(name: string): Promise<RelationRecord[]>`
Finds all references targeting `name`.

#### `findCallers(name: string): Promise<RelationRecord[]>`
Finds incoming callers for a symbol.

#### `findCallees(name: string): Promise<RelationRecord[]>`
Finds outgoing calls from a symbol.

#### `explainSymbol(symbolName: string): Promise<SymbolExplanation>`
Returns deterministic structural aggregation of definition, callers, callees, references, exports, tests, APIs, and database relations for a symbol.

---

### Impact Analysis

#### `analyzeImpact(target: string, maxDepth?: number): Promise<ImpactAnalysisResult>`
Calculates direct and transitive dependents, affected files, symbols, APIs, and tests when changing `target`.

---

### Test Intelligence

#### `findTests(query: string): Promise<TestMapping[]>`
Finds test files and test functions covering a target symbol or file.

#### `findAffectedTests(changedFiles: string[]): Promise<TestMapping[]>`
Determines which test files need execution based on a set of modified source files.

---

### Database Intelligence

#### `getDatabaseSchema(): Promise<DatabaseModelInfo[]>`
Detects Prisma schemas, SQL DDL migrations, and ORM entity models.

---

### Git & Change Intelligence

#### `getGitHistory(limit?: number): Promise<GitHistoryResult>`
Retrieves git log history and uncommitted file status.

#### `getChangeCoupling(limit?: number): Promise<FileChangeCoupling[]>`
Analyzes historical co-change coupling percentages between files.

#### `getHotspots(limit?: number): Promise<Hotspot[]>`
Detects high-risk, frequently changed hotspots.

---

### Quality & Complexity

#### `getComplexity(): Promise<FileComplexity[]>`
Computes cyclomatic complexity, LOC, and symbol metrics for files.

#### `getDuplicates(minLines?: number): Promise<DuplicateMatch[]>`
Detects exact and structural code duplications.

#### `findDependencyCycles(): Promise<GraphCycle[]>`
Detects dependency cycles in the symbol graph.

---

### Search & Context

#### `search(query: string, limit?: number): Promise<Array<{ file: FileRecord; score: number }>>`
Performs lexical term matching search.

#### `hybridSearch(query: string, limit?: number): Promise<Array<{ file: FileRecord; score: number }>>`
Combines lexical and optional semantic vector search signals.

#### `getContext(query: string, options?: ContextOptions): Promise<CodeContext>`
Builds structured context snippets respecting character / token limits for AI agent prompts.
