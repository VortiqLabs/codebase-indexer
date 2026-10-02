# Codebase Indexer

A standalone, local-first TypeScript package and CLI for scanning workspaces, persisting file metadata in a binary index, incremental updates, and lexical search. The package is independent of any consuming application.

## Requirements

Node.js 20 or newer. Install dependencies and build with `npm install` and `npm run build`.

## CLI

Install the private CLI with `npm install -g @vortiqlabs/codebase-indexer`, then run `codebase-indexer`. Authenticate to GitHub Packages with a personal access token (classic) that has `read:packages`, and configure `@vortiqlabs:registry=https://npm.pkg.github.com` in your npm configuration. In a checkout, use `node dist/bin/codebase-indexer.js`:

```sh
codebase-indexer index ./my-project
codebase-indexer index-github octocat/Hello-World --ref main
codebase-indexer status ./my-project
codebase-indexer search "authentication flow" --path ./my-project
codebase-indexer symbols AuthService --path ./my-project
codebase-indexer files ./my-project --language typescript
codebase-indexer watch ./my-project --verbose
codebase-indexer inspect ~/.cache/codebase-indexer/<uid>.index
codebase-indexer remove ./my-project --force
codebase-indexer dashboard
```

The index is written under `~/.cache/codebase-indexer/` by default. Use `--index-dir` to select another directory. The filename is the stable workspace UID followed by `.index`. `index --force` rebuilds file records, and `--json` emits machine-readable output. `--ignore` may be repeated; root and nested `.gitignore` rules, along with standard generated/dependency directories, are applied. The CLI does not configure embedding providers.

`codebase-indexer index-github OWNER/REPOSITORY` indexes the default branch of a public or private GitHub repository. Add `--ref <branch-or-tag>` to select a ref. Large repositories are discovered with a path-only scan, then indexed in isolated workers with batches capped at 100 files or 32 MiB of source, whichever comes first. Each part is independently searchable; relations resolve within each part. Public repositories need no credential; private repositories require `GITHUB_TOKEN` or `GH_TOKEN` in the process environment. GitHub tokens are never accepted as command arguments. Repository snapshots are stored below the index directory in `.github-repositories/` and their indexes are available alongside local indexes.

`codebase-indexer dashboard` starts a local Express dashboard that groups GitHub shards into one repository row with aggregate file/symbol/relation totals; expand a row to select an individual part graph. Search and overview totals span all parts. Its GitHub form accepts public or private repository URLs, refs, optional ignore patterns, and a maximum file size; live logs report download, extraction, scan, parse, and save progress. Large imports use isolated workers and batches capped at 100 files or 32 MiB of source. Exclude test/fixture paths or lower the file-size cap for especially dense source trees. Only one dashboard GitHub import runs at a time. Search results link directly to an animated, zoomable graph of all symbols; toggle relation types and hover a symbol to isolate its connections. Click any graph symbol to open its source file in a local Monaco Editor panel with the symbol's lines selected. It binds to `127.0.0.1:4173` by default. Use `--index-dir <path>`, `--host <host>`, or `--port <port>` to change its settings. Dashboard index reads are isolated to bounded worker threads; vector loading is not lazy.

## API

```ts
import { CodebaseIndexer } from '@vortiqlabs/codebase-indexer';

const indexer = new CodebaseIndexer({ workspacePath: '/project' });
await indexer.initialize();
const update = await indexer.index();
const matches = await indexer.search('authentication token');
const symbols = await indexer.findSymbol('AuthService');
const context = await indexer.getContext('authentication flow', { maxTokens: 4000 });
```

`IndexManager`, `IndexReader`, `IndexWriter`, scanner types, and `INDEX_FORMAT_VERSION` are also exported.

## MCP Server

Run `codebase-indexer mcp` or `codebase-indexer-mcp` to expose the indexer over the Model Context Protocol stdio transport. Example MCP client configuration:

```json
{
	"mcpServers": {
		"codebase-indexer": {
			"command": "codebase-indexer",
			"args": ["mcp"],
			"env": {
				"CODEBASE_INDEX_DIR": "/home/me/.cache/codebase-indexer"
			}
		}
	}
}
```

The server provides `list_indexes`, `search_code`, `read_indexed_file`, `get_symbol_relations`, `index_local_workspace`, and `index_github_repository` tools. For private GitHub repositories, provide `GITHUB_TOKEN` or `GH_TOKEN` through the MCP client's server environment; grant repository contents read access and do not commit the token in client configuration. The GitHub indexing tool accepts `owner`, `repository`, and optional `ref` arguments, never a credential.

## Publishing

Push a version tag such as `v0.1.0` to publish to GitHub Packages. Update the `version` in `package.json` to match the tag first. The workflow runs the full test suite and publishes with `GITHUB_TOKEN`; new GitHub npm packages are private by default. Consumers need access to the repository/package and a token with `read:packages`.

To enable semantic indexing, pass an explicit `EmbeddingProvider` implementation to `CodebaseIndexer` or `IndexManager`. The provider is never selected automatically. Reindexing with a different provider ID or dimensions rebuilds stored vectors.

## Binary format and privacy

The `.index` file uses a `CBIDX` magic header, an independent format version, a workspace UID, a MessagePack payload, and a SHA-256 integrity checksum. Writes go to a temporary file and are atomically renamed into place. Unsupported versions and checksum failures are rejected. The payload currently stores workspace metadata and file records, including hashes and normalized search terms.

Binary encoding is not encryption. Indexes remain local; no source or index data is uploaded. Lexical terms may reveal information about indexed source, so protect the index directory as you would other local development data.

## Current scope

Implemented: recursive scanning, root and nested `.gitignore` rules and default exclusions, binary and maximum-size filtering, language detection, AST indexing with bundled Tree-sitter grammars, semantic chunks, stable workspace IDs, atomic binary persistence, incremental file add/change/delete detection, lexical and optional vector search, context building, file listing, metadata inspection, and debounced watch mode. Files without a bundled Tree-sitter grammar still receive lexical indexing and fallback chunks.

Additional bundled grammars cover Elm, QL, YAML, Markdown, SQL, Dockerfile, Makefile, and `.gitignore`. See [src/parser/grammars/README.md](src/parser/grammars/README.md) for grammar asset provenance.

Relationship extraction and resolution are partial: recorded calls, imports, references, and inheritance-like relations are heuristic, and symbol resolution is incomplete. Embeddings require an explicitly configured provider through the API; the CLI does not yet configure providers. Lazy loading for large vector collections and performance benchmarks are outstanding. Binary encoding is not encryption.