# Codebase Indexer

A standalone, local-first TypeScript package and CLI for scanning workspaces, persisting file metadata in a binary index, incremental updates, and lexical search. The package is independent of any consuming application.

## Requirements

Node.js 20 or newer. Install dependencies and build with `npm install` and `npm run build`.

## CLI

Install the CLI with `npm install -g @aicore/codebase-indexer`, then run `codebase-indexer`. In a checkout, use `node dist/bin/codebase-indexer.js`:

```sh
codebase-indexer index ./my-project
codebase-indexer status ./my-project
codebase-indexer search "authentication flow" --path ./my-project
codebase-indexer symbols AuthService --path ./my-project
codebase-indexer files ./my-project --language typescript
codebase-indexer watch ./my-project --verbose
codebase-indexer inspect ~/.cache/codebase-indexer/<uid>.index
codebase-indexer remove ./my-project --force
```

The index is written under `~/.cache/codebase-indexer/` by default. Use `--index-dir` to select another directory. The filename is the stable workspace UID followed by `.index`. `index --force` rebuilds file records, and `--json` emits machine-readable output. `--ignore` may be repeated; root and nested `.gitignore` rules, along with standard generated/dependency directories, are applied. The CLI does not configure embedding providers.

## API

```ts
import { CodebaseIndexer } from '@aicore/codebase-indexer';

const indexer = new CodebaseIndexer({ workspacePath: '/project' });
await indexer.initialize();
const update = await indexer.index();
const matches = await indexer.search('authentication token');
const symbols = await indexer.findSymbol('AuthService');
const context = await indexer.getContext('authentication flow', { maxTokens: 4000 });
```

`IndexManager`, `IndexReader`, `IndexWriter`, scanner types, and `INDEX_FORMAT_VERSION` are also exported.

To enable semantic indexing, pass an explicit `EmbeddingProvider` implementation to `CodebaseIndexer` or `IndexManager`. The provider is never selected automatically. Reindexing with a different provider ID or dimensions rebuilds stored vectors.

## Binary format and privacy

The `.index` file uses a `CBIDX` magic header, an independent format version, a workspace UID, a MessagePack payload, and a SHA-256 integrity checksum. Writes go to a temporary file and are atomically renamed into place. Unsupported versions and checksum failures are rejected. The payload currently stores workspace metadata and file records, including hashes and normalized search terms.

Binary encoding is not encryption. Indexes remain local; no source or index data is uploaded. Lexical terms may reveal information about indexed source, so protect the index directory as you would other local development data.

## Current scope

Implemented: recursive scanning, root and nested `.gitignore` rules and default exclusions, binary and maximum-size filtering, language detection, AST indexing with bundled Tree-sitter grammars, semantic chunks, stable workspace IDs, atomic binary persistence, incremental file add/change/delete detection, lexical and optional vector search, context building, file listing, metadata inspection, and debounced watch mode. Files without a bundled Tree-sitter grammar still receive lexical indexing and fallback chunks.

Relationship extraction and resolution are partial: recorded calls, imports, references, and inheritance-like relations are heuristic, and symbol resolution is incomplete. Embeddings require an explicitly configured provider through the API; the CLI does not yet configure providers. Lazy loading for large vector collections and performance benchmarks are outstanding. Binary encoding is not encryption.