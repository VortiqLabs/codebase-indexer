export const DASHBOARD_PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Codebase Index Dashboard</title>
  <style>
    :root, [data-theme="light"] {
      color-scheme: light;
      --bg: #f2f5f1;
      --surface: #fbfcfa;
      --surface-strong: #ffffff;
      --surface-muted: #eef3ee;
      --line: #dfe7dd;
      --primary: #1b665a;
      --primary-strong: #0d4d42;
      --secondary: #4f7aa4;
      --accent: #d3ef78;
      --neutral: #5a655e;
      --ink: #1f2824;
      --shadow: 0 12px 28px rgba(20, 30, 24, 0.08);
      --input-bg: #ffffff;
      --card-bg: rgba(255,255,255,0.86);
      --rail-bg: rgba(255,255,255,0.74);
      --mono: "SFMono-Regular", "Consolas", monospace;
      --sans: "Segoe UI", "Inter", sans-serif;
    }
    [data-theme="dark"] {
      color-scheme: dark;
      --bg: #111917;
      --surface: #18231f;
      --surface-strong: #1f2d28;
      --surface-muted: #15201c;
      --line: #2e3e37;
      --primary: #61d6ad;
      --primary-strong: #3ebf92;
      --secondary: #70b7e3;
      --accent: #d4f46c;
      --neutral: #9aa99f;
      --ink: #e7eee8;
      --shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
      --input-bg: #1c2923;
      --card-bg: rgba(25, 35, 31, 0.88);
      --rail-bg: rgba(22, 31, 27, 0.82);
    }
    * { box-sizing: border-box; }
    html, body { min-height: 100%; margin: 0; background: var(--bg); color: var(--ink); font-family: var(--sans); transition: background 0.25s ease, color 0.25s ease; }
    body { padding: 18px; }
    button, input, select { font: inherit; }
    a { color: inherit; }
    .app-shell { max-width: 1500px; margin: 0 auto; display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 22px; }
    .rail {
      background: var(--rail-bg); backdrop-filter: blur(12px); border: 1px solid var(--line); border-radius: 26px;
      box-shadow: var(--shadow); padding: 18px 14px; min-height: calc(100vh - 36px);
    }
    .brand-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 16px; }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 700; }
    .mark {
      width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: linear-gradient(135deg, var(--primary), var(--primary-strong));
      color: #111917; font-family: var(--mono); font-weight: 700;
    }
    .pill {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 999px; background: var(--surface-muted); border: 1px solid var(--line);
      padding: 5px 10px; color: var(--neutral); font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
    }
    .theme-switcher { display: flex; gap: 4px; background: var(--surface-muted); border: 1px solid var(--line); border-radius: 12px; padding: 3px; margin-bottom: 14px; }
    .theme-btn { flex: 1; border: none; background: transparent; color: var(--neutral); border-radius: 8px; padding: 5px 0; font-size: 11px; cursor: pointer; text-align: center; font-family: var(--mono); }
    .theme-btn.active { background: var(--surface-strong); color: var(--primary); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .sidebar-filter { display: block; margin: 10px 0 16px; }
    .sidebar-filter input {
      width: 100%; border: 1px solid var(--line); border-radius: 12px; background: var(--input-bg); height: 38px; padding: 0 12px; outline: none; color: var(--ink);
    }
    .sidebar-filter input:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(97,214,173,0.2); }
    .index-list { display: grid; gap: 6px; }
    .index-item {
      display: block; width: 100%; text-align: left; border: 1px solid transparent; border-radius: 14px; background: transparent; color: var(--ink);
      padding: 10px 12px; cursor: pointer; transition: background 0.18s ease, border-color 0.18s ease;
    }
    .index-item:hover { background: rgba(97,214,173,0.08); border-color: var(--line); }
    .index-item.active { background: rgba(97,214,173,0.15); border-color: var(--primary); }
    .index-group { background: rgba(112,183,227,0.06); }
    .index-part { margin-left: 14px; }
    .group-caret { display: inline-block; width: 12px; }
    .index-name { display: block; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .index-path { display: block; margin-top: 4px; color: var(--neutral); font-family: var(--mono); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nav-header { margin-top: 18px; padding: 0 8px; font-size: 10px; color: var(--neutral); letter-spacing: 0.12em; text-transform: uppercase; font-family: var(--mono); }
    .nav-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .nav-chip {
      display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; border-radius: 999px; background: var(--surface-muted);
      border: 1px solid var(--line); font-size: 11px; font-weight: 600; color: var(--ink);
    }
    .main-panel { min-width: 0; }
    .topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
    .topbar h1 { margin: 0; font-size: clamp(1.8rem, 2.5vw, 2.6rem); }
    .workspace-path { margin-top: 8px; color: var(--neutral); font-family: var(--mono); font-size: 11px; }
    .updated { color: var(--neutral); font-family: var(--mono); font-size: 11px; padding-top: 10px; }
    .searchbar {
      display: flex; align-items: center; gap: 12px; background: var(--card-bg); border: 1px solid var(--line); border-radius: 18px;
      box-shadow: var(--shadow); padding: 12px 16px; min-height: 62px; margin-bottom: 18px;
    }
    .search-icon { font-size: 20px; color: var(--primary); }
    .searchbar input {
      flex: 1; border: none; background: transparent; color: var(--ink); font-size: 15px; outline: none;
    }
    .search-select { border: 1px solid var(--line); background: var(--input-bg); color: var(--ink); border-radius: 10px; padding: 4px 8px; font-size: 12px; }
    .search-hint { color: var(--neutral); font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
    .metrics { display: grid; grid-template-columns: repeat(5, minmax(140px, 1fr)); gap: 12px; margin-bottom: 18px; }
    .metric-card {
      background: var(--card-bg); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); padding: 16px 18px;
    }
    .metric-value { font-family: var(--mono); font-size: clamp(1.3rem, 2vw, 2rem); font-weight: 700; color: var(--primary); }
    .metric-label { margin-top: 6px; font-family: var(--mono); color: var(--neutral); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
    .card {
      background: var(--card-bg); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); padding: 16px 18px;
    }
    .section-head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; border-bottom: 1px solid var(--line); padding-bottom: 8px;
    }
    .section-head h2 { margin: 0; font-size: 14px; }
    .section-head span { color: var(--neutral); font-size: 10px; font-family: var(--mono); letter-spacing: 0.12em; text-transform: uppercase; }
    .dashboard-grid { display: grid; grid-template-columns: minmax(260px, 0.9fr) minmax(420px, 1.5fr); gap: 18px; }
    .bar-list { display: grid; gap: 10px; }
    .bar-row { display: grid; grid-template-columns: 80px minmax(40px, 1fr) 48px; gap: 8px; font-family: var(--mono); font-size: 10px; align-items: center; }
    .bar-label { color: var(--neutral); }
    .bar-track { height: 10px; border-radius: 999px; background: var(--surface-muted); overflow: hidden; }
    .bar-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--primary), var(--secondary)); }
    .bar-value { text-align: right; }
    .graph-wrap { position: relative; min-height: 290px; border: 1px solid var(--line); border-radius: 18px; background: var(--surface-muted); overflow: hidden; }
    .graph-wrap svg { display: block; width: 100%; height: 290px; }
    .graph-empty { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; padding: 24px; color: var(--neutral); font-family: var(--mono); font-size: 11px; }
    .graph-edge { stroke: var(--primary); stroke-width: 1.2; stroke-opacity: 0.6; }
    .graph-node { fill: var(--accent); stroke: var(--primary); stroke-width: 1.2; }
    .graph-label { font: 9px var(--mono); fill: var(--ink); }
    .graph-note { margin-top: 8px; font-family: var(--mono); font-size: 11px; color: var(--neutral); }
    .graph-link { color: var(--primary); font-family: var(--mono); font-size: 11px; text-decoration: none; border-bottom: 1px solid var(--line); }
    .relation-breakdown { margin-top: 18px; }
    .relation-bars { display: grid; gap: 8px; }
    .relation-row { display: grid; grid-template-columns: 100px minmax(60px, 1fr) 42px; gap: 8px; align-items: center; font-family: var(--mono); font-size: 10px; }
    .relation-name { color: var(--neutral); }
    .relation-track { height: 8px; background: var(--surface-muted); border-radius: 999px; overflow: hidden; }
    .relation-fill { height: 100%; border-radius: inherit; }
    .intel-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 18px; }
    .intel-list { display: grid; gap: 6px; }
    .intel-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; font-family: var(--mono); font-size: 11px; border-bottom: 1px solid var(--line); padding: 8px 0; }
    .intel-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .intel-kind, .endpoint-method { display: inline-flex; align-items: center; justify-content: center; min-width: 52px; padding: 3px 6px; border-radius: 999px; font-weight: 700; }
    .intel-kind { background: rgba(97,214,173,0.15); color: var(--primary); }
    .endpoint-method { background: rgba(112,183,227,0.15); color: var(--secondary); }
    .intel-meta { color: var(--neutral); }
    .status, .empty { color: var(--neutral); font-family: var(--mono); font-size: 12px; }
    .result-row { display: grid; grid-template-columns: minmax(180px, 1.3fr) minmax(260px, 2fr) 54px 88px; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); align-items: start; }
    .result-location { font-family: var(--mono); font-size: 11px; overflow-wrap: anywhere; }
    .result-location small { display: block; margin-top: 4px; color: var(--neutral); }
    .result-excerpt { font-family: var(--mono); font-size: 11px; line-height: 1.55; overflow-wrap: anywhere; color: var(--ink); opacity: 0.9; }
    .result-score { text-align: right; font-family: var(--mono); font-weight: 600; color: var(--primary); }
    .result-graph { color: var(--primary); font-family: var(--mono); font-size: 11px; text-align: right; text-decoration: none; }
    .table-wrap { overflow: auto; max-height: 380px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 8px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--neutral); font-family: var(--mono); position: sticky; top: 0; background: var(--surface); }
    td { font-size: 12px; font-family: var(--mono); }
    .table-empty { color: var(--neutral); }
    .metric-boxes { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
    .metric-box { background: var(--surface-muted); border: 1px solid var(--line); border-radius: 12px; padding: 10px; }
    .metric-box span { display: block; color: var(--neutral); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; font-family: var(--mono); }
    .metric-box strong { display: block; margin-top: 6px; font-family: var(--mono); font-size: 14px; color: var(--primary); }
    .results { margin-top: 18px; }
    .export-btns { display: flex; gap: 8px; }
    .btn-action { background: var(--surface-muted); border: 1px solid var(--line); color: var(--ink); border-radius: 10px; padding: 6px 12px; font-family: var(--mono); font-size: 11px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
    .btn-action:hover { border-color: var(--primary); color: var(--primary); }
    .spinner { display: inline-block; width: 10px; height: 10px; border: 1px solid var(--primary); border-right-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 1100px) { .app-shell { grid-template-columns: 1fr; } .rail { min-height: auto; } .metrics { grid-template-columns: repeat(2, minmax(120px, 1fr)); } .dashboard-grid, .intel-grid { grid-template-columns: 1fr; } }
    @media (max-width: 640px) {
      body { padding: 12px; }
      .metrics { grid-template-columns: 1fr; }
      .result-row { grid-template-columns: minmax(0, 1fr) 52px; }
      .result-excerpt { grid-column: 1 / -1; }
      .result-score, .result-graph { text-align: left; }
      .searchbar { padding: 10px 12px; flex-wrap: wrap; }
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <aside class="rail">
      <div class="brand-row">
        <div class="brand"><span class="mark">CI</span><span>Codebase Index</span></div>
        <span class="pill" id="health">Local</span>
      </div>

      <div class="theme-switcher">
        <button type="button" class="theme-btn" data-theme-set="light">☀️ Light</button>
        <button type="button" class="theme-btn" data-theme-set="dark">🌙 Dark</button>
        <button type="button" class="theme-btn" data-theme-set="system">💻 System</button>
      </div>

      <div class="nav-header">Index collection</div>
      <label class="sidebar-filter"><input id="index-filter" type="search" placeholder="Filter workspaces" autocomplete="off"></label>
      <nav class="index-list" id="index-list"></nav>
      <button id="refresh" type="button" class="pill" style="width:100%; margin-top:14px; cursor:pointer;">Refresh</button>
      <div id="load-errors"></div>
      <div class="nav-header">Capabilities</div>
      <div class="nav-list">
        <span class="nav-chip">Overview</span>
        <span class="nav-chip">Files</span>
        <span class="nav-chip">Symbols</span>
        <span class="nav-chip">Graph</span>
        <span class="nav-chip">Search</span>
        <span class="nav-chip">APIs</span>
        <span class="nav-chip">Security</span>
        <span class="nav-chip">Memory</span>
      </div>
    </aside>

    <main class="main-panel">
      <div class="topbar">
        <div>
          <div class="pill" style="margin-bottom:10px;">Workspace index</div>
          <h1 id="title">All workspaces</h1>
          <div id="workspace-path" class="workspace-path">Search across every discovered index</div>
        </div>
        <div style="text-align:right;">
          <div id="updated" class="updated">Index status</div>
          <div id="export-controls" class="export-btns" style="margin-top:8px; justify-content:flex-end;">
            <a id="export-json" class="btn-action" href="#" download>Export JSON</a>
            <a id="export-csv" class="btn-action" href="#" download>Export CSV</a>
          </div>
        </div>
      </div>

      <section class="card" aria-labelledby="github-heading" style="margin-bottom:18px; padding:18px 20px;">
        <div class="section-head" style="margin-bottom:10px;"><h2 id="github-heading">Index a GitHub repository</h2><span>local import</span></div>
        <form id="github-form" style="display:grid; grid-template-columns: minmax(200px, 1fr) minmax(120px, 180px) minmax(120px, 180px) auto; gap: 10px;">
          <input id="github-url" type="url" placeholder="https://github.com/owner/repository" autocomplete="url" required style="height:40px; border:1px solid var(--line); border-radius:12px; background:var(--input-bg); color:var(--ink); padding:0 12px; outline:none;">
          <input id="github-ref" type="text" placeholder="Default branch" aria-label="Branch or tag" style="height:40px; border:1px solid var(--line); border-radius:12px; background:var(--input-bg); color:var(--ink); padding:0 12px; outline:none;">
          <input id="github-size" type="number" min="0.001" max="100" step="0.001" value="1" aria-label="Maximum file size in megabytes" title="Maximum file size in megabytes" style="height:40px; border:1px solid var(--line); border-radius:12px; background:var(--input-bg); color:var(--ink); padding:0 12px; outline:none;">
          <button id="github-submit" type="submit" style="height:40px; border:none; border-radius:12px; background:linear-gradient(135deg, var(--primary), var(--primary-strong)); color:#111917; font-weight:700; cursor:pointer; padding:0 16px;">Index repository</button>
        </form>
        <div style="display:grid; grid-template-columns:minmax(0,1fr) minmax(250px,1.5fr); gap:10px; margin-top:10px;">
          <input id="github-patterns" type="text" placeholder="Ignore patterns, comma-separated (optional)" aria-label="Ignore patterns" style="height:40px; border:1px solid var(--line); border-radius:12px; background:var(--input-bg); color:var(--ink); padding:0 12px; outline:none;">
          <div style="display:flex; align-items:center; justify-content:center; color:var(--neutral); font-family:var(--mono); font-size:11px; text-align:center;">Private repos use GITHUB_TOKEN or GH_TOKEN from environment</div>
        </div>
        <div id="github-job" hidden class="card" style="margin-top:12px; padding:12px 14px; background: var(--surface-strong);">
          <div class="section-head" style="margin-bottom:10px;"><span id="github-job-state">Preparing import…</span><a id="github-result" href="#" target="_blank" rel="noopener" hidden style="color:var(--primary); font-family:var(--mono); font-size:11px; text-decoration:none;">Open indexed graph</a></div>
          <progress id="github-progress" max="100" hidden style="width:100%; height:6px;"></progress>
          <div id="github-log" role="log" aria-live="polite" style="height:150px; overflow:auto; margin-top:10px; background:#19231f; color:#e7efe8; border-radius:12px; padding:10px; font-family:var(--mono); font-size:10px; line-height:1.7;"></div>
        </div>
      </section>

      <label class="searchbar">
        <span class="search-icon">⌕</span>
        <input id="query" type="search" placeholder="Search files, symbols, and indexed terms" autocomplete="off">
        <select id="search-lang" class="search-select"><option value="">All Languages</option></select>
        <span class="search-hint">Live Search</span>
      </label>

      <div id="metrics" class="metrics"></div>

      <div class="dashboard-grid">
        <section class="card">
          <div class="section-head"><h2>Index composition</h2><span id="composition-label">All indexes</span></div>
          <div id="bars" class="bar-list"></div>
        </section>
        <section class="card">
          <div class="section-head">
            <h2>Resolved symbol relations</h2>
            <a id="graph-open" class="graph-link" href="#" target="_blank" rel="noopener" hidden>Open full graph ↗</a>
            <span id="relation-count">0 edges</span>
          </div>
          <div class="graph-wrap">
            <svg id="graph" viewBox="0 0 620 280" role="img" aria-label="Symbol relation graph"></svg>
            <div id="graph-empty" class="graph-empty">Select a workspace to inspect its resolved symbol relations.</div>
          </div>
          <div id="graph-note" class="graph-note">Relation resolution is heuristic; unresolved relations are not drawn.</div>
        </section>
      </div>

      <section class="card relation-breakdown">
        <div class="section-head"><h2>Relation makeup</h2><span id="relation-scope">All indexes</span></div>
        <div id="relation-bars" class="relation-bars"></div>
      </section>

      <section class="intel-grid">
        <section class="card">
          <div class="section-head"><h2>Repository architecture</h2><span id="area-count">0 areas</span></div>
          <div id="repository-areas" class="intel-list"><div class="empty">Select one workspace to inspect architecture.</div></div>
        </section>
        <section class="card">
          <div class="section-head"><h2>API surface</h2><span id="endpoint-count">0 endpoints</span></div>
          <div id="api-endpoints" class="intel-list"><div class="empty">Select one workspace to inspect detected endpoints.</div></div>
        </section>
      </section>

      <section class="card results">
        <div class="section-head"><h2>Search results</h2><span id="result-count">Type to search indexed files</span></div>
        <div id="results"><div class="status">Search is performed locally against the saved index data.</div></div>
      </section>

      <section class="card results">
        <div class="section-head"><h2>System & Memory Stats</h2><span>realtime process metrics</span></div>
        <div id="memory-stats" class="metric-boxes"></div>
      </section>

      <section class="card results">
        <div class="section-head"><h2>Repository files</h2><span>local file inventory</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Path</th><th>Language</th><th>Size</th><th>Terms</th><th>Modified</th></tr></thead>
            <tbody id="file-table-body"></tbody>
          </table>
        </div>
      </section>

      <section class="card results">
        <div class="section-head"><h2>Symbols</h2><span>local symbol index</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Kind</th><th>File</th><th>Line</th><th>Parent</th></tr></thead>
            <tbody id="symbol-table-body"></tbody>
          </table>
        </div>
      </section>

      <section class="card results">
        <div class="section-head"><h2>Security findings</h2><span>redacted</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Kind</th><th>Location</th><th>Confidence</th><th>Value</th></tr></thead>
            <tbody id="security-table-body"></tbody>
          </table>
        </div>
      </section>

      <section class="card results">
        <div class="section-head"><h2>Index inspector</h2><span>binary metadata</span></div>
        <div id="inspector-stats" class="metric-boxes"></div>
      </section>
    </main>
  </div>

  <script>
    var indexes = [];
    var selectedUid = '';
    var selectedGroup = '';
    var expandedGroups = new Set();
    var searchTimer;
    var searchController;
    var intelligenceRequest = 0;
    var githubEvents;
    var svgNamespace = 'http://www.w3.org/2000/svg';
    var countKeys = [['fileCount', 'Files'], ['symbolCount', 'Symbols'], ['relationCount', 'Relations'], ['chunkCount', 'Chunks'], ['vectorCount', 'Vectors']];
    var relationColors = { calls: '#61d6ad', imports: '#70b7e3', references: '#f4c95d', contains: '#9aa99f', extends: '#ff8868', implements: '#bd98f2', exports: '#ee8dbe' };
    var numberFormat = new Intl.NumberFormat();

    function applyTheme(theme) {
      if (theme === 'system') {
        var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
      localStorage.setItem('codebase_theme', theme);
      document.querySelectorAll('.theme-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.getAttribute('data-theme-set') === theme);
      });
    }

    var savedTheme = localStorage.getItem('codebase_theme') || 'system';
    applyTheme(savedTheme);
    document.querySelectorAll('.theme-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { applyTheme(btn.getAttribute('data-theme-set')); });
    });

    function element(id) { return document.getElementById(id); }
    function makeSvg(name, attributes) {
      var node = document.createElementNS(svgNamespace, name);
      Object.keys(attributes || {}).forEach(function(key) {
        node.setAttribute(key, String(attributes[key]));
      });
      return node;
    }
    function activeIndex() { return indexes.find(function(item) { return item.metadata.uid === selectedUid; }); }
    function groupKey(item) {
      if (item.metadata.indexGroup) return item.metadata.indexGroup;
      var label = item.metadata.indexLabel || '';
      var groupedLabel = label.replace(/\s+·\s+part\s+\d+\s+of\s+\d+$/iu, '');
      return groupedLabel !== label ? groupedLabel : 'index:' + item.metadata.uid;
    }
    function expectedPartCount(item) {
      if (item.metadata.indexPartCount) return item.metadata.indexPartCount;
      var match = /\s+·\s+part\s+\d+\s+of\s+(\d+)$/iu.exec(item.metadata.indexLabel || '');
      return match ? Number(match[1]) : 1;
    }
    function indexGroups() {
      var groups = new Map();
      indexes.forEach(function(item) {
        var key = groupKey(item);
        if (!groups.has(key)) {
          groups.set(key, { key: key, label: item.metadata.indexGroup || (item.metadata.indexLabel ? item.metadata.indexLabel.replace(/\s+·\s+part\s+\d+\s+of\s+\d+$/iu, '') : '') || item.metadata.workspaceRoot, items: [], expectedParts: 1 });
        }
        var group = groups.get(key);
        group.items.push(item);
        group.expectedParts = Math.max(group.expectedParts, expectedPartCount(item));
      });
      return Array.from(groups.values()).map(function(group) {
        group.items.sort(function(left, right) { return (left.metadata.indexPart || 0) - (right.metadata.indexPart || 0); });
        group.fileCount = group.items.reduce(function(total, item) { return total + item.metadata.fileCount; }, 0);
        group.symbolCount = group.items.reduce(function(total, item) { return total + item.metadata.symbolCount; }, 0);
        group.relationCount = group.items.reduce(function(total, item) { return total + item.metadata.relationCount; }, 0);
        return group;
      }).sort(function(left, right) { return left.label.localeCompare(right.label); });
    }
    function scopedIndexes() {
      if (selectedUid) {
        var selected = activeIndex();
        return selected ? [selected] : [];
      }
      if (selectedGroup) return indexes.filter(function(item) { return groupKey(item) === selectedGroup; });
      return indexes;
    }
    function totals(items) {
      return countKeys.map(function(entry) {
        return { key: entry[0], label: entry[1], value: items.reduce(function(sum, item) { return sum + (item.metadata[entry[0]] || 0); }, 0) };
      });
    }

    function appendGitHubLog(entry) {
      var container = element('github-log');
      var row = document.createElement('div');
      row.textContent = new Date(entry.time).toLocaleTimeString() + '  ' + entry.stage.toUpperCase() + '  ' + entry.message;
      container.appendChild(row);
      container.scrollTop = container.scrollHeight;
      var progress = element('github-progress');
      if (entry.total && entry.current !== undefined) {
        progress.hidden = false;
        progress.value = Math.min(100, (entry.current / entry.total) * 100);
      } else if (entry.stage === 'scan' || entry.stage === 'parse' || entry.stage === 'extract') {
        progress.hidden = false;
        progress.removeAttribute('value');
      }
      element('github-job-state').textContent = entry.message;
    }

    function connectGitHubJob(job) {
      if (githubEvents) githubEvents.close();
      githubEvents = new EventSource(job.eventsUrl);
      githubEvents.addEventListener('log', function(event) { appendGitHubLog(JSON.parse(event.data)); });
      githubEvents.addEventListener('completed', function(event) {
        var result = JSON.parse(event.data);
        element('github-job-state').textContent = 'Index complete';
        element('github-progress').hidden = false;
        element('github-progress').value = 100;
        var link = element('github-result');
        link.href = '/graph/' + encodeURIComponent(result.uid);
        link.hidden = false;
        githubEvents.close();
        void refreshIndexes();
      });
      githubEvents.addEventListener('failed', function(event) {
        var failure = JSON.parse(event.data);
        element('github-job-state').textContent = 'Index failed: ' + failure.message;
        githubEvents.close();
      });
      githubEvents.onerror = function() {
        if (githubEvents.readyState === EventSource.CLOSED && element('github-job-state').textContent.indexOf('Index ') !== 0) {
          element('github-job-state').textContent = 'Connection to progress stream lost';
        }
      };
    }

    async function startGitHubIndex(event) {
      event.preventDefault();
      if (githubEvents) githubEvents.close();
      element('github-log').replaceChildren();
      element('github-job').hidden = false;
      element('github-result').hidden = true;
      element('github-progress').hidden = true;
      element('github-job-state').textContent = 'Starting import…';
      element('github-submit').disabled = true;
      var patterns = element('github-patterns').value.split(',').map(function(pattern) { return pattern.trim(); }).filter(Boolean);
      try {
        var response = await fetch('/api/github/index', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: element('github-url').value, ref: element('github-ref').value.trim(), patterns: patterns, maxFileSize: Math.round(Number(element('github-size').value) * 1024 * 1024) }) });
        var job = await response.json();
        if (!response.ok) throw new Error(job.error || 'Could not start GitHub indexing');
        connectGitHubJob(job);
      } catch (error) {
        element('github-job-state').textContent = 'Could not start: ' + error.message;
        element('github-log').textContent = new Date().toLocaleTimeString() + '  ' + error.message;
      } finally {
        element('github-submit').disabled = false;
      }
    }

    async function refreshIndexes() {
      element('health').textContent = 'READING';
      try {
        var response = await fetch('/api/indexes');
        var payload = await response.json();
        indexes = payload.indexes || [];
        if (selectedUid && !indexes.some(function(item) { return item.metadata.uid === selectedUid; })) selectedUid = '';
        if (selectedGroup && !indexes.some(function(item) { return groupKey(item) === selectedGroup; })) selectedGroup = '';
        renderIndexList();
        renderOverview();
        renderSelectedGraph();
        renderSearch();
        void loadSystemMemory();
        element('health').textContent = 'READY';
        element('load-errors').replaceChildren();
        (payload.errors || []).forEach(function(issue) {
          var line = document.createElement('div');
          line.className = 'empty';
          line.textContent = issue.fileName + ': ' + issue.message;
          element('load-errors').appendChild(line);
        });
      } catch (error) {
        element('health').textContent = 'FAILED';
        element('load-errors').textContent = String(error);
      }
    }

    async function loadSystemMemory() {
      try {
        var response = await fetch('/api/system/memory');
        var data = await response.json();
        var container = element('memory-stats');
        if (container && data) {
          container.innerHTML = '';
          var entries = [
            ['Process RSS', data.rssMb + ' MB'],
            ['Heap Used', data.heapUsedMb + ' / ' + data.heapTotalMb + ' MB'],
            ['External', data.externalMb + ' MB'],
            ['Cached Indexes', String(data.cacheSize)]
          ];
          entries.forEach(function(entry) {
            var box = document.createElement('div');
            box.className = 'metric-box';
            box.innerHTML = '<span>' + entry[0] + '</span><strong>' + entry[1] + '</strong>';
            container.appendChild(box);
          });
        }
      } catch (error) {
        console.warn('Memory stats unavailable', error);
      }
    }

    function renderIndexList() {
      var list = element('index-list');
      list.replaceChildren();
      var groups = indexGroups();
      var allButton = document.createElement('button');
      allButton.className = 'index-item' + (!selectedUid && !selectedGroup ? ' active' : '');
      allButton.innerHTML = '<span class="index-name">All workspaces</span><span class="index-path">' + groups.length + ' repositories · ' + indexes.length + ' index parts</span>';
      allButton.onclick = function() { selectedUid = ''; selectedGroup = ''; renderIndexList(); renderOverview(); renderSelectedGraph(); renderSearch(); };
      list.appendChild(allButton);

      var query = element('index-filter').value.trim().toLowerCase();
      var visibleGroups = groups.filter(function(group) {
        return !query || group.label.toLowerCase().includes(query) || group.items.some(function(item) { return item.metadata.workspaceRoot.toLowerCase().includes(query); });
      });

      visibleGroups.forEach(function(group) {
        var grouped = group.items.length > 1;
        var button = document.createElement('button');
        button.className = 'index-item' + (grouped ? ' index-group' : '') + (selectedGroup === group.key ? ' active' : '');
        if (grouped) {
          var caret = document.createElement('span');
          caret.className = 'group-caret';
          caret.textContent = expandedGroups.has(group.key) ? '▾' : '▸';
          button.appendChild(caret);
        }
        var text = document.createElement('span');
        text.style.minWidth = '0';
        var name = document.createElement('span');
        name.className = 'index-name';
        name.textContent = group.label;
        var sub = document.createElement('span');
        sub.className = 'index-path';
        var partSummary = grouped ? (group.items.length < group.expectedParts ? group.items.length + ' / ' + group.expectedParts + ' parts indexed' : group.items.length + ' parts') : numberFormat.format(group.relationCount) + ' relations';
        sub.textContent = numberFormat.format(group.fileCount) + ' files · ' + numberFormat.format(group.symbolCount) + ' symbols · ' + partSummary;
        text.appendChild(name); text.appendChild(sub); button.appendChild(text);
        button.onclick = function() {
          if (grouped) {
            if (expandedGroups.has(group.key)) expandedGroups.delete(group.key);
            else expandedGroups.add(group.key);
            selectedUid = '';
            selectedGroup = group.key;
          } else {
            selectedUid = group.items[0].metadata.uid;
            selectedGroup = '';
          }
          renderIndexList(); renderOverview(); renderSelectedGraph(); renderSearch();
        };
        list.appendChild(button);

        if (grouped && expandedGroups.has(group.key)) {
          group.items.forEach(function(item) {
            var part = document.createElement('button');
            part.className = 'index-item index-part' + (selectedUid === item.metadata.uid ? ' active' : '');
            var partName = document.createElement('span');
            partName.className = 'index-name';
            partName.textContent = 'Part ' + (item.metadata.indexPart || group.items.indexOf(item) + 1) + ' of ' + (item.metadata.indexPartCount || group.items.length);
            var partPath = document.createElement('span');
            partPath.className = 'index-path';
            partPath.textContent = numberFormat.format(item.metadata.fileCount) + ' files · ' + numberFormat.format(item.metadata.symbolCount) + ' symbols';
            part.appendChild(partName); part.appendChild(partPath);
            part.onclick = function() { selectedUid = item.metadata.uid; selectedGroup = ''; renderIndexList(); renderOverview(); renderSelectedGraph(); renderSearch(); };
            list.appendChild(part);
          });
        }
      });
      if (query && visibleGroups.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'No matching workspaces';
        list.appendChild(empty);
      }
    }

    function renderOverview() {
      var selected = activeIndex();
      var scope = scopedIndexes();
      var selectedRepo = selectedGroup ? indexGroups().find(function(group) { return group.key === selectedGroup; }) : undefined;
      var values = totals(scope);
      var metrics = element('metrics');
      metrics.replaceChildren();
      values.forEach(function(item) {
        var box = document.createElement('div');
        box.className = 'metric-card';
        var value = document.createElement('div');
        value.className = 'metric-value';
        value.textContent = numberFormat.format(item.value);
        var label = document.createElement('div');
        label.className = 'metric-label';
        label.textContent = item.label;
        box.appendChild(value); box.appendChild(label); metrics.appendChild(box);
      });
      element('title').textContent = selected ? (selected.metadata.indexLabel || selected.metadata.workspaceRoot.split('/').filter(Boolean).pop() || selected.metadata.workspaceRoot) : selectedRepo ? selectedRepo.label : 'All workspaces';
      element('workspace-path').textContent = selected ? selected.metadata.workspaceRoot : selectedRepo ? numberFormat.format(selectedRepo.items.length) + ' index parts · aggregate totals' : 'Search across every discovered index';
      element('updated').textContent = selected ? 'Updated ' + new Date(selected.metadata.updatedAt).toLocaleString() : selectedRepo ? selectedRepo.items.length + ' parts' : indexes.length + ' index parts';
      element('composition-label').textContent = selected ? 'Selected index' : selectedRepo ? 'Repository total' : 'All indexes';

      var exportControls = element('export-controls');
      if (selected) {
        exportControls.style.display = 'flex';
        element('export-json').href = '/api/indexes/' + encodeURIComponent(selected.metadata.uid) + '/export?format=json';
        element('export-csv').href = '/api/indexes/' + encodeURIComponent(selected.metadata.uid) + '/export?format=csv';
      } else {
        exportControls.style.display = 'none';
      }

      var maximum = Math.max(1, ...values.map(function(item) { return item.value; }));
      var bars = element('bars');
      bars.replaceChildren();
      values.forEach(function(item) {
        var row = document.createElement('div');
        row.className = 'bar-row';
        var label = document.createElement('span');
        label.className = 'bar-label';
        label.textContent = item.label;
        var track = document.createElement('div');
        track.className = 'bar-track';
        var fill = document.createElement('div');
        fill.className = 'bar-fill';
        fill.style.width = (item.value / maximum * 100) + '%';
        track.appendChild(fill);
        var value = document.createElement('span');
        value.className = 'bar-value';
        value.textContent = numberFormat.format(item.value);
        row.appendChild(label); row.appendChild(track); row.appendChild(value); bars.appendChild(row);
      });
      renderRelationBreakdown(scope);
      void renderIntelligence(selected);
      void renderCapabilityPanels(selected);
    }

    function renderRelationBreakdown(scope) {
      var counts = {};
      scope.forEach(function(item) {
        Object.keys(item.relationKinds || {}).forEach(function(kind) {
          counts[kind] = (counts[kind] || 0) + item.relationKinds[kind];
        });
      });
      var entries = Object.keys(counts).map(function(kind) { return { kind: kind, count: counts[kind] }; }).sort(function(left, right) { return right.count - left.count; });
      var maximum = Math.max(1, ...entries.map(function(entry) { return entry.count; }));
      var container = element('relation-bars');
      container.replaceChildren();
      element('relation-scope').textContent = activeIndex() ? 'Selected index' : selectedGroup ? 'Repository total' : 'All indexes';
      if (!entries.length) {
        var empty = document.createElement('div');
        empty.className = 'status';
        empty.textContent = 'No relation data in this scope.';
        container.appendChild(empty); return;
      }
      entries.forEach(function(entry) {
        var row = document.createElement('div');
        row.className = 'relation-row';
        var name = document.createElement('span');
        name.className = 'relation-name';
        name.textContent = entry.kind;
        var track = document.createElement('div');
        track.className = 'relation-track';
        var fill = document.createElement('div');
        fill.className = 'relation-fill';
        fill.style.background = relationColors[entry.kind] || '#61d6ad';
        fill.style.width = (entry.count / maximum * 100) + '%';
        track.appendChild(fill);
        var value = document.createElement('span');
        value.textContent = numberFormat.format(entry.count);
        row.appendChild(name); row.appendChild(track); row.appendChild(value); container.appendChild(row);
      });
    }

    async function renderIntelligence(selected) {
      var request = ++intelligenceRequest;
      var areaList = element('repository-areas');
      var endpointList = element('api-endpoints');
      areaList.replaceChildren();
      endpointList.replaceChildren();
      if (!selected) {
        element('area-count').textContent = '0 areas';
        element('endpoint-count').textContent = '0 endpoints';
        var areaEmpty = document.createElement('div');
        areaEmpty.className = 'empty';
        areaEmpty.textContent = 'Select one workspace to inspect architecture.';
        areaList.appendChild(areaEmpty);
        var endpointEmpty = document.createElement('div');
        endpointEmpty.className = 'empty';
        endpointEmpty.textContent = 'Select one workspace to inspect detected endpoints.';
        endpointList.appendChild(endpointEmpty);
        return;
      }
      areaList.innerHTML = '<div class="empty">Loading repository map…</div>';
      endpointList.innerHTML = '<div class="empty">Detecting API endpoints…</div>';
      try {
        var response = await fetch('/api/indexes/' + encodeURIComponent(selected.metadata.uid) + '/intelligence');
        var payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Could not load repository intelligence');
        if (request !== intelligenceRequest) return;
        var areas = payload.repositoryMap.areas || [];
        var endpoints = payload.apiEndpoints || [];
        element('area-count').textContent = numberFormat.format(areas.length) + ' areas';
        element('endpoint-count').textContent = numberFormat.format(endpoints.length) + ' endpoints';
        areaList.replaceChildren();
        endpointList.replaceChildren();
        if (!areas.length) {
          var noAreas = document.createElement('div');
          noAreas.className = 'empty'; noAreas.textContent = 'No repository areas found.'; areaList.appendChild(noAreas);
        } else {
          areas.slice(0, 12).forEach(function(area) {
            var row = document.createElement('div'); row.className = 'intel-row';
            var name = document.createElement('span'); name.className = 'intel-name';
            var kind = document.createElement('span'); kind.className = 'intel-kind'; kind.textContent = area.kind;
            var path = document.createElement('span'); path.textContent = area.path;
            name.appendChild(kind); name.appendChild(path);
            var meta = document.createElement('span'); meta.className = 'intel-meta'; meta.textContent = numberFormat.format(area.files) + ' files · ' + numberFormat.format(area.symbols) + ' symbols';
            row.appendChild(name); row.appendChild(meta); areaList.appendChild(row);
          });
        }
        if (!endpoints.length) {
          var noEndpoints = document.createElement('div'); noEndpoints.className = 'empty'; noEndpoints.textContent = 'No API endpoints detected in indexed files.'; endpointList.appendChild(noEndpoints);
        } else {
          endpoints.slice(0, 12).forEach(function(endpoint) {
            var row = document.createElement('div'); row.className = 'intel-row';
            var name = document.createElement('span'); name.className = 'intel-name';
            var method = document.createElement('span'); method.className = 'endpoint-method'; method.textContent = endpoint.method;
            var path = document.createElement('span'); path.textContent = endpoint.path;
            name.appendChild(method); name.appendChild(path);
            var meta = document.createElement('span'); meta.className = 'intel-meta'; meta.textContent = endpoint.fileId + ':' + endpoint.startLine;
            row.appendChild(name); row.appendChild(meta); endpointList.appendChild(row);
          });
        }
      } catch (error) {
        if (request !== intelligenceRequest) return;
        areaList.replaceChildren(); endpointList.replaceChildren();
        var failure = document.createElement('div'); failure.className = 'empty'; failure.textContent = 'Could not load repository intelligence: ' + String(error); areaList.appendChild(failure);
      }
    }

    async function renderCapabilityPanels(selected) {
      if (!selected) return;
      try {
        const fileResponse = await fetch('/api/indexes/' + encodeURIComponent(selected.metadata.uid) + '/files');
        const filePayload = await fileResponse.json();
        const fileTable = element('file-table-body');
        if (fileTable) {
          fileTable.innerHTML = '';
          const files = Array.isArray(filePayload.files) ? filePayload.files : [];
          const languages = [...new Set(files.map(f => f.language))].sort();
          const langSelect = element('search-lang');
          if (langSelect) {
            const currentLang = langSelect.value;
            langSelect.innerHTML = '<option value="">All Languages</option>';
            languages.forEach(lang => {
              const opt = document.createElement('option');
              opt.value = lang;
              opt.textContent = lang;
              if (lang === currentLang) opt.selected = true;
              langSelect.appendChild(opt);
            });
          }
          if (!files.length) {
            fileTable.innerHTML = '<tr><td colspan="5" class="table-empty">No files indexed</td></tr>';
          } else {
            files.slice(0, 15).forEach(function(file) {
              const row = document.createElement('tr');
              row.innerHTML = '<td>' + file.path + '</td><td><span class="pill" style="font-size:9px;">' + file.language + '</span></td><td>' + numberFormat.format(file.size || 0) + ' B</td><td>' + ((file.terms || []).length) + '</td><td>' + new Date(file.modifiedAt || 0).toLocaleDateString() + '</td>';
              fileTable.appendChild(row);
            });
          }
        }

        const symbolResponse = await fetch('/api/indexes/' + encodeURIComponent(selected.metadata.uid) + '/symbols');
        const symbolPayload = await symbolResponse.json();
        const symbolTable = element('symbol-table-body');
        if (symbolTable) {
          symbolTable.innerHTML = '';
          const symbols = Array.isArray(symbolPayload.symbols) ? symbolPayload.symbols.slice(0, 15) : [];
          if (!symbols.length) {
            symbolTable.innerHTML = '<tr><td colspan="5" class="table-empty">No symbols indexed</td></tr>';
          } else {
            symbols.forEach(function(symbol) {
              const row = document.createElement('tr');
              row.innerHTML = '<td><strong>' + symbol.name + '</strong></td><td><span class="intel-kind" style="font-size:9px;">' + symbol.kind + '</span></td><td>' + symbol.filePath + '</td><td>' + symbol.startLine + '</td><td>' + (symbol.parentId || '—') + '</td>';
              symbolTable.appendChild(row);
            });
          }
        }

        const securityResponse = await fetch('/api/indexes/' + encodeURIComponent(selected.metadata.uid) + '/security');
        const securityPayload = await securityResponse.json();
        const securityTable = element('security-table-body');
        if (securityTable) {
          securityTable.innerHTML = '';
          const findings = Array.isArray(securityPayload.findings) ? securityPayload.findings.slice(0, 10) : [];
          if (!findings.length) {
            securityTable.innerHTML = '<tr><td colspan="4" class="table-empty">No sensitive findings detected</td></tr>';
          } else {
            findings.forEach(function(finding) {
              const row = document.createElement('tr');
              row.innerHTML = '<td><span class="pill" style="color:var(--coral);">' + finding.kind + '</span></td><td>' + finding.filePath + ':' + finding.line + '</td><td>' + Number(finding.confidence || 0).toFixed(2) + '</td><td>[REDACTED]</td>';
              securityTable.appendChild(row);
            });
          }
        }

        const inspectorResponse = await fetch('/api/indexes/' + encodeURIComponent(selected.metadata.uid) + '/inspect');
        const inspectorPayload = await inspectorResponse.json();
        const inspectorStats = element('inspector-stats');
        if (inspectorStats && inspectorPayload && inspectorPayload.snapshot) {
          inspectorStats.innerHTML = '';
          const entries = [
            ['Magic', inspectorPayload.magic],
            ['Version', String(inspectorPayload.version)],
            ['Files', String(inspectorPayload.snapshot.fileCount)],
            ['Symbols', String(inspectorPayload.snapshot.symbolCount)],
            ['Relations', String(inspectorPayload.snapshot.relationCount)],
            ['Chunks', String(inspectorPayload.snapshot.chunkCount)],
            ['Vectors', String(inspectorPayload.snapshot.vectorCount)],
            ['UID', inspectorPayload.uid.slice(0, 12)]
          ];
          entries.forEach(function(entry) {
            const box = document.createElement('div');
            box.className = 'metric-box';
            box.innerHTML = '<span>' + entry[0] + '</span><strong>' + entry[1] + '</strong>';
            inspectorStats.appendChild(box);
          });
        }
      } catch (error) {
        console.warn('Capability panels unavailable', error);
      }
    }

    async function renderSelectedGraph() {
      var graph = element('graph');
      graph.replaceChildren();
      var selected = activeIndex();
      var graphOpen = element('graph-open');
      graphOpen.hidden = !selected;
      if (selected) graphOpen.href = '/graph/' + encodeURIComponent(selected.metadata.uid);
      if (!selected) {
        element('graph-empty').style.display = 'grid';
        element('graph-empty').textContent = selectedGroup ? 'Select an index part to explore its symbol graph.' : 'Select a workspace to inspect its resolved symbol relations.';
        element('relation-count').textContent = '0 edges';
        return;
      }
      try {
        var response = await fetch('/api/indexes/' + encodeURIComponent(selected.metadata.uid));
        var payload = await response.json();
        var nodes = payload.graph.nodes || [];
        var edges = payload.graph.edges || [];
        element('relation-count').textContent = numberFormat.format(edges.length) + ' edges';
        if (nodes.length === 0 || edges.length === 0) {
          element('graph-empty').style.display = 'grid';
          element('graph-empty').textContent = 'No resolved symbol-to-symbol relations in this index.';
          return;
        }
        element('graph-empty').style.display = 'none';
        var width = 620, height = 280, cx = width / 2, cy = height / 2, radius = Math.min(width, height) * 0.37;
        var positions = new Map();
        nodes.forEach(function(node, index) {
          var angle = (Math.PI * 2 * index / nodes.length) - Math.PI / 2;
          positions.set(node.id, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
        });
        edges.forEach(function(edge) {
          var from = positions.get(edge.source), to = positions.get(edge.target);
          if (!from || !to) return;
          graph.appendChild(makeSvg('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: 'graph-edge' }));
        });
        nodes.forEach(function(node) {
          var point = positions.get(node.id);
          var group = makeSvg('g', {});
          var circle = makeSvg('circle', { cx: point.x, cy: point.y, r: 5, class: 'graph-node' });
          var label = makeSvg('text', { x: point.x + 8, y: point.y - 7, class: 'graph-label' });
          label.textContent = node.name.length > 18 ? node.name.slice(0, 17) + '…' : node.name;
          var title = makeSvg('title', {});
          title.textContent = node.kind + ' · ' + node.filePath;
          group.appendChild(circle); group.appendChild(label); group.appendChild(title); graph.appendChild(group);
        });
        element('graph-note').textContent = (payload.graph.truncated ? 'Overview shows the 80 most connected symbols. ' : '') + 'Open the full graph to explore every symbol and resolved edge.';
      } catch (error) {
        element('graph-empty').style.display = 'grid';
        element('graph-empty').textContent = 'Could not load graph: ' + String(error);
      }
    }

    async function renderSearch() {
      var query = element('query').value.trim();
      var lang = element('search-lang') ? element('search-lang').value : '';
      var container = element('results');
      if (query.length < 2) {
        element('result-count').textContent = 'Type at least 2 characters';
        container.innerHTML = '<div class="status">Search is performed locally against the saved index data.</div>';
        return;
      }
      if (searchController) searchController.abort();
      searchController = new AbortController();
      container.innerHTML = '<div class="status"><span class="spinner"></span>Searching indexes…</div>';
      var url = '/api/search?q=' + encodeURIComponent(query) + '&limit=50' + (selectedUid ? '&index=' + encodeURIComponent(selectedUid) : selectedGroup ? '&group=' + encodeURIComponent(selectedGroup) : '') + (lang ? '&language=' + encodeURIComponent(lang) : '');
      try {
        var response = await fetch(url, { signal: searchController.signal });
        var payload = await response.json();
        var results = payload.results || [];
        element('result-count').textContent = numberFormat.format(results.length) + ' matches';
        container.replaceChildren();
        if (!results.length) {
          container.innerHTML = '<div class="status">No matching indexed files.</div>';
          return;
        }
        results.forEach(function(result) {
          var row = document.createElement('article');
          row.className = 'result-row';
          var location = document.createElement('div');
          location.className = 'result-location';
          var file = document.createElement('span');
          file.textContent = result.path;
          var workspace = document.createElement('small');
          workspace.textContent = result.workspace + ' · ' + result.language;
          location.appendChild(file); location.appendChild(workspace);
          var excerpt = document.createElement('div');
          excerpt.className = 'result-excerpt';
          excerpt.textContent = result.excerpt || result.language;
          var score = document.createElement('div');
          score.className = 'result-score';
          score.textContent = result.score.toFixed(1);
          var graphLink = document.createElement('a');
          graphLink.className = 'result-graph';
          graphLink.href = '/graph/' + encodeURIComponent(result.uid);
          graphLink.target = '_blank';
          graphLink.rel = 'noopener';
          graphLink.textContent = 'Open graph ↗';
          row.appendChild(location); row.appendChild(excerpt); row.appendChild(score); row.appendChild(graphLink);
          container.appendChild(row);
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          element('result-count').textContent = 'Search failed';
          container.textContent = String(error);
        }
      }
    }

    element('query').addEventListener('input', function() { clearTimeout(searchTimer); searchTimer = setTimeout(renderSearch, 180); });
    if (element('search-lang')) element('search-lang').addEventListener('change', renderSearch);
    element('index-filter').addEventListener('input', renderIndexList);
    element('github-form').addEventListener('submit', startGitHubIndex);
    element('refresh').addEventListener('click', refreshIndexes);
    refreshIndexes();
  </script>
</body>
</html>`;
