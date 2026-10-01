You are building a completely standalone project called a modern codebase indexing engine.

This project will later be integrated into another application called AICore, but it MUST remain independent and usable on its own.

The project must provide:

1. A reusable TypeScript/Node.js library
2. A standalone CLI
3. A persistent binary index format
4. Incremental indexing
5. AST/symbol indexing
6. Relationship/dependency indexing
7. Lexical search
8. Symbol search
9. Optional semantic/vector indexing
10. Hybrid retrieval
11. A clean programmatic API that AICore can consume later

Do not implement this as an AICore-specific module.

==================================================
CORE PRODUCT
============

The project should behave conceptually like:

Codebase
|
v
Indexer Engine
|
v
{UID}.index
|
+---- CLI
|
+---- Node.js API
|
+---- Future AICore integration

The index should be completely independent of the application consuming it.

==================================================
PROJECT NAME / PACKAGE
======================

Use the existing project name if one already exists.

Otherwise structure it as a package that can eventually be published or consumed locally:

@aicore/codebase-indexer

or an equivalent neutral package name.

Do not hard-code AICore-specific logic into the indexer.

==================================================
TECHNOLOGY
==========

Use:

* TypeScript
* Node.js
* modern ESM where compatible
* Tree-sitter for AST parsing
* SQLite or an equivalent local implementation only if useful internally
* binary serialization for the exported persistent index
* worker threads where appropriate
* Node.js streams where useful

Keep dependencies minimal.

Do not introduce a huge framework just for the indexer.

==================================================
ARCHITECTURE
============

Use a modular architecture similar to:

src/
core/
CodebaseIndexer.ts
IndexManager.ts
WorkspaceScanner.ts
IndexPipeline.ts

scanner/
FileScanner.ts
IgnoreMatcher.ts
FileFilter.ts
LanguageDetector.ts

parser/
Parser.ts
TreeSitterParser.ts
ParserRegistry.ts
LanguageIndexer.ts

symbols/
SymbolExtractor.ts
ReferenceResolver.ts
SymbolGraph.ts

chunks/
SemanticChunker.ts

relations/
RelationExtractor.ts
RelationGraph.ts

search/
LexicalSearch.ts
SymbolSearch.ts
SemanticSearch.ts
HybridSearch.ts
Reranker.ts

embeddings/
EmbeddingProvider.ts
EmbeddingCache.ts
EmbeddingQueue.ts

storage/
BinaryIndex.ts
IndexReader.ts
IndexWriter.ts
IndexFormat.ts

context/
ContextBuilder.ts
ContextExpander.ts
TokenBudget.ts

cli/
commands/

types/
FileRecord.ts
Symbol.ts
Relation.ts
CodeChunk.ts
SearchResult.ts
IndexMetadata.ts

index.ts

bin/
codebase-indexer.ts

tests/

Adapt the structure if the project already has a better organization.

==================================================
BINARY INDEX FORMAT
===================

This is a major requirement.

The generated index MUST NOT be stored as plain JSON.

The index should be saved as:

{UID}.index

Example:

8c7f4e4d2c3a.index

The UID should uniquely identify the workspace/index.

Do NOT use:

project.json
index.json
database.json

as the primary index format.

The resulting .index file should be binary and not directly human-readable with a normal text editor.

==================================================
INDEX FORMAT DESIGN
===================

Design a versioned binary container.

Conceptually:

┌──────────────────────────┐
│ Magic bytes              │
├──────────────────────────┤
│ Format version           │
├──────────────────────────┤
│ Flags                    │
├──────────────────────────┤
│ UID                      │
├──────────────────────────┤
│ Metadata section         │
├──────────────────────────┤
│ File table               │
├──────────────────────────┤
│ Symbol table              │
├──────────────────────────┤
│ Relation table             │
├──────────────────────────┤
│ Chunk table               │
├──────────────────────────┤
│ Vector section            │
├──────────────────────────┤
│ String table              │
├──────────────────────────┤
│ Integrity/checksum        │
└──────────────────────────┘

Use a well-designed binary serialization strategy.

Possible approaches include:

* custom binary encoding using Node.js Buffer/DataView
* MessagePack
* CBOR
* another compact binary serializer

Choose the most appropriate option for:

* performance
* compactness
* forward compatibility
* random access where practical
* TypeScript support

Do not simply gzip a JSON file and call that the database.

The format must be explicitly versioned.

Example:

MAGIC = "AICIDX"

VERSION = 1

The reader must reject unsupported versions gracefully.

==================================================
OPTIONAL ENCRYPTION
===================

The default binary index only needs to be non-human-readable.

However, design the format so authenticated encryption can be added later.

Do NOT claim that binary serialization provides cryptographic security.

Potential future design:

binary serialization
|
v
compression
|
v
AES-256-GCM encryption
|
v
{UID}.index

For now:

binary serialization
|
v
optional compression
|
v
{UID}.index

Keep encryption as an explicit future/optional layer.

==================================================
INDEX UID
=========

Each workspace index must have a UID.

The UID should be stable for the same workspace.

Do not generate a completely new UID every time indexing runs.

Possible basis:

* normalized workspace identity
* installation-generated workspace identifier
* stable metadata

Store the UID inside the binary header.

Example:

workspace/
src/
package.json

produces:

.aicore-index/
2b7e1d9f...index

Do not require the index to be placed inside the project itself.

Allow users to configure the index directory.

==================================================
INDEX STORAGE
=============

By default use a hidden local index directory.

For example:

~/.cache/codebase-indexer/

or a platform-appropriate cache/data directory.

Allow:

codebase-indexer index ./my-project

to automatically determine the index location.

Also support:

--index-dir ./custom-index

The index filename must remain:

{UID}.index

==================================================
WORKSPACE METADATA
==================

Store metadata in the binary index:

* UID
* workspace root
* format version
* indexer version
* creation timestamp
* last update timestamp
* file count
* symbol count
* relation count
* chunk count
* vector count
* configuration hash

Do not rely exclusively on absolute paths.

Prefer workspace-relative paths inside the index so the index can potentially be relocated.

==================================================
FILE DISCOVERY
==============

Implement recursive file discovery.

Respect:

* .gitignore
* configurable ignore files
* custom exclude patterns
* binary detection
* maximum file size
* generated file detection where reliable

Default exclusions:

node_modules/
.git/
dist/
build/
out/
target/
coverage/
.cache/
.tmp/

Make these configurable.

==================================================
LANGUAGE SUPPORT
================

Use a parser abstraction.

Interface:

interface LanguageIndexer {
languages(): string[];

parse(source: string): unknown;

extractSymbols(tree: unknown): Symbol[];

extractRelations(tree: unknown): Relation[];

extractImports(tree: unknown): ImportInfo[];

extractExports(tree: unknown): ExportInfo[];
}

Use Tree-sitter where appropriate.

Support at least:

TypeScript
JavaScript
TSX
JSX
Python
Rust
Java
Kotlin
Go
C
C++
C#
PHP
Ruby
Swift
Dart
Bash
SQL
HTML
CSS
JSON
YAML
Markdown

For unsupported languages, use a generic fallback parser/chunker.

Make adding languages modular.

==================================================
SYMBOL INDEX
============

Extract:

* functions
* methods
* classes
* interfaces
* types
* enums
* variables
* constants
* modules
* namespaces
* constructors
* properties where useful

Example:

AuthService
|
+-- constructor
+-- login
+-- logout
+-- refreshToken

Store line/column ranges.

==================================================
RELATIONSHIP GRAPH
==================

Track:

* imports
* exports
* calls
* references
* extends
* implements
* contains
* defines
* overrides
* instantiates
* depends-on

Use confidence levels when a relationship cannot be resolved with certainty.

Do not assume perfect static analysis is possible for dynamic languages.

==================================================
SEMANTIC CHUNKS
===============

Do not primarily use fixed-size text chunks.

Prefer:

* functions
* methods
* classes
* modules
* interfaces
* configuration sections
* documentation sections

Preserve:

* file ID
* symbol ID
* start line
* end line
* chunk hash

For extremely large symbols, split intelligently while maintaining semantic metadata.

==================================================
INCREMENTAL INDEXING
====================

This is mandatory.

The engine must compare current files with the existing index.

Workflow:

scan
|
v
calculate hash
|
v
compare existing metadata
|
+-- unchanged --> skip
|
+-- changed --> re-index
|
+-- new --> index
|
+-- deleted --> remove

If one file changes:

DO NOT rebuild the entire repository.

Update only affected:

* file record
* symbols
* relations
* chunks
* embeddings

If relationship changes affect dependent records, update those records as necessary.

==================================================
INDEX WRITING
=============

Avoid corrupting the existing index if the process is interrupted.

Use an atomic write strategy:

{UID}.index.tmp
|
v
write complete binary index
|
v
validate/checksum
|
v
rename atomically
|
v
{UID}.index

Never leave the main index half-written.

If an existing valid index exists and indexing fails, preserve the previous valid index.

==================================================
INDEX READING
=============

Implement:

IndexReader

It should:

* validate magic bytes
* validate version
* validate UID
* validate checksum/integrity
* read metadata
* read files
* read symbols
* read relations
* read chunks
* read vectors

Expose lazy loading where useful.

Do not load massive vector data into memory unnecessarily.

==================================================
CLI
===

Provide a real CLI.

Command name:

codebase-indexer

The CLI must work independently from AICore.

==================================================
CLI COMMANDS
============

Implement:

codebase-indexer index <path>

Indexes a workspace.

Example:

codebase-indexer index .

Options:

--index-dir <path>
--force
--verbose
--json
--no-embeddings
--max-file-size <size>
--ignore <pattern>

==================================================

Implement:

codebase-indexer status <path>

Shows:

Workspace
UID
Index path
Indexer version
Last indexed
Files
Symbols
Relations
Chunks
Embeddings
Index size
Index status

==================================================

Implement:

codebase-indexer search <query>

Example:

codebase-indexer search "where is authentication implemented"

Options:

--path <workspace>
--index <file>
--limit <number>
--json
--semantic
--lexical
--symbol

==================================================

Implement:

codebase-indexer symbols <name>

Example:

codebase-indexer symbols AuthService

Show matching symbols and locations.

==================================================

Implement:

codebase-indexer references <symbol>

Find references to a symbol.

==================================================

Implement:

codebase-indexer callers <symbol>

Find callers.

==================================================

Implement:

codebase-indexer callees <symbol>

Find functions/methods called by the symbol.

==================================================

Implement:

codebase-indexer files

List indexed files.

Support:

--language
--pattern
--json

==================================================

Implement:

codebase-indexer inspect <index>

Inspect index metadata.

Do NOT dump the entire binary index as raw data.

Display readable metadata such as:

UID
format version
indexer version
workspace
file count
symbol count
relation count
chunk count
index size
timestamps

==================================================

Implement:

codebase-indexer remove <path>

Remove the workspace index.

Ask for confirmation unless:

--force

is provided.

==================================================
CLI OUTPUT
==========

Human-readable output by default.

Example:

Codebase Indexer

Workspace:
/home/user/project

Index:
~/.cache/codebase-indexer/91c2...index

UID:
91c2...

Files:
1,284

Symbols:
8,392

Relations:
12,441

Chunks:
14,208

Embeddings:
14,208

Status:
Up to date

For automation support:

--json

must return machine-readable JSON.

==================================================
WATCH MODE
==========

Implement:

codebase-indexer watch <path>

This keeps the index updated.

Workflow:

watch files
|
v
debounce
|
v
hash changed files
|
v
incremental update
|
v
atomic index write

Support:

--index-dir
--verbose

==================================================
PROGRAMMATIC API
================

Export a clean Node.js API.

Example:

import {
CodebaseIndexer,
IndexReader,
IndexManager
} from "@aicore/codebase-indexer";

const indexer = new CodebaseIndexer({
workspacePath: "/project"
});

await indexer.initialize();

await indexer.index();

const results = await indexer.search(
"Where is authentication implemented?"
);

Provide:

search()
findSymbol()
findDefinition()
findReferences()
findCallers()
findCallees()
getContext()
getFile()
getStats()

==================================================
SEARCH
======

Implement multiple search modes.

Lexical:

exact identifiers
text
paths
filenames

Symbol:

classes
functions
methods
interfaces
types

Semantic:

embeddings when configured

Graph:

relationships around relevant symbols

Hybrid:

combine all available signals.

The system must remain useful without embeddings.

==================================================
EMBEDDINGS
==========

Embeddings must be optional.

Create:

interface EmbeddingProvider {
dimensions(): number;

embed(text: string): Promise<number[]>;

embedBatch(texts: string[]): Promise<number[][]>;
}

Do not hard-code a provider.

Cache embeddings using chunk hashes.

If the embedding provider changes, detect incompatible vector dimensions/provider metadata and handle it safely.

==================================================
CONTEXT BUILDER
===============

Provide:

getContext(query, options)

It should:

1. search
2. rank
3. expand relevant graph relationships
4. deduplicate
5. select useful symbols/chunks
6. respect token/character budget
7. return structured context

Example:

{
files: [...],
symbols: [...],
relations: [...],
chunks: [...]
}

Preserve:

file path
line range
symbol name
relationship metadata

==================================================
PERFORMANCE
===========

Design for repositories ranging from:

100 files
to
100,000+ files

Do not promise perfect performance without benchmarking.

Use:

* incremental hashing
* bounded concurrency
* queues
* batching
* caching
* streaming where useful
* lazy vector loading
* efficient binary serialization

Do not keep an entire huge repository in memory unnecessarily.

==================================================
SECURITY / PRIVACY
==================

The indexer should be local-first.

Never upload source code automatically.

Embedding providers must be explicitly configured.

Document clearly that:

binary != encryption

The .index file is designed to avoid plain-text readability, not to provide cryptographic confidentiality.

Prepare the format for optional authenticated encryption in a future version.

==================================================
TESTS
=====

Create tests for:

* scanner
* ignore rules
* language detection
* hashing
* parsing
* symbols
* relations
* chunks
* binary writer
* binary reader
* corrupted index detection
* version mismatch
* atomic writes
* incremental indexing
* deleted files
* renamed files
* modified files
* search
* symbol lookup
* references
* callers
* callees
* context building
* CLI commands

Create fixture repositories with multiple languages.

==================================================
BINARY FORMAT TESTS
===================

Explicitly test that:

1. A generated index is named {UID}.index.
2. The index is binary.
3. Opening it in a text editor does not produce readable JSON.
4. The reader can reconstruct all index structures.
5. Corrupted indexes are detected.
6. Unsupported versions are rejected.
7. Interrupted writes don't destroy the previous valid index.
8. A new index can be written atomically.
9. Indexes can be moved and reopened where workspace-relative paths permit.
10. Index metadata can be inspected through the CLI.

==================================================
VERSIONING
==========

The binary format MUST have a format version independent from the package version.

Example:

INDEX_FORMAT_VERSION = 1

Future versions must be able to change the internal layout.

Do not make the binary format dependent on JavaScript object serialization.

Do NOT use:

JSON.stringify()
followed by Buffer.from()

as the actual serialization format.

The binary representation must be structured and explicitly versioned.

==================================================
ERROR HANDLING
==============

A single bad file must not terminate indexing.

Handle:

* invalid source
* parser failure
* unreadable file
* file deleted while indexing
* permission error
* corrupted index
* incompatible index version
* unavailable embedding provider
* insufficient disk space

Report errors clearly.

==================================================
LOGGING
=======

Provide structured logs.

Example:

[indexer] scanning
[indexer] discovered 1823 files
[indexer] 1764 unchanged
[indexer] indexing 59 changed files
[indexer] parsed AuthService.ts
[indexer] extracted 14 symbols
[indexer] extracted 22 relations
[indexer] generated 19 chunks
[indexer] writing binary index
[indexer] index updated successfully

Do not log source contents.

==================================================
DEVELOPMENT ORDER
=================

Implement in this order:

PHASE 1

* project architecture
* CLI skeleton
* scanner
* ignore rules
* hashing
* language detection

PHASE 2

* Tree-sitter integration
* parser abstraction
* symbol extraction
* semantic chunking

PHASE 3

* relation graph
* persistent internal data structures
* binary index format
* reader/writer

PHASE 4

* incremental indexing
* atomic writes
* file watching

PHASE 5

* lexical search
* symbol search
* references
* callers
* callees

PHASE 6

* embedding abstraction
* embedding cache
* vector search

PHASE 7

* hybrid search
* reranking
* graph expansion
* context builder

PHASE 8

* polish CLI
* tests
* documentation
* benchmarks

Do not skip directly to embeddings before the structural index works.

==================================================
DOCUMENTATION
=============

Create a README explaining:

* what the project is
* architecture
* installation
* CLI usage
* binary index format
* incremental indexing
* supported languages
* programmatic API
* search
* watch mode
* embedding providers
* privacy considerations
* limitations
* future integration with AICore

Include examples such as:

codebase-indexer index ./my-project

codebase-indexer status ./my-project

codebase-indexer search "authentication flow" ./my-project

codebase-indexer symbols AuthService ./my-project

codebase-indexer watch ./my-project

==================================================
FINAL REQUIREMENT
=================

Before making changes, inspect the repository and determine:

* package manager
* TypeScript configuration
* Node.js version
* existing CLI setup
* existing dependencies
* existing build system

Then implement the indexer as a standalone reusable project.

Do not modify unrelated files.

Do not create fake implementations.

Do not claim a feature is implemented unless it actually works.

At the end:

1. Build the project.
2. Run tests.
3. Run the CLI against a small fixture repository.
4. Create a real {UID}.index file.
5. Read it back using IndexReader.
6. Run a search against it.
7. Verify incremental indexing by modifying one source file.
8. Verify only the affected file is re-indexed.
9. Verify the final .index file is written atomically.
10. Report the implementation status and any remaining limitations.

The final product should be a standalone, reusable, local-first, modern codebase indexing engine that AICore can later consume through its Node.js API or CLI.
