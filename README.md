# @vortiqlabs/codebase-indexer

A high-performance, standalone, local-first TypeScript engine and interactive web dashboard for indexing codebases, parsing ASTs with Tree-sitter, resolving symbol relationships, performing lexical & semantic search, and visualizing code architecture.

---

## Key Features

- ⚡ **Local-First & Fast**: Zero cloud dependency. Indexes are persisted locally in binary `.index` files using MessagePack and SHA-256 integrity verification.
- 🌳 **Multi-Language AST Indexing**: Built-in Tree-sitter AST parser supporting **40+ programming languages** and file formats (TypeScript, JavaScript, Python, Rust, Go, Java, C/C++, C#, Kotlin, Swift, Scala, Elixir, Ruby, PHP, SQL, HTML, CSS, Dockerfile, YAML, TOML, JSON, and more).
- 🎨 **Interactive Visual Dashboard & Graph**: Sleek Express dashboard featuring a full-screen interactive D3 graph of symbol relationships, Monaco Editor source viewer, dark/light/system theme switching, live progress streaming for GitHub imports, and architecture maps.
- 📊 **System & Memory Safeguards**: Built-in bounded LRU caching, isolated worker threads, memory guards (4MB parse cap), and process memory statistics monitoring (`rss`, heap usage, cache size).
- 🔍 **Advanced Lexical & Vector Search**: Perform instant term search or semantic vector search across local workspaces and GitHub repositories with language filtering.
- 🛡️ **Security Findings Detection**: Automatic detection of sensitive regions (tokens, credentials, API keys) with redacted reporting.
- 📦 **Export Capabilities**: Export workspace summaries and symbol definitions in **JSON** or **CSV** formats for reporting and external analysis.
- 🤖 **Model Context Protocol (MCP) Server**: Expose workspace indexing, symbol analysis, and search tools directly to AI assistants over `stdio`.

---

## Requirements

- **Node.js**: `>= 20.0.0`
- **npm** or **pnpm** or **yarn**

---

## Quick Start

### Installation

```sh
npm install -g @vortiqlabs/codebase-indexer
```

Or run directly from source:

```sh
npm install
npm run build
```

### CLI Usage

```sh
# Index a local workspace
codebase-indexer index ./my-project

# Index a GitHub repository directly from URL
codebase-indexer index-github owner/repository --ref main

# Launch the interactive web dashboard
codebase-indexer dashboard --port 4173

# Search indexed terms and symbols
codebase-indexer search "authentication token" --path ./my-project

# Find symbol definitions and usages
codebase-indexer symbols AuthService --path ./my-project

# Inspect binary index metadata
codebase-indexer inspect ~/.cache/codebase-indexer/<uid>.index

# Run watch mode for incremental re-indexing
codebase-indexer watch ./my-project
```

---

## Dashboard Capabilities

Launch the dashboard with `codebase-indexer dashboard` or `npm run build && node dist/bin/codebase-indexer.js dashboard`. Access `http://127.0.0.1:4173` in your browser.

- 🌗 **Theme Switching**: Toggle between **Light**, **Dark**, and **System** themes with persistence in `localStorage`.
- 🕸️ **Interactive D3 Symbol Graph**: Zoom, pan, filter, hover to isolate connections, and click any node to open its exact lines in a embedded **Monaco Code Editor**.
- 📥 **GitHub Importer**: Enter any public or private GitHub repository URL (e.g. `https://github.com/owner/repo`). Features live SSE log streaming, file size filters, and custom ignore rules.
- 💾 **Workspace Exports**: Download comprehensive **JSON** and **CSV** reports of indexed symbols and workspace composition.
- 🖥️ **Memory & System Stats**: Realtime process RSS memory, heap usage, and index summary cache statistics.

---

## Supported Languages

The engine supports language detection and parsing across 40+ programming languages and formats:

| Language | Extensions | Parser Grammar |
| :--- | :--- | :--- |
| **TypeScript / TSX** | `.ts`, `.tsx`, `.cts`, `.mts` | Tree-sitter TS / TSX |
| **JavaScript / JSX** | `.js`, `.jsx`, `.mjs`, `.cjs` | Tree-sitter JavaScript |
| **Python** | `.py`, `.pyw` | Tree-sitter Python |
| **Rust** | `.rs` | Tree-sitter Rust |
| **Go** | `.go`, `go.mod` | Tree-sitter Go |
| **Java** | `.java` | Tree-sitter Java |
| **C / C++** | `.c`, `.cpp`, `.cc`, `.cxx`, `.h`, `.hpp` | Tree-sitter C / C++ |
| **C#** | `.cs` | Tree-sitter C# |
| **Kotlin** | `.kt`, `.kts` | Tree-sitter Kotlin |
| **Swift** | `.swift` | Tree-sitter Swift |
| **Scala** | `.scala`, `.sc` | Tree-sitter Scala |
| **Ruby** | `.rb` | Tree-sitter Ruby |
| **PHP** | `.php` | Tree-sitter PHP |
| **Elixir** | `.ex`, `.exs` | Tree-sitter Elixir |
| **Elm** | `.elm` | Bundled WASM |
| **Dart** | `.dart` | Tree-sitter Dart |
| **HTML / Vue** | `.html`, `.htm`, `.vue` | Tree-sitter HTML / Vue |
| **CSS / SCSS / SASS / LESS** | `.css`, `.scss`, `.sass`, `.less` | Tree-sitter CSS |
| **SQL** | `.sql` | Bundled WASM |
| **Dockerfile** | `Dockerfile`, `Containerfile` | Bundled WASM |
| **Makefile** | `Makefile`, `CMakeLists.txt` | Bundled WASM |
| **Markdown** | `.md`, `.mdx` | Bundled WASM |
| **YAML / TOML / JSON** | `.yaml`, `.yml`, `.toml`, `.json`, `.json5` | Tree-sitter / WASM |
| **Shell / Bash** | `.sh`, `.bash`, `.zsh` | Tree-sitter Bash |
| **And more** | Clojure, Haskell, Perl, R, Julia, Protobuf, GraphQL, Solidity, TLA+, SystemRDL | Specialized / Fallback |

Files without a specific Tree-sitter grammar automatically fall back to fast lexical scanning and semantic chunking.

---

## Memory Optimization & Safeguards

Designed to handle large multi-repository codebases without memory exhaustion:

- 🛡️ **Parse Buffer Caps**: AST parsing is capped at 4MB per file to prevent single huge files from consuming heap space.
- ⚙️ **Resource-Bounded Workers**: Index workers run with isolated heap limits (`1024MB` max old generation).
- 🧠 **LRU Index Summary Cache**: Dashboard uses an LRU cache limited to 100 active index summaries with automatic eviction.
- 🧹 **Automatic AST Release**: Web-tree-sitter trees and parser instances are explicitly garbage-collected immediately after extraction.

---

## API Usage

```ts
import { CodebaseIndexer } from '@vortiqlabs/codebase-indexer';

const indexer = new CodebaseIndexer({
  workspacePath: '/path/to/project',
  indexDir: '~/.cache/codebase-indexer'
});

await indexer.initialize();

// Build / update index
const result = await indexer.index();
console.log(`Indexed ${result.fileCount} files and ${result.symbolCount} symbols.`);

// Perform lexical search
const searchResults = await indexer.search('authMiddleware');

// Find symbol
const symbols = await indexer.findSymbol('UserService');

// Get context prompt for LLMs
const context = await indexer.getContext('how is authentication implemented?');
```

---

## MCP Server

Expose indexer capabilities to Claude Desktop or any Model Context Protocol client:

```json
{
  "mcpServers": {
    "codebase-indexer": {
      "command": "codebase-indexer",
      "args": ["mcp"],
      "env": {
        "CODEBASE_INDEX_DIR": "/home/user/.cache/codebase-indexer"
      }
    }
  }
}
```

Exposed MCP Tools:
- `list_indexes`
- `search_code`
- `read_indexed_file`
- `get_symbol_relations`
- `index_local_workspace`
- `index_github_repository`

---

## License

[MIT](LICENSE)
