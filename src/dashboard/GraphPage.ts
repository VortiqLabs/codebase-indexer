export const GRAPH_PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dependency & Symbol Graph — Codebase Indexer IDE</title>
  <style>
    :root, [data-theme="dark"] {
      color-scheme: dark;
      --bg: #080808;
      --panel: #0b0b0b;
      --line: #242424;
      --ink: #ffffff;
      --muted: #bdbdbd;
      --subtle: #8a8a8a;
      --mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
      --sans: "Inter", -apple-system, sans-serif;
      --control-bg: #101010;
    }
    [data-theme="light"] {
      color-scheme: light;
      --bg: #ffffff;
      --panel: #fafafa;
      --line: #e5e5e5;
      --ink: #111111;
      --muted: #222222;
      --subtle: #666666;
      --control-bg: #f5f5f5;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: var(--bg); color: var(--ink); font-family: var(--sans); font-size: 12px; }
    button, input, select { font: inherit; color: inherit; }
    button { cursor: pointer; }
    #stage { position: fixed; inset: 0; background-color: var(--bg); }
    canvas { display: block; width: 100%; height: 100%; }

    .topbar { position: absolute; left: 16px; right: 16px; top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; pointer-events: none; }
    .topbar > * { pointer-events: auto; }
    .back { color: var(--ink); text-decoration: none; font-family: var(--mono); font-size: 11px; background: var(--panel); border: 1px solid var(--line); padding: 4px 10px; border-radius: 5px; }
    .heading h1 { margin: 0; font-size: 15px; font-weight: 600; }
    .heading p { margin: 1px 0 0; color: var(--subtle); font-family: var(--mono); font-size: 10px; }

    .mode-selector { display: flex; gap: 2px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 2px; }
    .mode-btn { background: transparent; border: none; padding: 4px 8px; font-family: var(--mono); font-size: 11px; color: var(--subtle); border-radius: 4px; }
    .mode-btn.active { background: var(--control-bg); color: var(--ink); font-weight: 600; border: 1px solid var(--line); }

    .tools { display: flex; gap: 6px; }
    .tool-btn { height: 28px; background: var(--panel); border: 1px solid var(--line); color: var(--ink); padding: 0 10px; border-radius: 5px; font-family: var(--mono); font-size: 11px; }
    .tool-btn:hover { background: var(--control-bg); }

    .drawer { position: fixed; right: 16px; top: 56px; bottom: 16px; width: 280px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 12px; z-index: 10; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
    .drawer-title { font-size: 13px; font-weight: 600; }
    .drawer-sub { font-family: var(--mono); font-size: 10px; color: var(--subtle); }
    .divider { height: 1px; background: var(--line); margin: 4px 0; }

    .path-finder-box { display: flex; flex-direction: column; gap: 6px; }
    .input-sm { height: 26px; background: var(--control-bg); border: 1px solid var(--line); border-radius: 4px; padding: 0 8px; font-family: var(--mono); font-size: 11px; width: 100%; outline: none; }

    .source-dock { position: fixed; z-index: 20; left: 0; right: 0; bottom: 0; height: 300px; display: flex; flex-direction: column; background: var(--panel); border-top: 1px solid var(--line); transform: translateY(100%); transition: transform 0.2s; }
    .source-dock.open { transform: translateY(0); }
    .source-header { height: 36px; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; border-bottom: 1px solid var(--line); font-family: var(--mono); font-size: 11px; }
    .source-editor { flex: 1; }

    .status { position: absolute; left: 16px; bottom: 16px; font-family: var(--mono); font-size: 11px; color: var(--subtle); background: var(--panel); border: 1px solid var(--line); padding: 4px 8px; border-radius: 5px; }
  </style>
</head>
<body data-index-uid="__INDEX_UID__">
  <main id="stage"><canvas id="network"></canvas></main>

  <div class="topbar">
    <div style="display:flex; align-items:center; gap:12px;">
      <a class="back" href="/">← Overview</a>
      <div class="heading">
        <h1 id="workspace-name">Dependency Graph Workspace</h1>
        <p id="workspace-path">Loading graph data…</p>
      </div>
    </div>

    <div class="mode-selector">
      <button class="mode-btn active" data-mode="dot">Dot / Force</button>
      <button class="mode-btn" data-mode="hierarchical">Hierarchical</button>
      <button class="mode-btn" data-mode="radial">Radial</button>
      <button class="mode-btn" data-mode="flow">Flow</button>
      <button class="mode-btn" data-mode="matrix">Matrix</button>
    </div>

    <div class="tools">
      <button class="tool-btn" id="btn-theme">Theme</button>
      <button class="tool-btn" id="btn-fit">Fit</button>
      <button class="tool-btn" id="btn-cycles">Find Cycles</button>
    </div>
  </div>

  <aside class="drawer">
    <div class="drawer-title">Node Details</div>
    <div id="selected-name" style="font-weight:600; font-family:var(--mono);">Click a node</div>
    <div id="selected-path" class="drawer-sub">Select symbol or file to view dependencies.</div>
    <div class="divider"></div>

    <div class="drawer-title">Path Finder</div>
    <div class="path-finder-box">
      <input id="path-from" class="input-sm" type="text" placeholder="From symbol…">
      <input id="path-to" class="input-sm" type="text" placeholder="To symbol…">
      <button id="btn-find-path" class="tool-btn" style="width:100%; margin-top:2px;">Trace Path</button>
    </div>
    <div id="path-result" class="drawer-sub" style="margin-top:4px;"></div>
  </aside>

  <section class="source-dock" id="source-dock">
    <div class="source-header">
      <span>MONACO Editor</span>
      <button id="source-close" style="background:none; border:none; cursor:pointer;">✕</button>
    </div>
    <div class="source-editor" id="source-editor"></div>
  </section>

  <div class="status" id="status-text">Loading nodes…</div>

  <script src="/assets/monaco/vs/loader.js"></script>
  <script>require.config({paths:{vs:'/assets/monaco/vs'}});</script>
  <script src="/assets/graph-client.js" defer></script>
</body>
</html>`;
