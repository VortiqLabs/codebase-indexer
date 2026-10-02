export const GRAPH_PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Symbol Graph · Codebase Index</title>
  <style>
    :root, [data-theme="dark"] {
      color-scheme: dark;
      --bg: #111917;
      --panel: #19231f;
      --line: #33413b;
      --ink: #e7eee8;
      --muted: #9aa99f;
      --acid: #d4f46c;
      --mint: #61d6ad;
      --coral: #ff8868;
      --blue: #70b7e3;
      --gold: #f4c95d;
      --violet: #bd98f2;
      --pink: #ee8dbe;
      --mono: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
      --sans: "Avenir Next", "Segoe UI", sans-serif;
      --control-bg: #1c2923;
    }
    [data-theme="light"] {
      color-scheme: light;
      --bg: #f2f5f1;
      --panel: #ffffff;
      --line: #dfe7dd;
      --ink: #1f2824;
      --muted: #5a655e;
      --acid: #1b665a;
      --mint: #0d4d42;
      --coral: #e16a4b;
      --blue: #4f7aa4;
      --gold: #c39228;
      --violet: #9b72a2;
      --pink: #d16483;
      --control-bg: #ffffff;
    }
    *{box-sizing:border-box}
    html,body{width:100%;height:100%;margin:0;overflow:hidden;background:var(--bg);color:var(--ink);font:13px/1.45 var(--sans);transition:background .25s ease,color .25s ease}
    button,input,a{font:inherit}
    button{cursor:pointer}
    #stage{position:fixed;inset:0;background-color:var(--bg);background-image:linear-gradient(rgba(151,180,158,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(151,180,158,.055) 1px,transparent 1px);background-size:28px 28px}
    canvas{display:block;width:100%;height:100%;touch-action:none}
    .topbar{position:absolute;left:20px;right:20px;top:18px;display:flex;align-items:center;gap:14px;pointer-events:none}
    .topbar>*{pointer-events:auto}
    .back{color:var(--acid);text-decoration:none;font:11px var(--mono);white-space:nowrap}
    .back:hover{color:var(--ink)}
    .heading{min-width:0;margin-right:auto}
    .heading h1{margin:0;font-size:18px;line-height:1.2;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .heading p{margin:3px 0 0;color:var(--muted);font:10px var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .search-control{position:relative;width:min(280px,28vw)}
    .search-control svg{position:absolute;left:10px;top:11px;width:14px;height:14px;stroke:var(--muted);fill:none;stroke-width:1.7;pointer-events:none}
    .find{width:100%;height:36px;border:1px solid var(--line);background:var(--control-bg);color:var(--ink);padding:0 11px 0 32px;outline:none;border-radius:8px}
    .find:focus{border-color:var(--mint)}
    .tools{display:flex;gap:5px}
    .tool{width:36px;height:36px;border:1px solid var(--line);background:var(--control-bg);color:var(--ink);display:grid;place-items:center;border-radius:8px}
    .tool svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .tool:hover{border-color:var(--acid);color:var(--acid)}
    .panel{position:absolute;right:20px;top:82px;width:225px;padding:14px;border:1px solid var(--line);background:var(--panel);backdrop-filter:blur(8px);border-radius:12px}
    .panel-label{color:var(--muted);font:9px var(--mono);text-transform:uppercase;letter-spacing:.08em}
    .panel-value{margin:4px 0 13px;font:600 20px var(--mono);color:var(--acid)}
    .selected-name{font-size:14px;font-weight:650;overflow-wrap:anywhere;margin:5px 0}
    .selected-path{font:10px/1.5 var(--mono);color:var(--muted);overflow-wrap:anywhere}
    .selected-kind{display:inline-flex;align-items:center;gap:5px;color:var(--bg);padding:2px 6px;font:10px var(--mono);margin:4px 0 10px;border-radius:4px}
    .selected-kind svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linejoin:round}
    .divider{height:1px;background:var(--line);margin:11px 0}
    .hint{color:var(--muted);font:10px/1.6 var(--mono)}
    .legend{position:absolute;left:20px;bottom:18px;display:block;width:min(660px,calc(100vw - 300px));max-height:34vh;overflow:auto;padding:11px 13px;background:var(--panel);border:1px solid var(--line);border-radius:12px}
    .legend-title{display:flex;align-items:center;justify-content:space-between;color:var(--muted);font:9px var(--mono);text-transform:uppercase;letter-spacing:.08em}
    .legend-toggle{border:0;background:transparent;color:var(--acid);font:9px var(--mono);padding:2px 4px;display:flex;align-items:center;gap:5px}
    .legend-toggle svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:1.8}
    .legend-toggle:hover{color:var(--ink)}
    .relation-filters{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0 11px}
    .legend-item{display:flex;align-items:center;gap:5px;border:1px solid transparent;background:transparent;color:var(--muted);padding:4px 6px;font:9px var(--mono);opacity:.5;border-radius:6px}
    .legend-item.active{border-color:var(--line);color:var(--ink);opacity:1}
    .legend-item:hover{border-color:var(--acid)}
    .edge-swatch{width:15px;height:2px;display:inline-block;border-radius:100%}
    .legend-count{color:var(--muted);font-size:8px}
    .symbol-guide{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:8px}
    .symbol-guide-title{color:var(--muted);font:9px var(--mono);text-transform:uppercase}
    .symbol-kind{display:flex;align-items:center;gap:4px;color:var(--ink);font:9px var(--mono)}
    .symbol-kind svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linejoin:round}
    .status{position:absolute;right:20px;bottom:20px;color:var(--muted);font:10px var(--mono);text-align:right;max-width:360px}
    .status strong{color:var(--mint);font-weight:500}
    .loading{position:absolute;inset:0;display:grid;place-items:center;background:var(--bg);color:var(--acid);font:12px var(--mono);transition:opacity .3s}
    .loading.hidden{opacity:0;pointer-events:none}
    .error{color:var(--coral)}
    .source-dock{position:fixed;z-index:8;left:0;right:0;bottom:0;height:min(48vh,560px);min-height:280px;display:flex;flex-direction:column;background:#1e1e1e;border-top:1px solid var(--line);box-shadow:0 -16px 50px rgba(0,0,0,.35);transform:translateY(102%);transition:transform .24s ease}
    .source-dock.open{transform:translateY(0)}
    .source-header{height:43px;flex:0 0 43px;display:flex;align-items:center;gap:10px;padding:0 14px;background:#202924;border-bottom:1px solid var(--line)}
    .editor-brand{color:#8bc7ff;font:600 9px var(--mono);letter-spacing:.06em}
    .source-file{color:var(--ink);font:11px var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .source-symbol{margin-left:auto;color:var(--muted);font:10px var(--mono);white-space:nowrap}
    .source-close{width:28px;height:28px;display:grid;place-items:center;border:1px solid transparent;background:transparent;color:var(--ink)}
    .source-close:hover{border-color:var(--line);color:var(--acid)}
    .source-close svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round}
    .source-editor{flex:1;min-height:0}
    .source-loading{height:100%;display:grid;place-items:center;color:var(--muted);font:11px var(--mono)}
    body.source-open #stage{bottom:min(48vh,560px)}
    body.source-open .panel,body.source-open .legend,body.source-open .status{display:none}
    @media(max-width:700px){.topbar{left:12px;right:12px;top:12px;flex-wrap:wrap}.heading{order:2;width:calc(100% - 110px);flex:1}.back{order:1}.search-control{order:3;width:100%;flex:1}.tools{order:4}.panel{top:116px;right:12px;width:185px;padding:10px}.legend{left:12px;right:12px;bottom:12px;width:auto;max-height:26vh}.status{right:12px;bottom:calc(26vh + 22px);font-size:9px}.heading h1{font-size:15px}.source-dock{height:54vh;min-height:240px}body.source-open #stage{bottom:54vh}.source-header{padding:0 9px;gap:7px}.source-symbol{max-width:32%;overflow:hidden;text-overflow:ellipsis}}
  </style>
</head>
<body data-index-uid="__INDEX_UID__">
  <main id="stage"><canvas id="network" aria-label="Interactive symbol relation graph"></canvas></main>
  <div class="topbar">
    <a class="back" href="/">← Index overview</a>
    <div class="heading"><h1 id="workspace-name">Loading graph</h1><p id="workspace-path"></p></div>
    <label class="search-control"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 5 5"></path></svg><input id="find" class="find" type="search" placeholder="Find a symbol or file" autocomplete="off"></label>
    <div class="tools">
      <button class="tool" id="theme-toggle" title="Toggle dark/light theme" aria-label="Toggle theme"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg></button>
      <button class="tool" id="zoom-out" title="Zoom out" aria-label="Zoom out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path></svg></button>
      <button class="tool" id="zoom-in" title="Zoom in" aria-label="Zoom in"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg></button>
      <button class="tool" id="fit" title="Fit all symbols" aria-label="Fit graph"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"></path></svg></button>
      <button class="tool" id="pause" title="Pause layout animation" aria-label="Pause animation"><svg id="pause-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"></path></svg></button>
    </div>
  </div>
  <aside class="panel"><div class="panel-label">Symbols in graph</div><div class="panel-value" id="node-count">—</div><div class="panel-label">Resolved connections</div><div class="panel-value" id="edge-count">—</div><div class="divider"></div><div class="panel-label">Selected symbol</div><div class="selected-name" id="selected-name">Click a node</div><div id="selected-kind"></div><div class="selected-path" id="selected-path">All indexed symbols are included in this graph.</div><div class="divider"></div><div class="hint">Drag the canvas to pan.<br>Scroll or use + / − to zoom.<br>Hover to isolate nearby links.<br>Click a node for its source file.</div></aside>
  <div class="legend" id="legend"><div class="legend-title"><span>Connection filters</span><button class="legend-toggle" id="show-all"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>Show all</button></div><div class="relation-filters" id="relation-filters"></div><div class="symbol-guide" id="symbol-guide"><span class="symbol-guide-title">Symbol shapes</span></div></div>
  <div class="status" id="status">Preparing simulation…</div>
  <div class="loading" id="loading">LOADING ALL INDEXED SYMBOLS</div>
  <section class="source-dock" id="source-dock" aria-hidden="true" aria-label="Source code editor">
    <div class="source-header"><span class="editor-brand">MONACO</span><span class="source-file" id="source-file">Source</span><span class="source-symbol" id="source-symbol"></span><button class="source-close" id="source-close" title="Close source editor" aria-label="Close source editor"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg></button></div>
    <div class="source-editor" id="source-editor"><div class="source-loading">Click a symbol to view its source.</div></div>
  </section>
  <script src="/assets/monaco/vs/loader.js"></script>
  <script>
    (function() {
      var saved = localStorage.getItem('codebase_theme') || 'system';
      if (saved === 'system') {
        var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', saved);
      }
    })();
  </script>
  <script>require.config({paths:{vs:'/assets/monaco/vs'}});</script>
  <script src="/assets/graph-client.js" defer></script>
</body>
</html>`;
