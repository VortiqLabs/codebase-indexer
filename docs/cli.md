# Codebase Indexer CLI Documentation

The `codebase-indexer` command-line interface provides local, deterministic static code intelligence directly in your terminal.

## Installation & Usage

```bash
# Global installation via npm
npm install -g @vortiqlabs/codebase-indexer

# Direct execution via npx
npx @vortiqlabs/codebase-indexer <command> [arguments] [options]
```

---

## Command Reference

### Indexing & Workspace Management

#### `index`
Indexes or updates the specified workspace directory.

```bash
codebase-indexer index [path] [options]
```

**Options:**
- `--force`: Force complete re-indexing instead of incremental update.
- `--json`: Output result as formatted JSON.
- `--index-dir <path>`: Directory to store `.index` database files.
- `--workers <number>`: Number of parallel parsing worker threads (default: 2).
- `--memory-limit <MB>`: Maximum RAM limit before triggering GC/backpressure (default: 4096).
- `--no-embeddings`: Skip generating optional vector embeddings.
- `--profile <default|large>`: Use `large` profile optimizations for repos with 100k+ files.

---

#### `index-github`
Downloads and indexes a GitHub repository from tarball archives.

```bash
codebase-indexer index-github <owner/repo> [--ref <ref>] [--index-dir <path>] [--json]
```

**Example:**
```bash
codebase-indexer index-github expressjs/express --ref main
```

---

#### `status`
Displays metadata and statistics for an indexed workspace.

```bash
codebase-indexer status [--path <workspace>] [--json]
```

---

#### `watch`
Monitors workspace directory for file changes and triggers debounced incremental index updates.

```bash
codebase-indexer watch [path] [--verbose]
```

---

### Intelligence & Graph Queries

#### `map`
Generates a compact structural repository map (directories, file counts, key symbols).

```bash
codebase-indexer map [path] [--json]
```

---

#### `impact`
Performs static impact analysis for a symbol or file change.

```bash
codebase-indexer impact <symbol-or-path> [--json]
```

---

#### `explain`
Aggregates deterministic structural evidence for a symbol without an LLM.

```bash
codebase-indexer explain <symbol> [--json]
```

---

#### `symbols` / `references` / `callers` / `callees`
Queries symbol definitions, references, callers, and callees.

```bash
codebase-indexer symbols <query> [--json]
codebase-indexer references <symbol> [--json]
codebase-indexer callers <symbol> [--json]
codebase-indexer callees <symbol> [--json]
```

---

#### `deps` / `dependents` / `path` / `cycles`
Graph queries for dependencies, reverse dependents, call paths, and dependency cycles.

```bash
codebase-indexer deps <target> [--depth 2] [--json]
codebase-indexer dependents <target> [--depth 2] [--json]
codebase-indexer path <fromSymbol> <toSymbol> [--depth 5] [--json]
codebase-indexer cycles [--json]
```

---

#### `tests` / `affected-tests`
Test intelligence queries linking symbols and changed files to tests.

```bash
codebase-indexer tests <symbol-or-file> [--json]
codebase-indexer affected-tests <file1> <file2> [--json]
```

---

#### `database`
Detects database schemas (Prisma, SQL migrations, ORM entities).

```bash
codebase-indexer database [--json]
```

---

#### `history` / `changes` / `coupling` / `hotspots`
Git and historical change intelligence.

```bash
codebase-indexer history [--json]
codebase-indexer changes [--json]
codebase-indexer coupling [--json]
codebase-indexer hotspots [--json]
```

---

#### `complexity` / `duplicates` / `sensitive`
Code quality, duplication, and security scanning.

```bash
codebase-indexer complexity [--json]
codebase-indexer duplicates [--json]
codebase-indexer sensitive [--json]
```

---

### Dashboard & MCP Server

#### `dashboard`
Launches the web visual dashboard and Monaco code viewer.

```bash
codebase-indexer dashboard [--port 4173] [--host 127.0.0.1]
```

#### `mcp`
Starts the Model Context Protocol (MCP) server over stdio for AI agent integration.

```bash
codebase-indexer mcp [--index-dir <path>]
```
