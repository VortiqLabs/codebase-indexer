# MCP Server (Model Context Protocol)

The `@vortiqlabs/codebase-indexer` MCP server acts as a thin adapter layer over the core static analysis engine, enabling AI agents (e.g. Claude Desktop, Cursor, Windsurf, Zed) to query codebase intelligence deterministically.

## Starting the MCP Server

```bash
# Executable binary command
codebase-indexer-mcp

# Or via CLI subcommand
codebase-indexer mcp [--index-dir <path>]
```

## IDE & Agent Configurations

### Claude Desktop Configuration (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "codebase-indexer": {
      "command": "npx",
      "args": ["-y", "@vortiqlabs/codebase-indexer", "mcp"],
      "env": {
        "CODEBASE_INDEX_DIR": "/home/user/.cache/codebase-indexer",
        "GITHUB_TOKEN": "ghp_optional_private_token"
      }
    }
  }
}
```

---

## Tool Reference

### Navigation & Discovery
- `list_indexes`: List all available `.index` snapshot files.
- `get_repository_map`: Get compact repository structural map.
- `read_indexed_file`: Read a source file within an index.

### Symbol Intelligence
- `find_symbol`: Find matching symbol definitions.
- `get_symbol`: Get exact symbol details by ID or name.
- `find_references`: Find all references targeting a symbol.
- `find_callers`: Find incoming callers for a symbol.
- `find_callees`: Find outgoing calls invoked by a symbol.
- `find_implementations`: Find class/interface implementations or extensions.
- `explain_symbol`: Get aggregated structural explanation for a symbol.

### Graph & Dependencies
- `get_dependencies`: Get direct and transitive dependencies.
- `get_dependents`: Get reverse dependents.
- `find_dependency_path`: Find call or dependency path between two symbols.
- `find_dependency_cycles`: Detect dependency cycles in the symbol graph.

### Context & Impact
- `build_context`: Assemble context within token budget for AI prompts.
- `analyze_impact`: Perform impact analysis for symbol or file changes.

### Test & API Intelligence
- `find_tests`: Find test files and functions for a symbol or file.
- `find_affected_tests`: Find test files affected by modified source files.
- `find_api`: Find API endpoint by route or handler name.
- `list_apis`: List all detected HTTP API endpoints.

### Database, Git, & Complexity
- `get_database_schema`: Get Prisma models, SQL tables, and ORM schemas.
- `get_git_history`: Get recent git commits and status.
- `get_changes`: Get uncommitted file changes.
- `get_complexity`: Get cyclomatic complexity and LOC metrics.
- `get_hotspots`: Get high-risk change hotspots.
