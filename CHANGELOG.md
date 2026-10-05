# Changelog

All notable changes to `@vortiqlabs/codebase-indexer` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2025-02-23

### Added
- **Impact Analysis (`ImpactAnalyzer`)**: Static ripple effect analysis with `DIRECT`, `TRANSITIVE`, and `POSSIBLE` confidence levels, mapping symbol changes to affected files, APIs, and tests.
- **Test Intelligence (`TestAnalyzer`)**: Automated mapping of production code to tests, and discovery of affected test suites based on changed files.
- **Database Intelligence (`DatabaseAnalyzer`)**: Static detection and schema extraction for Prisma (`schema.prisma`), SQL DDL migrations, and ORM entity models.
- **Git Intelligence & Change Coupling (`GitHistory`, `ChangeAnalyzer`)**: Commit history inspection, uncommitted change tracking, historical co-change coupling percentage calculation, and hotspot identification.
- **Complexity & Quality Metrics (`ComplexityAnalyzer`, `DuplicateDetector`)**: Cyclomatic complexity heuristics, LOC calculations, function/class size metrics, and exact/structural code duplication detection.
- **Deterministic Symbol Explanations (`ExplainSymbol`)**: Aggregated structural summary of symbol definitions, callers, callees, references, export status, tests, APIs, and database relations without LLM dependencies.
- **CLI Commands**: Added `impact`, `tests`, `affected-tests`, `database`, `history`, `changes`, `coupling`, `complexity`, `hotspots`, `duplicates`, `explain`, and `cycles`.
- **MCP Server Tools**: Added MCP tool adapters for `get_repository_map`, `find_symbol`, `get_symbol`, `find_references`, `find_callers`, `find_callees`, `find_implementations`, `get_dependencies`, `get_dependents`, `find_dependency_path`, `find_dependency_cycles`, `build_context`, `analyze_impact`, `find_tests`, `find_affected_tests`, `find_api`, `list_apis`, `get_database_schema`, `get_git_history`, `get_changes`, `get_complexity`, `get_hotspots`, and `explain_symbol`.

### Fixed
- Fixed runtime WASM grammar and tree-sitter path resolution in `src/runtime/runtime-paths.ts` and `TreeSitterParser.ts`.
- Fixed ES module worker thread paths in `GitHubRepositoryIndexer.ts` and `DashboardServer.ts`.
- Fixed Monaco Editor asset copying paths in build configuration.

### Compatibility
- Preserved 100% backwards compatibility with existing `.index` binary file format versioning.
- Preserved existing CLI commands, library APIs, and MCP tools.
