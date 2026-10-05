# ⚡ Codebase Indexer

[![npm version](https://img.shields.io/npm/v/@vortiqlabs/codebase-indexer.svg?style=flat-square)](https://www.npmjs.com/package/@vortiqlabs/codebase-indexer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Node.js Engine](https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg?style=flat-square)](package.json)
[![Build & Test Status](https://img.shields.io/badge/tests-16%20passed-brightgreen.svg?style=flat-square)](package.json)
[![MCP Protocol](https://img.shields.io/badge/MCP-v1.31.0-purple.svg?style=flat-square)](src/mcp/CodebaseIndexerMcpServer.ts)

A production-quality **Local Code Intelligence Engine** for building structural, semantic, historical, and relational models of software repositories.

Runs 100% locally and offline. Exposes deterministic static analysis through **TypeScript API**, **CLI**, **MCP Server**, and an **Interactive Web Dashboard**.

---

## 🏛️ Logical Architecture

```
                                  CODEBASE INDEXER
                                         │
               ┌─────────────────────────┼─────────────────────────┐
               │                         │                         │
               ▼                         ▼                         ▼
            Library                     CLI                       MCP
            (Node.js)          (codebase-indexer)        (codebase-indexer-mcp)
               │                         │                         │
               └─────────────────────────┼─────────────────────────┘
                                         ▼
                               Standalone Executable
                                         │
                         ┌───────────────┼───────────────┐
                         ▼               ▼               ▼
                      VS Code        JetBrains          Zed
                     extension      integration     integration
```

---

## ⚡ Core Features & Intelligence Capabilities

- 🧬 **Symbol & Graph Intelligence**: Multi-language AST extraction via Tree-sitter across **40+ programming languages**.
- 🕸️ **Call Graph & Dependencies**: Callers, callees, symbol paths, dependency graphs, and automated cycle detection (`find_dependency_cycles`).
- 🌊 **Static Impact Analysis**: Predicts the ripple effect of symbol/file changes with `DIRECT`, `TRANSITIVE`, and `POSSIBLE` confidence ratings (`ImpactAnalyzer`).
- 🧪 **Test Intelligence**: Automatically maps production code to tests and discovers affected test suites for changed files (`TestAnalyzer`).
- 🗄️ **Database Intelligence**: Static schema and model extraction for Prisma (`schema.prisma`), SQL DDL migrations, and ORM entities (`DatabaseAnalyzer`).
- 📜 **Git & Change Coupling**: Commit history, uncommitted status, co-change coupling percentages, and high-risk hotspot detection (`ChangeAnalyzer`).
- 📊 **Code Quality & Complexity**: Cyclomatic complexity heuristics, LOC calculations, function/class sizes, and exact/structural duplicate detection (`ComplexityAnalyzer`, `DuplicateDetector`).
- 🔍 **Hybrid Search & Context Builder**: Combines lexical and optional vector embeddings with token-budget-aware context snippet generation for AI agents (`ContextBuilder`).
- 💡 **Deterministic Symbol Explanations**: Aggregates definition locations, callers, callees, references, export status, test coverage, APIs, and database models without LLM hallucinations (`ExplainSymbol`).
- 🤖 **Model Context Protocol (MCP) Server**: Exposes 20+ specialized intelligence tools over stdio for AI assistants (Claude Desktop, Cursor, Windsurf, Zed).

---

## 📚 Documentation Index

Detailed documentation for each engine component is available in [`docs/`](docs/):

- 💻 **[CLI Documentation](docs/cli.md)**: Full command-line interface reference, subcommands, and flags.
- 📦 **[Library API Documentation](docs/library-api.md)**: TypeScript / Node.js API reference for `CodebaseIndexer` and `IndexManager`.
- 🤖 **[MCP Server Documentation](docs/mcp-server.md)**: Configuration guides and tool schemas for AI agents.
- 🔬 **[Static Intelligence Features](docs/intelligence-features.md)**: In-depth explanations of Impact Analysis, Test Mapping, Database Schemas, Git Coupling, and Complexity metrics.
- 📜 **[Changelog](CHANGELOG.md)**: Detailed version history and release notes.

---

## 🚀 Quick Start

### Installation

```bash
# Global CLI installation
npm install -g @vortiqlabs/codebase-indexer

# Direct execution via npx
npx @vortiqlabs/codebase-indexer status
```

---

### 1. Library API Usage (TypeScript)

```typescript
import { CodebaseIndexer } from '@vortiqlabs/codebase-indexer';

const indexer = new CodebaseIndexer({
  workspacePath: '/path/to/repository'
});

await indexer.initialize();
await indexer.index();

// 1. Static Impact Analysis
const impact = await indexer.analyzeImpact('UserService');
console.log(`Direct Dependents: ${impact.directDependents.length}`);

// 2. Test Intelligence
const tests = await indexer.findTests('UserService');
console.log(`Associated Tests: ${tests.map((t) => t.testFile).join(', ')}`);

// 3. Deterministic Symbol Explanation
const explanation = await indexer.explainSymbol('UserService');
console.log(explanation);
```

---

### 2. CLI Usage

```bash
# Index a local workspace
codebase-indexer index ./my-repo

# Generate compact repository map
codebase-indexer map ./my-repo

# Analyze impact of changing a symbol
codebase-indexer impact UserService

# Detect database schemas (Prisma, SQL, ORM)
codebase-indexer database

# View high-risk change hotspots
codebase-indexer hotspots

# Launch interactive web dashboard
codebase-indexer dashboard --port 4173
```

---

### 3. MCP Server Configuration (Claude Desktop / Cursor)

Add to your `claude_desktop_config.json` or Cursor MCP settings:

```json
{
  "mcpServers": {
    "codebase-indexer": {
      "command": "npx",
      "args": ["-y", "@vortiqlabs/codebase-indexer", "mcp"],
      "env": {
        "CODEBASE_INDEX_DIR": "/home/user/.cache/codebase-indexer"
      }
    }
  }
}
```

---

## 📊 Supported Languages

| Language | Extensions | Grammar Parser |
| :--- | :--- | :--- |
| **TypeScript / TSX** | `.ts`, `.tsx`, `.cts`, `.mts` | Tree-sitter TS / TSX |
| **JavaScript / JSX** | `.js`, `.jsx`, `.mjs`, `.cjs` | Tree-sitter JS |
| **Python** | `.py`, `.pyw` | Tree-sitter Python |
| **Rust** | `.rs` | Tree-sitter Rust |
| **Go** | `.go`, `go.mod` | Tree-sitter Go |
| **Java** | `.java` | Tree-sitter Java |
| **C / C++** | `.c`, `.cpp`, `.cc`, `.h`, `.hpp` | Tree-sitter C / C++ |
| **C#** | `.cs` | Tree-sitter C# |
| **Kotlin / Swift / Scala** | `.kt`, `.swift`, `.scala` | Tree-sitter |
| **SQL / Prisma** | `.sql`, `.prisma` | WASM / Custom DDL |
| **Dockerfile / Makefile** | `Dockerfile`, `Makefile` | WASM |
| **Markdown / YAML / JSON** | `.md`, `.yaml`, `.json` | WASM / Tree-sitter |

---

## 📄 License

[MIT](LICENSE)
