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
- 🧭 **Architecture Intelligence**: File-level dependency graphs, circular-import detection, fan-in/fan-out metrics, and entry-point candidates from resolvable relative imports.
- 🧠 **Graph-Aware Context**: Context retrieval can add directly related files within the requested file and token budgets.
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
- 🧪 **Workspace Test Runner**: Run the selected workspace’s configured `npm test` script from the Tests panel, view captured output, exit status, duration, and Node test pass/fail totals (180-second timeout). Only use this execution feature on trusted local workspaces.
- 🧠 **EmbeddingGemma Lab**: Test query/document inference on CPU, choose 128/256/512/768 dimensions and Q4/Q8/FP32 weights, then generate vectors for every chunk in the selected index. The first test downloads the ONNX model and tokenizer; no Python or VS Code is required.

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

// Get graph-aware context prompt for LLMs
const context = await indexer.getContext('how is authentication implemented?', {
  maxFiles: 8,
  maxTokens: 6000,
  includeRelatedFiles: true
});

// Inspect relative-import architecture and circular dependencies
const architecture = await indexer.analyzeArchitecture();
console.log(architecture.cycles);
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
- `analyze_change_impact`
- `analyze_architecture`
- `index_local_workspace`
- `index_github_repository`

---

## License

[MIT](LICENSE)

## Semantic embeddings with EmbeddingGemma 2

Codebase Indexer supports local EmbeddingGemma 2 inference through Google's LiteRT-LM JavaScript runtime, with no Python installation required by the VS Code extension. The extension hosts the inference engine in a WebView and communicates with the Node.js indexer through a request-correlated message bridge. The model is downloaded lazily from Hugging Face on first use; the default 740M multimodal model is approximately 485 MB. Embeddings are optional; lexical search and graph features continue to work without them. Vectors are persisted in the index and unchanged chunks reuse their vectors.

### VS Code extension integration

The package exports `LiteRTEmbeddingProvider`, `LiteRTWebviewEmbeddingTransport`, and `createLiteRTEmbeddingWebviewHtml`. The extension creates a WebView with scripts enabled and `retainContextWhenHidden: true`, then passes the WebView's `postMessage` and `onDidReceiveMessage` methods to the transport. The first WebView is a real VS Code panel; if you do not want a visible runtime tab, host the same HTML in a dedicated `WebviewViewProvider` instead. The runtime bundle is published at `dist/webview/litert-embedding-runtime.js`.

```ts
import * as vscode from 'vscode';
import {
  IndexManager,
  LiteRTEmbeddingProvider,
  LiteRTWebviewEmbeddingTransport,
  createLiteRTEmbeddingWebviewHtml,
} from '@vortiqlabs/codebase-indexer';

const panel = vscode.window.createWebviewPanel('codebaseIndexerEmbeddings', 'Codebase Indexer Runtime', vscode.ViewColumn.Beside, {
  enableScripts: true,
  retainContextWhenHidden: true,
});
const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(
  context.extensionUri, 'node_modules', '@vortiqlabs', 'codebase-indexer', 'dist', 'webview', 'litert-embedding-runtime.js'
));
const transport = new LiteRTWebviewEmbeddingTransport({
  postMessage: (message) => panel.webview.postMessage(message),
  onMessage: (listener) => panel.webview.onDidReceiveMessage((data) => listener({ data })),
});
panel.webview.html = createLiteRTEmbeddingWebviewHtml({
  scriptUri: scriptUri.toString(),
  cspSource: panel.webview.cspSource,
  nonce: createNonce(),
  dimensions: 256,
  backend: 'cpu', // CPU-only inference; no WebGPU selection
});
const provider = new LiteRTEmbeddingProvider(transport, { dimensions: 256 });
const manager = await IndexManager.create({ workspacePath, embeddingProvider: provider });
await manager.index();
// On extension shutdown: provider.close(); panel.dispose();
```

Generate `nonce` with a cryptographically random value. Resolve `scriptUri` with `webview.asWebviewUri` from the package's `dist/webview/litert-embedding-runtime.js` file. By default LiteRT-LM loads its small WASM runtime assets from Google's configured jsDelivr CDN and downloads the model from Hugging Face; if you need an offline/air-gapped extension, copy `node_modules/@litert-lm/core/wasm/` into your extension and pass its WebView URI as the optional `wasmUri`. Keep the WebView alive while indexing; dispose the provider when the extension shuts down. The runtime defaults to the CPU backend and can be explicitly pinned with `backend: 'cpu'`. It will not probe or initialize WebGPU in this mode. Set `backend: 'gpu'` only when you later want to opt into GPU inference. LiteRT-LM's JavaScript SDK is currently early preview.

The default model is `embeddinggemma-2-740m.litertlm`; supported output dimensions are 128, 256, 512, and 768. The provider uses LiteRT-LM's documented asymmetric instructions: `task: search result | text:` for indexed chunks and `task: search query | text:` for queries.

Dashboard vector generation runs as a background job and reports per-batch progress, so the browser request does not need to stay open for the entire CPU run. The Node ONNX path uses four-item inference micro-batches and a 512-token input limit to keep peak CPU memory bounded; vectors are committed to the index atomically after generation finishes. Keep the dashboard process running until the job reports completion.

### Standalone Node.js CLI (CPU, no VS Code or Python)

The terminal CLI uses the ONNX conversion of the same EmbeddingGemma 2 model through Transformers.js and ONNX Runtime Node. It loads only the text encoder (270M parameters), selects the CPU execution device, and defaults to the Q8 ONNX weights. This is a separate runtime/model conversion from the LiteRT-LM WebView path, so the provider ID is deliberately different and indexes are never mixed across runtimes. The dashboard exposes the same Node.js provider in its **Embeddings** panel: first run **Test EmbeddingGemma** to validate query and indexed-code vectors, then use **Generate vectors for this index** to persist embeddings for the selected workspace. The generation action updates that index in place; keep a backup if you want to preserve an older vector configuration.

```bash
node dist/bin/codebase-indexer.js index . \
  --embedding-provider embeddinggemma-onnx \
  --embedding-dimensions 256 \
  --embedding-dtype q8
```

The first run downloads the ONNX model and tokenizer from Hugging Face; subsequent runs use the Transformers.js cache. Use `--embedding-cache-dir <path>` or `CODEBASE_EMBEDDING_CACHE_DIR` to choose a cache location. Supported CPU weight formats are `q4`, `q8`, and `fp32`; Q8 is the default. The CLI works directly in Node.js and does not launch VS Code or require Python.

### CLI / external embedding endpoint

The standalone CLI can also use any OpenAI-compatible `/v1/embeddings` server, including a separately hosted LiteRT-LM server:

```bash
node dist/bin/codebase-indexer.js index . \
  --embedding-provider openai-compatible \
  --embedding-base-url http://localhost:9379/v1 \
  --embedding-model embedding-gemma-v2.litertlm,gpu \
  --embedding-dimensions 256
```

Use `--embedding-api-key` or `CODEBASE_EMBEDDING_API_KEY` when authentication is required. The endpoint must accept OpenAI-style `POST /embeddings` requests and return vectors in the requested dimension. Changing provider/model/dimensions intentionally regenerates incompatible vectors; do not mix vectors from different embedding spaces in one index.
