export const DASHBOARD_PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Codebase Index Dashboard — IDE Code Intelligence</title>
  <style>
    :root, [data-theme="dark"] {
      color-scheme: dark;
      --bg: #080808;
      --surface: #0b0b0b;
      --surface-elevated: #101010;
      --surface-hover: #141414;
      --surface-active: #181818;
      --border: #242424;
      --border-strong: #2d2d2d;
      --text-main: #ffffff;
      --text-muted: #bdbdbd;
      --text-subtle: #8a8a8a;
      --text-disabled: #666666;
      --accent-active: #ffffff;
      --mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
      --sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    [data-theme="light"] {
      color-scheme: light;
      --bg: #ffffff;
      --surface: #fafafa;
      --surface-elevated: #f5f5f5;
      --surface-hover: #eeeeee;
      --surface-active: #e5e5e5;
      --border: #e5e5e5;
      --border-strong: #d8d8d8;
      --text-main: #111111;
      --text-muted: #222222;
      --text-subtle: #444444;
      --text-disabled: #888888;
      --accent-active: #111111;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: var(--bg); color: var(--text-main); font-family: var(--sans); font-size: 13px; line-height: 1.45; }
    button, input, select, textarea { font: inherit; color: inherit; }
    a { color: inherit; text-decoration: none; }

    .ide-shell { display: grid; grid-template-rows: 48px 1fr; width: 100vw; height: 100vh; overflow: hidden; }
    .top-bar { display: flex; align-items: center; justify-content: space-between; padding: 0 16px; background: var(--surface); border-bottom: 1px solid var(--border); }
    .brand-group { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 13px; }
    .brand-icon { width: 22px; height: 22px; background: var(--text-main); color: var(--bg); border-radius: 4px; display: grid; place-items: center; font-family: var(--mono); font-weight: 800; font-size: 11px; }
    .workspace-path { color: var(--text-subtle); font-family: var(--mono); font-size: 11px; font-weight: 400; }

    .command-search { position: relative; width: min(440px, 35vw); }
    .command-search input { width: 100%; height: 30px; background: var(--surface-elevated); border: 1px solid var(--border); border-radius: 6px; padding: 0 32px 0 10px; font-size: 12px; outline: none; }
    .command-search input:focus { border-color: var(--border-strong); }
    .kbd-shortcut { position: absolute; right: 8px; top: 6px; font-family: var(--mono); font-size: 10px; color: var(--text-disabled); border: 1px solid var(--border); border-radius: 3px; padding: 1px 4px; }
    .index-picker { display: flex; align-items: center; gap: 7px; min-width: 180px; max-width: 320px; }
    .index-picker-label { color: var(--text-subtle); font-family: var(--mono); font-size: 9px; letter-spacing: 0.08em; }
    .index-picker select { width: 100%; min-width: 0; height: 30px; background: var(--surface-elevated); border: 1px solid var(--border); border-radius: 6px; padding: 0 8px; outline: none; font-size: 11px; }
    .index-picker select:focus { border-color: var(--border-strong); }

    .top-actions { display: flex; align-items: center; gap: 12px; font-family: var(--mono); font-size: 11px; }
    .status-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--text-main); }
    .btn-top { background: var(--surface-elevated); border: 1px solid var(--border); padding: 4px 10px; border-radius: 5px; cursor: pointer; font-size: 11px; }
    .btn-top:hover { background: var(--surface-hover); border-color: var(--border-strong); }

    .main-body { display: grid; grid-template-columns: 230px 1fr; height: calc(100vh - 48px); overflow: hidden; }
    .sidebar { background: var(--surface); border-right: 1px solid var(--border); overflow-y: auto; padding: 10px 0; display: flex; flex-direction: column; gap: 16px; }
    .nav-section { display: flex; flex-direction: column; gap: 1px; }
    .nav-section-title { padding: 4px 16px; font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-disabled); }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 6px 16px; color: var(--text-muted); font-size: 12px; font-weight: 500; cursor: pointer; border-left: 2px solid transparent; transition: background 0.12s, color 0.12s; }
    .nav-item:hover { background: var(--surface-hover); color: var(--text-main); }
    .nav-item.active { background: var(--surface-active); color: var(--text-main); font-weight: 600; border-left-color: var(--text-main); }

    .content-viewport { position: relative; overflow-y: auto; background: var(--bg); padding: 20px 24px; display: flex; flex-direction: column; gap: 20px; }
    .panel { display: none; flex-direction: column; gap: 16px; }
    .panel.active { display: flex; }

    .panel-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
    .panel-header h1 { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
    .panel-header p { font-size: 12px; color: var(--text-subtle); margin-top: 2px; }

    .grid-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 12px 14px; }
    .stat-val { font-family: var(--mono); font-size: 18px; font-weight: 700; color: var(--text-main); }
    .stat-lbl { font-family: var(--mono); font-size: 10px; text-transform: uppercase; color: var(--text-subtle); margin-top: 4px; }

    .ide-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 14px 16px; }
    .card-title { font-size: 13px; font-weight: 600; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
    .card-title span { font-family: var(--mono); font-size: 10px; color: var(--text-subtle); font-weight: 400; text-transform: uppercase; }

    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); }
    th { font-family: var(--mono); font-size: 10px; text-transform: uppercase; color: var(--text-subtle); background: var(--surface-elevated); position: sticky; top: 0; }
    td { font-family: var(--mono); color: var(--text-muted); }
    tr:hover td { background: var(--surface-hover); color: var(--text-main); }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; background: var(--surface-elevated); border: 1px solid var(--border); font-family: var(--mono); font-size: 10px; color: var(--text-subtle); }

    .drawer { position: fixed; right: 0; top: 48px; bottom: 0; width: 420px; background: var(--surface); border-left: 1px solid var(--border); z-index: 10; transform: translateX(100%); transition: transform 0.2s ease; display: flex; flex-direction: column; padding: 16px; gap: 14px; box-shadow: -10px 0 30px rgba(0,0,0,0.3); }
    .drawer.open { transform: translateX(0); }
    .drawer-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
    .drawer-close { background: transparent; border: none; font-size: 16px; cursor: pointer; color: var(--text-subtle); }

    .cmd-palette-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 100; display: none; place-items: center; }
    .cmd-palette-overlay.open { display: grid; }
    .cmd-palette { width: min(600px, 90vw); background: var(--surface); border: 1px solid var(--border-strong); border-radius: 8px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); overflow: hidden; display: flex; flex-direction: column; }
    .cmd-input { width: 100%; height: 44px; background: transparent; border: none; border-bottom: 1px solid var(--border); padding: 0 16px; font-size: 14px; outline: none; }
    .cmd-results { max-height: 320px; overflow-y: auto; padding: 8px 0; }
    .cmd-item { padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 12px; }
    .cmd-item:hover, .cmd-item.selected { background: var(--surface-hover); color: var(--text-main); }

    .tab-bar { display: flex; gap: 2px; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
    .tab-item { padding: 6px 12px; border-bottom: 2px solid transparent; cursor: pointer; font-size: 12px; font-family: var(--mono); color: var(--text-subtle); }
    .tab-item.active { border-bottom-color: var(--text-main); color: var(--text-main); font-weight: 600; }

    .flex-row { display: flex; gap: 12px; align-items: center; }
    .input-ide { height: 30px; background: var(--surface-elevated); border: 1px solid var(--border); border-radius: 5px; padding: 0 10px; font-size: 12px; outline: none; }
    .btn-ide { height: 30px; background: var(--surface-elevated); border: 1px solid var(--border); padding: 0 12px; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 500; }
    .btn-ide:hover { background: var(--surface-hover); border-color: var(--border-strong); }
  </style>
</head>
<body>
  <div class="ide-shell">
    <header class="top-bar">
      <div class="brand-group">
        <span class="brand-icon">CI</span>
        <span>Codebase Indexer</span>
        <span class="workspace-path" id="top-workspace-path">Loading workspace…</span>
      </div>

      <div class="command-search" id="cmd-trigger">
        <input id="index-filter" type="text" placeholder="Filter workspaces or search (⌘K)" readonly>
        <span class="kbd-shortcut">⌘K</span>
      </div>

      <div class="top-actions">
        <label class="index-picker"><span class="index-picker-label">INDEX FILE</span><select id="index-select" aria-label="Choose index file"><option value="">Loading indexes…</option></select></label>
        <span><i class="status-dot"></i> <span id="top-status">Index up to date</span></span>
        <span class="badge" id="top-branch">main</span>
        <button class="btn-top" id="btn-reindex">Re-index</button>
        <button class="btn-top" id="btn-theme-toggle">Theme</button>
      </div>
    </header>

    <div class="main-body">
      <aside class="sidebar">
        <div class="nav-section">
          <div class="nav-section-title">Overview</div>
          <div class="nav-item active" data-target="panel-overview">Overview</div>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Workspace</div>
          <div class="nav-item" data-target="panel-repository">Repository</div>
          <div class="nav-item" data-target="panel-files">Files</div>
          <div class="nav-item" data-target="panel-symbols">Symbols</div>
          <div class="nav-item" data-target="panel-references">References</div>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Graphs & Relations</div>
          <div class="nav-item" data-target="panel-callgraph">Call Graph</div>
          <div class="nav-item" data-target="panel-dependencies">Dependencies</div>
          <a class="nav-item" id="nav-dep-graph" href="#" target="_blank">Dependency Graph ↗</a>
          <div class="nav-item" data-target="panel-chunks">Chunks</div>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Intelligence</div>
          <div class="nav-item" data-target="panel-search">Search</div>
          <div class="nav-item" data-target="panel-apis">APIs</div>
          <div class="nav-item" data-target="panel-database">Database</div>
          <div class="nav-item" data-target="panel-tests">Tests</div>
          <div class="nav-item" data-target="panel-config">Configuration</div>
          <div class="nav-item" data-target="panel-docs">Documentation</div>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Git & History</div>
          <div class="nav-item" data-target="panel-git">Git Activity</div>
          <div class="nav-item" data-target="panel-changes">Changes</div>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Metrics & Security</div>
          <div class="nav-item" data-target="panel-complexity">Complexity</div>
          <div class="nav-item" data-target="panel-duplicates">Duplicates</div>
          <div class="nav-item" data-target="panel-security">Security</div>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">System & Health</div>
          <div class="nav-item" data-target="panel-health">Index Health</div>
          <div class="nav-item" data-target="panel-inspector">Index Inspector</div>
          <div class="nav-item" data-target="panel-settings">Settings</div>
        </div>
      </aside>

      <main class="content-viewport">
        <!-- 1. OVERVIEW PANEL -->
        <section class="panel active" id="panel-overview">
          <div class="panel-header">
            <div>
              <h1>Overview</h1>
              <p>Code intelligence command center</p>
            </div>
            <div class="flex-row">
              <a id="overview-export-json" class="btn-ide" href="#" download>Export JSON</a>
              <a id="overview-export-csv" class="btn-ide" href="#" download>Export CSV</a>
            </div>
          </div>

          <div class="grid-stats" id="overview-stats"></div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
            <div class="ide-card">
              <div class="card-title">Repository Architecture <span>Top Areas</span></div>
              <div id="overview-areas"></div>
            </div>
            <div class="ide-card">
              <div class="card-title">Relation makeup <span>Relation Makeup</span></div>
              <div id="overview-memory" class="grid-stats"></div>
            </div>
          </div>

          <div class="ide-card">
            <div class="card-title">GitHub Importer <span>Local Repository Scan</span></div>
            <form id="github-form" class="flex-row" style="margin-top:6px;">
              <input id="github-url" class="input-ide" style="flex:1;" type="url" placeholder="https://github.com/owner/repository" required>
              <input id="github-ref" class="input-ide" style="width:120px;" type="text" placeholder="Branch">
              <input id="github-size" type="number" min="0.001" max="100" step="0.001" value="1" hidden>
              <button class="btn-ide" type="submit">Import</button>
            </form>
            <div id="github-log" style="height:80px; overflow-y:auto; font-family:var(--mono); font-size:10px; margin-top:10px; background:var(--bg); border:1px solid var(--border); padding:8px; display:none;"></div>
          </div>
        </section>

        <!-- 2. REPOSITORY PANEL -->
        <section class="panel" id="panel-repository">
          <div class="panel-header">
            <div><h1>Repository Explorer</h1><p>Directories, packages, and modules</p></div>
          </div>
          <div class="ide-card">
            <div id="repository-tree">Loading repository tree…</div>
          </div>
        </section>

        <!-- 3. FILES PANEL -->
        <section class="panel" id="panel-files">
          <div class="panel-header">
            <div><h1>Files</h1><p>Indexed workspace file inventory</p></div>
            <input id="file-filter" class="input-ide" type="search" placeholder="Filter files…">
          </div>
          <div class="ide-card" style="padding:0; overflow:hidden;">
            <table>
              <thead><tr><th>Path</th><th>Language</th><th>Size</th><th>Terms</th><th>Actions</th></tr></thead>
              <tbody id="files-table-body"></tbody>
            </table>
          </div>
        </section>

        <!-- 4. SYMBOLS PANEL -->
        <section class="panel" id="panel-symbols">
          <div class="panel-header">
            <div><h1>Symbols</h1><p>Classes, functions, methods, interfaces, and variables</p></div>
            <input id="symbol-filter" class="input-ide" type="search" placeholder="Filter symbols…">
          </div>
          <div class="ide-card" style="padding:0; overflow:hidden;">
            <table>
              <thead><tr><th>Symbol</th><th>Kind</th><th>File</th><th>Line</th><th>Parent</th></tr></thead>
              <tbody id="symbols-table-body"></tbody>
            </table>
          </div>
        </section>

        <!-- 5. REFERENCES PANEL -->
        <section class="panel" id="panel-references">
          <div class="panel-header"><div><h1>References</h1><p>Cross-symbol usages and calls</p></div></div>
          <div class="ide-card" style="padding:0; overflow:hidden;">
            <table>
              <thead><tr><th>Kind</th><th>File</th><th>Target</th><th>Confidence</th></tr></thead>
              <tbody id="references-table-body"></tbody>
            </table>
          </div>
        </section>

        <!-- 6. CALL GRAPH PANEL -->
        <section class="panel" id="panel-callgraph">
          <div class="panel-header"><div><h1>Call Graph</h1><p>Resolved caller and callee hierarchies</p></div></div>
          <div class="ide-card" id="callgraph-list">Loading call relationships…</div>
        </section>

        <!-- 7. DEPENDENCIES PANEL -->
        <section class="panel" id="panel-dependencies">
          <div class="panel-header"><div><h1>Dependencies</h1><p>Internal and external module connections</p></div></div>
          <div class="ide-card" id="dependencies-list">Loading dependencies…</div>
        </section>

        <!-- 8. CHUNKS PANEL -->
        <section class="panel" id="panel-chunks">
          <div class="panel-header"><div><h1>Code Chunks</h1><p>Parsed semantic chunks and hashes</p></div></div>
          <div class="ide-card" style="padding:0; overflow:hidden;">
            <table>
              <thead><tr><th>Hash</th><th>File</th><th>Lines</th><th>Excerpt</th></tr></thead>
              <tbody id="chunks-table-body"></tbody>
            </table>
          </div>
        </section>

        <!-- 9. SEARCH PANEL -->
        <section class="panel" id="panel-search">
          <div class="panel-header"><div><h1>Local Search</h1><p>Deterministic term search across indexed code</p></div></div>
          <div class="flex-row">
            <input id="search-input" class="input-ide" style="flex:1; height:36px;" type="search" placeholder="Type term or pattern to search…">
            <button id="search-btn" class="btn-ide" style="height:36px;">Search</button>
          </div>
          <div class="ide-card" id="search-results">Type at least 2 characters to search.</div>
        </section>

        <!-- 10. APIS PANEL -->
        <section class="panel" id="panel-apis">
          <div class="panel-header"><div><h1>API Intelligence</h1><p>Detected HTTP endpoints and routes</p></div></div>
          <div class="ide-card" style="padding:0; overflow:hidden;">
            <table>
              <thead><tr><th>Method</th><th>Path</th><th>File</th><th>Line</th></tr></thead>
              <tbody id="apis-table-body"></tbody>
            </table>
          </div>
        </section>

        <!-- 11. DATABASE PANEL -->
        <section class="panel" id="panel-database">
          <div class="panel-header"><div><h1>Database Intelligence</h1><p>Prisma models, SQL schemas, and ORM entities</p></div></div>
          <div class="ide-card" style="padding:0; overflow:hidden;">
            <table>
              <thead><tr><th>Model / Table</th><th>Type</th><th>File</th></tr></thead>
              <tbody id="database-table-body"></tbody>
            </table>
          </div>
        </section>

        <!-- 12. TESTS PANEL -->
        <section class="panel" id="panel-tests">
          <div class="panel-header"><div><h1>Test Intelligence</h1><p>Test files and mapped source symbols</p></div></div>
          <div class="ide-card" style="padding:0; overflow:hidden;">
            <table>
              <thead><tr><th>Test File</th><th>Framework</th><th>Test Symbol</th><th>Mapped Target</th></tr></thead>
              <tbody id="tests-table-body"></tbody>
            </table>
          </div>
        </section>

        <!-- 13. CONFIGURATION PANEL -->
        <section class="panel" id="panel-config">
          <div class="panel-header"><div><h1>Configuration</h1><p>Workspace config files and settings</p></div></div>
          <div class="ide-card" id="config-list">Loading configuration files…</div>
        </section>

        <!-- 14. DOCUMENTATION PANEL -->
        <section class="panel" id="panel-docs">
          <div class="panel-header"><div><h1>Documentation</h1><p>Markdown docs and linked symbol references</p></div></div>
          <div class="ide-card" id="docs-list">Loading documentation…</div>
        </section>

        <!-- 15. GIT PANEL -->
        <section class="panel" id="panel-git">
          <div class="panel-header"><div><h1>Git Activity</h1><p>Local commits and repository history</p></div></div>
          <div class="ide-card" style="padding:0; overflow:hidden;">
            <table>
              <thead><tr><th>Hash</th><th>Author</th><th>Date</th><th>Subject</th></tr></thead>
              <tbody id="git-table-body"></tbody>
            </table>
          </div>
        </section>

        <!-- 16. CHANGES PANEL -->
        <section class="panel" id="panel-changes">
          <div class="panel-header"><div><h1>Changes</h1><p>Local uncommitted git modifications</p></div></div>
          <div class="ide-card" style="padding:0; overflow:hidden;">
            <table>
              <thead><tr><th>Status</th><th>File Path</th></tr></thead>
              <tbody id="changes-table-body"></tbody>
            </table>
          </div>
        </section>

        <!-- 17. COMPLEXITY PANEL -->
        <section class="panel" id="panel-complexity">
          <div class="panel-header"><div><h1>Complexity Metrics</h1><p>Cyclomatic estimate, LOC, fan-in, fan-out</p></div></div>
          <div class="ide-card" style="padding:0; overflow:hidden;">
            <table>
              <thead><tr><th>File Path</th><th>Language</th><th>LOC</th><th>Est. Complexity</th><th>Fan-in</th><th>Fan-out</th></tr></thead>
              <tbody id="complexity-table-body"></tbody>
            </table>
          </div>
        </section>

        <!-- 18. DUPLICATES PANEL -->
        <section class="panel" id="panel-duplicates">
          <div class="panel-header"><div><h1>Duplicate Code</h1><p>Structural chunk match candidates</p></div></div>
          <div class="ide-card" id="duplicates-list">Scanning for duplicate structures…</div>
        </section>

        <!-- 19. SECURITY PANEL -->
        <section class="panel" id="panel-security">
          <div class="panel-header"><div><h1>Security Findings</h1><p>Redacted sensitive credential candidates</p></div></div>
          <div class="ide-card" style="padding:0; overflow:hidden;">
            <table>
              <thead><tr><th>Kind</th><th>Location</th><th>Confidence</th><th>Value</th></tr></thead>
              <tbody id="security-table-body"></tbody>
            </table>
          </div>
        </section>

        <!-- 20. HEALTH PANEL -->
        <section class="panel" id="panel-health">
          <div class="panel-header">
            <div><h1>Index Health</h1><p>Snapshot integrity and reference validation</p></div>
            <button id="btn-repair-index" class="btn-ide">Repair & Clear Cache</button>
          </div>
          <div class="ide-card" id="health-report">Checking index health…</div>
        </section>

        <!-- 21. INSPECTOR PANEL -->
        <section class="panel" id="panel-inspector">
          <div class="panel-header"><div><h1>Index Inspector</h1><p>Binary Index Header and Section Stats</p></div></div>
          <div class="grid-stats" id="inspector-stats"></div>
        </section>

        <!-- 22. SETTINGS PANEL -->
        <section class="panel" id="panel-settings">
          <div class="panel-header"><div><h1>Settings</h1><p>Indexer and dashboard configurations</p></div></div>
          <div class="ide-card" style="display:flex; flex-direction:column; gap:12px;">
            <div><strong>Appearance</strong><br><span style="color:var(--text-subtle);">Theme switching (Dark / Light / System)</span></div>
            <div class="flex-row">
              <button class="btn-ide" data-set-theme="dark">Dark</button>
              <button class="btn-ide" data-set-theme="light">Light</button>
              <button class="btn-ide" data-set-theme="system">System</button>
            </div>
            <hr style="border:none; border-top:1px solid var(--border);">
            <div><strong>Storage Directory</strong><br><span style="color:var(--text-subtle); font-family:var(--mono); font-size:11px;">~/.cache/codebase-indexer</span></div>
          </div>
        </section>
      </main>
    </div>
  </div>

  <!-- GLOBAL RIGHT DETAIL DRAWER -->
  <aside class="drawer" id="global-drawer">
    <div class="drawer-header">
      <strong id="drawer-title">Details</strong>
      <button class="drawer-close" id="drawer-close">✕</button>
    </div>
    <div id="drawer-body" style="font-family:var(--mono); font-size:11px; color:var(--text-muted); overflow-y:auto;">Select an item to view details.</div>
  </aside>

  <!-- COMMAND PALETTE MODAL -->
  <div class="cmd-palette-overlay" id="cmd-overlay">
    <div class="cmd-palette">
      <input type="search" class="cmd-input" id="cmd-input" placeholder="Type a command, file, or symbol…">
      <div class="cmd-results" id="cmd-results"></div>
    </div>
  </div>

  <script>
    var indexes = [];
    var activeUid = '';

    function el(id) { return document.getElementById(id); }

    function applyTheme(theme) {
      if (theme === 'system') {
        var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
      localStorage.setItem('codebase_theme', theme);
    }
    applyTheme(localStorage.getItem('codebase_theme') || 'system');

    // Navigation tab switching
    document.querySelectorAll('.nav-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var target = item.getAttribute('data-target');
        if (!target) return;
        document.querySelectorAll('.nav-item').forEach(function(i) { i.classList.remove('active'); });
        document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
        item.classList.add('active');
        var p = el(target);
        if (p) p.classList.add('active');
      });
    });

    // Drawer opening
    function openDrawer(title, contentHtml) {
      el('drawer-title').textContent = title;
      el('drawer-body').innerHTML = contentHtml;
      el('global-drawer').classList.add('open');
    }
    el('drawer-close').addEventListener('click', function() {
      el('global-drawer').classList.remove('open');
    });

    // Command palette
    function toggleCmdPalette(open) {
      var overlay = el('cmd-overlay');
      if (open) {
        overlay.classList.add('open');
        el('cmd-input').focus();
      } else {
        overlay.classList.remove('open');
      }
    }
    el('cmd-trigger').addEventListener('click', function() { toggleCmdPalette(true); });
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCmdPalette(true);
      }
      if (e.key === 'Escape') {
        toggleCmdPalette(false);
        el('global-drawer').classList.remove('open');
      }
    });
    el('cmd-overlay').addEventListener('click', function(e) {
      if (e.target === el('cmd-overlay')) toggleCmdPalette(false);
    });

    async function loadData() {
      try {
        var res = await fetch('/api/indexes');
        var payload = await res.json();
        indexes = payload.indexes || [];
        var selector = el('index-select');
        selector.replaceChildren();
        indexes.forEach(function(item) {
          var option = document.createElement('option');
          option.value = item.metadata.uid;
          option.textContent = item.fileName;
          option.title = item.metadata.workspaceRoot;
          selector.appendChild(option);
        });
        var savedUid = localStorage.getItem('codebase_index_uid');
        var initial = indexes.find(function(item) { return item.metadata.uid === savedUid; }) || indexes[0];
        if (initial) {
          selector.value = initial.metadata.uid;
          selectIndex(initial.metadata.uid);
        } else {
          var empty = document.createElement('option');
          empty.value = '';
          empty.textContent = 'No index files found';
          selector.appendChild(empty);
          activeUid = '';
          el('top-workspace-path').textContent = 'No local indexes found';
        }
      } catch (err) {
        console.warn('Load failed', err);
      }
    }

    function selectIndex(uid) {
      var item = indexes.find(function(index) { return index.metadata.uid === uid; });
      if (!item) return;
      activeUid = uid;
      localStorage.setItem('codebase_index_uid', uid);
      el('top-workspace-path').textContent = item.metadata.workspaceRoot;
      el('nav-dep-graph').href = '/graph/' + encodeURIComponent(uid);
      renderOverview(item);
      loadAllPanels(uid);
    }

    el('index-select').addEventListener('change', function(event) {
      selectIndex(event.target.value);
    });

    function renderOverview(item) {
      var m = item.metadata;
      el('overview-stats').innerHTML =
        '<div class="stat-card"><div class="stat-val">' + (m.fileCount || 0) + '</div><div class="stat-lbl">Files</div></div>' +
        '<div class="stat-card"><div class="stat-val">' + (m.symbolCount || 0) + '</div><div class="stat-lbl">Symbols</div></div>' +
        '<div class="stat-card"><div class="stat-val">' + (m.relationCount || 0) + '</div><div class="stat-lbl">Relations</div></div>' +
        '<div class="stat-card"><div class="stat-val">' + (m.chunkCount || 0) + '</div><div class="stat-lbl">Chunks</div></div>';

      el('overview-export-json').href = '/api/indexes/' + encodeURIComponent(m.uid) + '/export?format=json';
      el('overview-export-csv').href = '/api/indexes/' + encodeURIComponent(m.uid) + '/export?format=csv';
    }

    async function loadAllPanels(uid) {
      // Memory
      fetch('/api/system/memory').then(r => r.json()).then(data => {
        el('overview-memory').innerHTML =
          '<div class="stat-card"><div class="stat-val">' + data.rssMb + ' MB</div><div class="stat-lbl">Process RSS</div></div>' +
          '<div class="stat-card"><div class="stat-val">' + data.heapUsedMb + ' MB</div><div class="stat-lbl">Heap Used</div></div>';
      });

      // Files
      fetch('/api/indexes/' + uid + '/files').then(r => r.json()).then(data => {
        var tbody = el('files-table-body');
        tbody.innerHTML = '';
        (data.files || []).slice(0, 30).forEach(f => {
          var tr = document.createElement('tr');
          tr.innerHTML = '<td>' + f.path + '</td><td><span class="badge">' + f.language + '</span></td><td>' + f.size + ' B</td><td>' + f.terms.length + '</td><td><button class="btn-ide" onclick="openDrawer(\'' + f.path + '\', \'Language: ' + f.language + '<br>Size: ' + f.size + ' bytes<br>Terms count: ' + f.terms.length + '\')">Inspect</button></td>';
          tbody.appendChild(tr);
        });
      });

      // Symbols
      fetch('/api/indexes/' + uid + '/symbols').then(r => r.json()).then(data => {
        var tbody = el('symbols-table-body');
        tbody.innerHTML = '';
        (data.symbols || []).slice(0, 30).forEach(s => {
          var tr = document.createElement('tr');
          tr.innerHTML = '<td><strong>' + s.name + '</strong></td><td><span class="badge">' + s.kind + '</span></td><td>' + s.filePath + '</td><td>' + s.startLine + '</td><td>' + (s.parentId || '—') + '</td>';
          tr.onclick = function() { openDrawer(s.name, 'Kind: ' + s.kind + '<br>File: ' + s.filePath + '<br>Line: ' + s.startLine); };
          tbody.appendChild(tr);
        });
      });

      // Intelligence & Areas
      fetch('/api/indexes/' + uid + '/intelligence').then(r => r.json()).then(data => {
        var areas = data.repositoryMap ? data.repositoryMap.areas || [] : [];
        el('overview-areas').innerHTML = areas.slice(0, 8).map(a => '<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border); font-family:var(--mono);"><span>' + a.path + '</span><span>' + a.files + ' files</span></div>').join('');
      });

      // APIs
      fetch('/api/indexes/' + uid + '/intelligence').then(r => r.json()).then(data => {
        var apis = data.apiEndpoints || [];
        var tbody = el('apis-table-body');
        tbody.innerHTML = apis.length ? apis.map(a => '<tr><td><span class="badge">' + a.method + '</span></td><td>' + a.path + '</td><td>' + a.fileId + '</td><td>' + a.startLine + '</td></tr>').join('') : '<tr><td colspan="4">No API endpoints detected</td></tr>';
      });

      // Database
      fetch('/api/indexes/' + uid + '/database').then(r => r.json()).then(data => {
        var models = data.models || [];
        el('database-table-body').innerHTML = models.length ? models.map(m => '<tr><td>' + m.name + '</td><td><span class="badge">' + m.kind + '</span></td><td>' + m.filePath + '</td></tr>').join('') : '<tr><td colspan="3">No database schemas detected</td></tr>';
      });

      // Tests
      fetch('/api/indexes/' + uid + '/tests').then(r => r.json()).then(data => {
        var tests = data.tests || [];
        el('tests-table-body').innerHTML = tests.length ? tests.map(t => '<tr><td>' + t.testFile + '</td><td><span class="badge">' + t.framework + '</span></td><td>' + t.testSymbol + '</td><td>' + (t.targetSymbol || '—') + '</td></tr>').join('') : '<tr><td colspan="4">No tests detected</td></tr>';
      });

      // Git
      fetch('/api/indexes/' + uid + '/git').then(r => r.json()).then(data => {
        el('top-branch').textContent = data.branch || 'main';
        var commits = data.commits || [];
        el('git-table-body').innerHTML = commits.length ? commits.map(c => '<tr><td>' + c.hash + '</td><td>' + c.author + '</td><td>' + c.date + '</td><td>' + c.subject + '</td></tr>').join('') : '<tr><td colspan="4">No git commits available</td></tr>';
        var changed = data.changedFiles || [];
        el('changes-table-body').innerHTML = changed.length ? changed.map(c => '<tr><td><span class="badge">' + c.code + '</span></td><td>' + c.filePath + '</td></tr>').join('') : '<tr><td colspan="2">Working tree clean</td></tr>';
      });

      // Complexity
      fetch('/api/indexes/' + uid + '/complexity').then(r => r.json()).then(data => {
        var files = data.mostComplexFiles || [];
        el('complexity-table-body').innerHTML = files.map(f => '<tr><td>' + f.path + '</td><td>' + f.language + '</td><td>' + f.loc + '</td><td>' + f.cyclomaticEstimate + '</td><td>' + f.fanIn + '</td><td>' + f.fanOut + '</td></tr>').join('');
      });

      // Security
      fetch('/api/indexes/' + uid + '/security').then(r => r.json()).then(data => {
        var findings = data.findings || [];
        el('security-table-body').innerHTML = findings.length ? findings.map(f => '<tr><td><span class="badge">' + f.kind + '</span></td><td>' + f.filePath + ':' + f.line + '</td><td>' + f.confidence + '</td><td>[REDACTED]</td></tr>').join('') : '<tr><td colspan="4">No security findings detected</td></tr>';
      });

      // Health
      fetch('/api/indexes/' + uid + '/health').then(r => r.json()).then(data => {
        el('health-report').innerHTML = '<div>Status: <strong>' + data.status + '</strong></div><div>Files Checked: ' + data.totalFiles + '</div><div>Broken References: ' + data.brokenReferencesCount + '</div>';
      });

      // Inspector
      fetch('/api/indexes/' + uid + '/inspect').then(r => r.json()).then(data => {
        el('inspector-stats').innerHTML =
          '<div class="stat-card"><div class="stat-val">' + data.magic + '</div><div class="stat-lbl">Magic Header</div></div>' +
          '<div class="stat-card"><div class="stat-val">v' + data.version + '</div><div class="stat-lbl">Version</div></div>' +
          '<div class="stat-card"><div class="stat-val">' + data.fileSize + ' B</div><div class="stat-lbl">Index File Size</div></div>';
      });
    }

    // Theme toggling in settings
    document.querySelectorAll('[data-set-theme]').forEach(b => {
      b.addEventListener('click', () => applyTheme(b.getAttribute('data-set-theme')));
    });

    el('btn-theme-toggle').addEventListener('click', () => {
      var current = document.documentElement.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });

    loadData();
  </script>
</body>
</html>`;
