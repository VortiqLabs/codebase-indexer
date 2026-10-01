export const DASHBOARD_PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Codebase Index Dashboard</title>
  <style>
    :root{color-scheme:light;--paper:#f3f4ef;--ink:#202723;--muted:#737b75;--line:#d8ddd5;--panel:#fff;--green:#176b58;--lime:#c2e663;--coral:#e16a4b;--blue:#467e9b;--mono:"IBM Plex Mono","SFMono-Regular",Consolas,monospace;--sans:"Avenir Next","Segoe UI",sans-serif}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.45 var(--sans)}button,input{font:inherit}button{cursor:pointer}header{height:70px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 28px;background:#fafbf7}.brand{display:flex;align-items:center;gap:12px;font-weight:700}.mark{width:27px;height:27px;background:var(--green);display:grid;place-items:center;color:var(--lime);font:700 15px var(--mono);clip-path:polygon(0 0,100% 0,100% 72%,72% 100%,0 100%)}.header-meta{font:11px var(--mono);color:var(--muted)}
    .layout{max-width:1500px;margin:auto;padding:24px 28px 44px;display:grid;grid-template-columns:250px minmax(0,1fr);gap:28px}.rail{border-right:1px solid var(--line);padding-right:20px}.eyebrow{font:10px var(--mono);text-transform:uppercase;color:var(--muted);letter-spacing:0.08em}.rail-top{display:flex;justify-content:space-between;align-items:center;margin:6px 0 14px}.refresh{border:1px solid var(--line);background:transparent;padding:5px 8px;color:var(--green);font:11px var(--mono)}.index-list{display:grid;gap:4px}.index-item{border:0;border-left:2px solid transparent;background:transparent;text-align:left;padding:10px 9px;color:var(--ink);min-width:0}.index-item:hover,.index-item.active{background:#e8ece5;border-left-color:var(--green)}.index-name{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.index-path{display:block;color:var(--muted);font:10px var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px}.empty{color:var(--muted);font-size:12px;padding:12px 4px}
    main{min-width:0}.page-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin:4px 0 20px}.page-heading h1{font-size:23px;line-height:1.2;margin:5px 0 4px;font-weight:650}.workspace-path{color:var(--muted);font:11px var(--mono);overflow-wrap:anywhere}.updated{color:var(--muted);font:10px var(--mono);text-align:right}.searchbar{display:flex;align-items:center;border:1px solid #b8c1b8;background:var(--panel);padding:0 14px;height:49px;gap:12px;margin-bottom:20px}.search-icon{font:16px var(--mono);color:var(--green)}.searchbar input{width:100%;border:0;outline:0;background:transparent;color:var(--ink);font-size:14px}.searchbar input::placeholder{color:#969f98}.search-hint{font:10px var(--mono);color:var(--muted);white-space:nowrap}
    .metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-bottom:22px}.metric{padding:15px 14px 14px 0;border-right:1px solid var(--line);margin-right:14px}.metric:last-child{border-right:0}.metric-value{font:600 24px var(--mono);letter-spacing:0}.metric-label{font:10px var(--mono);color:var(--muted);text-transform:uppercase;margin-top:5px}
    .viz-grid{display:grid;grid-template-columns:minmax(250px,0.8fr) minmax(350px,1.4fr);gap:24px;margin-bottom:24px}.viz-section{min-width:0}.section-head{display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:12px}.section-head h2{font-size:13px;margin:0;font-weight:650}.section-head span{font:10px var(--mono);color:var(--muted)}.bars{width:100%;display:grid;gap:10px}.bar-row{display:grid;grid-template-columns:72px minmax(40px,1fr) 48px;align-items:center;gap:9px;font:10px var(--mono)}.bar-label{color:var(--muted)}.bar-track{height:8px;background:#e1e5dd}.bar-fill{height:100%;background:var(--green);min-width:2px;transition:width .25s ease}.bar-row:nth-child(2n) .bar-fill{background:var(--blue)}.bar-value{text-align:right}.graph-wrap{border:1px solid var(--line);background:#f8f9f5;min-height:235px;position:relative;overflow:hidden}.graph-wrap svg{width:100%;height:280px;display:block}.graph-empty{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;color:var(--muted);font:11px var(--mono)}.graph-edge{stroke:#93a69a;stroke-width:1.2;opacity:.65}.graph-node{fill:var(--lime);stroke:var(--green);stroke-width:1.5}.graph-label{font:9px var(--mono);fill:var(--ink)}.graph-note{font:10px var(--mono);color:var(--muted);margin-top:7px}.graph-open{font:10px var(--mono);color:var(--green);text-decoration:none;border-bottom:1px solid #98b8a9;padding-bottom:2px}.graph-open:hover{color:var(--coral)}
    .results{border-top:1px solid var(--line)}.results-head{display:flex;align-items:baseline;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--line)}.results-head h2{font-size:13px;margin:0}.result-count{font:10px var(--mono);color:var(--muted)}.result-row{display:grid;grid-template-columns:minmax(120px,1.1fr) minmax(0,2fr) 60px;gap:16px;align-items:start;padding:12px 0;border-bottom:1px solid var(--line);animation:appear .18s ease both}.result-location{font:11px var(--mono);overflow-wrap:anywhere}.result-location small{display:block;color:var(--muted);font-size:10px;margin-top:3px}.result-excerpt{font:11px/1.5 var(--mono);color:#48534c;white-space:pre-wrap;overflow-wrap:anywhere;max-height:67px;overflow:hidden}.result-score{text-align:right;color:var(--green);font:11px var(--mono)}.status{color:var(--muted);padding:14px 0;font-size:12px}.error-line{color:#a33b25;font:11px var(--mono);padding:6px 0}.spinner{width:10px;height:10px;border:1px solid var(--green);border-right-color:transparent;border-radius:50%;display:inline-block;animation:spin .8s linear infinite;margin-right:6px}@keyframes spin{to{transform:rotate(360deg)}}@keyframes appear{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
    @media(max-width:900px){.layout{grid-template-columns:200px minmax(0,1fr);gap:18px;padding:18px}.viz-grid{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(3,1fr);row-gap:10px}.metric:nth-child(3){border-right:0}}@media(max-width:620px){header{padding:0 16px}.layout{display:flex;flex-direction:column;padding:16px}.rail{border-right:0;border-bottom:1px solid var(--line);padding:0 0 14px}.index-list{display:flex;overflow:auto}.index-item{min-width:175px}.page-heading h1{font-size:20px}.metrics{grid-template-columns:repeat(2,1fr)}.metric:nth-child(3){border-right:1px solid var(--line)}.metric:nth-child(2n){border-right:0}.result-row{grid-template-columns:minmax(0,1fr) 50px}.result-excerpt{grid-column:1/-1;grid-row:2}.search-hint{display:none}}
  </style>
  <style>
    .sidebar-filter{display:block;margin:8px 0 12px}.sidebar-filter input{width:100%;height:34px;border:1px solid var(--line);background:#fbfcfa;padding:0 9px;font:11px var(--mono);outline:none}.sidebar-filter input:focus{border-color:var(--green)}.sidebar-filter input::placeholder{color:#929b94}.index-group{display:flex;align-items:center;gap:7px;border-left-color:#9bad9e}.group-caret{width:12px;color:var(--green);font:12px var(--mono)}.index-group.active{background:#e2ebe1}.index-part{margin-left:15px;padding-left:8px!important;border-left-color:#cbd5cc!important}.index-part.active{border-left-color:var(--coral)!important}
    .github-import{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:15px 0;margin:0 0 20px}.github-heading{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:10px}.github-heading h2{font-size:13px;margin:0}.github-secret-note{color:var(--muted);font:10px var(--mono)}.github-form{display:grid;grid-template-columns:minmax(180px,1fr) minmax(100px,160px) 100px auto;gap:7px}.github-input{height:36px;min-width:0;border:1px solid #b8c1b8;background:#fbfcfa;padding:0 9px;font:11px var(--mono);outline:none}.github-input:focus{border-color:var(--green)}.github-input::placeholder{color:#929b94}.github-index-button{height:36px;border:0;background:var(--green);color:#fff;padding:0 12px;display:flex;align-items:center;gap:7px;font:11px var(--mono);white-space:nowrap}.github-index-button:hover{background:#125340}.github-index-button:disabled{opacity:.55;cursor:wait}.github-index-button svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.github-options{display:grid;grid-template-columns:minmax(180px,1fr) minmax(190px,1.5fr);gap:7px;margin-top:7px}.github-job{margin-top:11px;border:1px solid var(--line);background:#fff}.github-job[hidden]{display:none}.github-job-top{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 10px;border-bottom:1px solid var(--line);font:10px var(--mono)}.github-job-state{color:var(--green)}.github-progress{width:100%;height:3px;display:block;accent-color:var(--green)}.github-progress[hidden]{display:none}.github-log{height:140px;overflow:auto;padding:7px 10px;background:#202723;color:#dce6de;font:10px/1.55 var(--mono)}.github-log-entry{display:grid;grid-template-columns:58px 74px minmax(0,1fr);gap:7px;padding:2px 0}.github-log-time{color:#85958a}.github-log-stage{color:#c2e663;text-transform:uppercase}.github-log-message{overflow-wrap:anywhere}.github-result{color:var(--green);font:10px var(--mono);text-decoration:none}.github-result:hover{text-decoration:underline}
    .relation-breakdown{border-top:1px solid var(--line);padding-top:13px;margin:20px 0 24px}.relation-heading{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px}.relation-heading strong{font-size:12px}.relation-heading span{font:10px var(--mono);color:var(--muted)}.relation-bars{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:7px 18px}.relation-row{display:grid;grid-template-columns:78px minmax(30px,1fr) 38px;align-items:center;gap:8px;font:10px var(--mono)}.relation-name{color:var(--muted)}.relation-track{height:5px;background:#e1e5dd}.relation-fill{height:100%;background:var(--relation-color);min-width:2px}.relation-value{text-align:right}.result-row{grid-template-columns:minmax(120px,1fr) minmax(0,1.8fr) 45px 78px}.result-graph{align-self:start;color:var(--green);font:10px var(--mono);text-align:right;text-decoration:none;border-bottom:1px solid #a7c1b4;padding-bottom:2px}.result-graph:hover{color:var(--coral)}.index-empty{padding:12px 9px;color:var(--muted);font:10px var(--mono)}
    @media(max-width:900px){.github-form{grid-template-columns:minmax(180px,1fr) minmax(100px,140px) 90px}.github-index-button{grid-column:1/-1;justify-content:center}}@media(max-width:620px){.github-heading{align-items:flex-start;flex-direction:column;gap:4px}.github-form{grid-template-columns:minmax(0,1fr) 92px}.github-form #github-ref{grid-column:1}.github-form #github-size{grid-column:2}.github-index-button{grid-column:1/-1}.github-options{grid-template-columns:1fr}.github-log-entry{grid-template-columns:50px 62px minmax(0,1fr);gap:5px}.result-row{grid-template-columns:minmax(0,1fr) 55px}.result-excerpt{grid-column:1/-1;grid-row:2}.result-score{grid-column:2;grid-row:3}.result-graph{grid-column:1;grid-row:3;text-align:left}.relation-bars{grid-template-columns:1fr 1fr}}
  </style>
</head>
<body>
  <header><div class="brand"><span class="mark">CI</span><span>Codebase Index</span></div><div class="header-meta" id="health">LOCAL INDEX VIEWER</div></header>
  <div class="layout">
    <aside class="rail"><div class="eyebrow">Index collection</div><div class="rail-top"><span class="eyebrow" id="index-total">0 workspaces</span><button class="refresh" id="refresh">Refresh</button></div><label class="sidebar-filter"><input id="index-filter" type="search" placeholder="Filter workspaces" autocomplete="off"></label><nav class="index-list" id="index-list"></nav><div id="load-errors"></div></aside>
    <main>
      <div class="page-heading"><div><div class="eyebrow">Workspace index</div><h1 id="title">All workspaces</h1><div class="workspace-path" id="workspace-path">Search across every discovered index</div></div><div class="updated" id="updated"></div></div>
      <section class="github-import" aria-labelledby="github-heading">
        <div class="github-heading"><h2 id="github-heading">Index a GitHub repository</h2><span class="github-secret-note">Private repos use GITHUB_TOKEN or GH_TOKEN from the dashboard environment</span></div>
        <form class="github-form" id="github-form">
          <input class="github-input" id="github-url" type="url" placeholder="https://github.com/owner/repository" autocomplete="url" required>
          <input class="github-input" id="github-ref" type="text" placeholder="Default branch" aria-label="Branch or tag">
          <input class="github-input" id="github-size" type="number" min="0.001" max="100" step="0.001" value="1" aria-label="Maximum file size in megabytes" title="Maximum file size in megabytes">
          <button class="github-index-button" id="github-submit" type="submit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg><span>Index repository</span></button>
        </form>
        <div class="github-options"><input class="github-input" id="github-patterns" type="text" placeholder="Ignore patterns, comma-separated (optional)" aria-label="Ignore patterns"><div class="github-secret-note">Max file size is MB; larger or excluded-heavy repos will use less memory.</div></div>
        <section class="github-job" id="github-job" hidden aria-label="GitHub indexing progress">
          <div class="github-job-top"><span class="github-job-state" id="github-job-state">Preparing import…</span><a class="github-result" id="github-result" href="#" target="_blank" rel="noopener" hidden>Open indexed graph ↗</a></div>
          <progress class="github-progress" id="github-progress" max="100" hidden></progress>
          <div class="github-log" id="github-log" role="log" aria-live="polite"></div>
        </section>
      </section>
      <label class="searchbar"><span class="search-icon">⌕</span><input id="query" type="search" placeholder="Search files, symbols, and indexed terms" autocomplete="off"><span class="search-hint">LIVE SEARCH</span></label>
      <div class="metrics" id="metrics"></div>
      <div class="viz-grid"><section class="viz-section"><div class="section-head"><h2>Index composition</h2><span id="composition-label">ALL INDEXES</span></div><div class="bars" id="bars"></div></section><section class="viz-section"><div class="section-head"><h2>Resolved symbol relations</h2><a class="graph-open" id="graph-open" href="#" target="_blank" rel="noopener" hidden>Open full graph ↗</a><span id="relation-count">0 EDGES</span></div><div class="graph-wrap"><svg id="graph" viewBox="0 0 620 280" role="img" aria-label="Symbol relation graph"></svg><div class="graph-empty" id="graph-empty">Select a workspace to inspect its resolved symbol relations.</div></div><div class="graph-note" id="graph-note">Relation resolution is heuristic; unresolved relations are not drawn.</div></section></div>
      <section class="relation-breakdown"><div class="relation-heading"><strong>Relation makeup</strong><span id="relation-scope">All indexes</span></div><div class="relation-bars" id="relation-bars"></div></section>
      <section class="results"><div class="results-head"><h2>Search results</h2><span class="result-count" id="result-count">Type to search indexed files</span></div><div id="results"><div class="status">Search is performed locally against the saved index data.</div></div></section>
    </main>
  </div>
  <script>
    var indexes = [];
    var selectedUid = '';
    var selectedGroup = '';
    var expandedGroups = new Set();
    var searchTimer;
    var searchController;
    var githubEvents;
    var svgNamespace = 'http://www.w3.org/2000/svg';
    var countKeys = [['fileCount','Files'],['symbolCount','Symbols'],['relationCount','Relations'],['chunkCount','Chunks'],['vectorCount','Vectors']];
    var relationColors = {calls:'#176b58',imports:'#467e9b',references:'#c39228',contains:'#8a958d',extends:'#e16a4b',implements:'#9b72a2',exports:'#d16483'};
    var numberFormat = new Intl.NumberFormat();

    function element(id){return document.getElementById(id);}
    function makeSvg(name,attributes){var node=document.createElementNS(svgNamespace,name);Object.keys(attributes||{}).forEach(function(key){node.setAttribute(key,String(attributes[key]));});return node;}
    function activeIndex(){return indexes.find(function(item){return item.metadata.uid===selectedUid;});}
    function groupKey(item){if(item.metadata.indexGroup)return item.metadata.indexGroup;var label=item.metadata.indexLabel||'';var groupedLabel=label.replace(/\s+·\s+part\s+\d+\s+of\s+\d+$/iu,'');return groupedLabel!==label?groupedLabel:'index:'+item.metadata.uid;}
    function expectedPartCount(item){if(item.metadata.indexPartCount)return item.metadata.indexPartCount;var match=/\s+·\s+part\s+\d+\s+of\s+(\d+)$/iu.exec(item.metadata.indexLabel||'');return match?Number(match[1]):1;}
    function indexGroups(){var groups=new Map();indexes.forEach(function(item){var key=groupKey(item);if(!groups.has(key))groups.set(key,{key:key,label:item.metadata.indexGroup||item.metadata.indexLabel?.replace(/\s+·\s+part\s+\d+\s+of\s+\d+$/iu,'')||item.metadata.workspaceRoot,items:[],expectedParts:1});var group=groups.get(key);group.items.push(item);group.expectedParts=Math.max(group.expectedParts,expectedPartCount(item));});return [...groups.values()].map(function(group){group.items.sort(function(left,right){return (left.metadata.indexPart||0)-(right.metadata.indexPart||0);});group.fileCount=group.items.reduce(function(total,item){return total+item.metadata.fileCount;},0);group.symbolCount=group.items.reduce(function(total,item){return total+item.metadata.symbolCount;},0);group.relationCount=group.items.reduce(function(total,item){return total+item.metadata.relationCount;},0);return group;}).sort(function(left,right){return left.label.localeCompare(right.label);});}
    function scopedIndexes(){if(selectedUid){var selected=activeIndex();return selected?[selected]:[];}if(selectedGroup)return indexes.filter(function(item){return groupKey(item)===selectedGroup;});return indexes;}
    function totals(items){return countKeys.map(function(entry){return {key:entry[0],label:entry[1],value:items.reduce(function(sum,item){return sum+item.metadata[entry[0]];},0)};});}

    function appendGitHubLog(entry){
      var container=element('github-log');var row=document.createElement('div');row.className='github-log-entry';var time=document.createElement('span');time.className='github-log-time';time.textContent=new Date(entry.time).toLocaleTimeString();var stage=document.createElement('span');stage.className='github-log-stage';stage.textContent=entry.stage;var message=document.createElement('span');message.className='github-log-message';message.textContent=entry.message;row.append(time,stage,message);container.appendChild(row);container.scrollTop=container.scrollHeight;
      if(entry.total>0&&entry.current!==undefined){var progress=element('github-progress');progress.hidden=false;progress.value=Math.min(100,entry.current/entry.total*100);}else if(entry.stage==='scan'||entry.stage==='parse'||entry.stage==='extract'){var indeterminate=element('github-progress');indeterminate.hidden=false;indeterminate.removeAttribute('value');}
      element('github-job-state').textContent=entry.message;
    }

    function connectGitHubJob(job){
      if(githubEvents)githubEvents.close();
      githubEvents=new EventSource(job.eventsUrl);
      githubEvents.addEventListener('log',function(event){appendGitHubLog(JSON.parse(event.data));});
      githubEvents.addEventListener('completed',function(event){var result=JSON.parse(event.data);element('github-job-state').textContent='Index complete';element('github-progress').hidden=false;element('github-progress').value=100;var link=element('github-result');link.href='/graph/'+encodeURIComponent(result.uid);link.hidden=false;githubEvents.close();void refreshIndexes();});
      githubEvents.addEventListener('failed',function(event){var failure=JSON.parse(event.data);element('github-job-state').textContent='Index failed: '+failure.message;githubEvents.close();});
      githubEvents.onerror=function(){if(githubEvents.readyState===EventSource.CLOSED&&element('github-job-state').textContent.indexOf('Index ')!==0){element('github-job-state').textContent='Connection to progress stream lost';}};
    }

    async function startGitHubIndex(event){
      event.preventDefault();if(githubEvents)githubEvents.close();element('github-log').replaceChildren();element('github-job').hidden=false;element('github-result').hidden=true;element('github-progress').hidden=true;element('github-job-state').textContent='Starting import…';element('github-submit').disabled=true;
      var patterns=element('github-patterns').value.split(',').map(function(pattern){return pattern.trim();}).filter(Boolean);
      try{
        var response=await fetch('/api/github/index',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:element('github-url').value,ref:element('github-ref').value.trim(),patterns:patterns,maxFileSize:Math.round(Number(element('github-size').value)*1024*1024)})});
        var job=await response.json();if(!response.ok)throw new Error(job.error||'Could not start GitHub indexing');
        connectGitHubJob(job);
      }catch(error){element('github-job-state').textContent='Could not start: '+error.message;element('github-log').textContent=new Date().toLocaleTimeString()+'  '+error.message;}
      finally{element('github-submit').disabled=false;}
    }

    async function refreshIndexes(){
      element('health').textContent='READING INDEX FILES';
      try{
        var response=await fetch('/api/indexes');
        var payload=await response.json();
        indexes=payload.indexes||[];
        if(selectedUid&&!indexes.some(function(item){return item.metadata.uid===selectedUid;}))selectedUid='';
        if(selectedGroup&&!indexes.some(function(item){return groupKey(item)===selectedGroup;}))selectedGroup='';
        renderIndexList();
        renderOverview();
        renderSelectedGraph();
        renderSearch();
        element('health').textContent='LOCAL INDEX VIEWER / READY';
        element('load-errors').replaceChildren();
        (payload.errors||[]).forEach(function(issue){var line=document.createElement('div');line.className='error-line';line.textContent=issue.fileName+': '+issue.message;element('load-errors').appendChild(line);});
      }catch(error){element('health').textContent='INDEX LOAD FAILED';element('load-errors').textContent=String(error);}
    }

    function renderIndexList(){
      var list=element('index-list');list.replaceChildren();
      var groups=indexGroups();
      var allButton=document.createElement('button');allButton.className='index-item'+(!selectedUid&&!selectedGroup?' active':'');allButton.innerHTML='<span class="index-name">All workspaces</span><span class="index-path">'+groups.length+' repositories · '+indexes.length+' index parts</span>';allButton.onclick=function(){selectedUid='';selectedGroup='';renderIndexList();renderOverview();renderSelectedGraph();renderSearch();};list.appendChild(allButton);
      var query=element('index-filter').value.trim().toLowerCase();
      var visibleGroups=groups.filter(function(group){return !query||group.label.toLowerCase().includes(query)||group.items.some(function(item){return item.metadata.workspaceRoot.toLowerCase().includes(query);});});
      visibleGroups.forEach(function(group){
        var grouped=group.items.length>1;var button=document.createElement('button');button.className='index-item'+(grouped?' index-group':'')+(selectedGroup===group.key?' active':'');
        if(grouped){var caret=document.createElement('span');caret.className='group-caret';caret.textContent=expandedGroups.has(group.key)?'▾':'▸';button.appendChild(caret);}
        var text=document.createElement('span');text.style.minWidth='0';var name=document.createElement('span');name.className='index-name';name.textContent=group.label;var sub=document.createElement('span');sub.className='index-path';var partSummary=grouped?(group.items.length<group.expectedParts?group.items.length+' / '+group.expectedParts+' parts indexed':group.items.length+' parts'):numberFormat.format(group.relationCount)+' relations';sub.textContent=numberFormat.format(group.fileCount)+' files · '+numberFormat.format(group.symbolCount)+' symbols · '+partSummary;text.append(name,sub);button.appendChild(text);
        button.onclick=function(){if(grouped){if(expandedGroups.has(group.key))expandedGroups.delete(group.key);else expandedGroups.add(group.key);selectedUid='';selectedGroup=group.key;}else{selectedUid=group.items[0].metadata.uid;selectedGroup='';}renderIndexList();renderOverview();renderSelectedGraph();renderSearch();};list.appendChild(button);
        if(grouped&&expandedGroups.has(group.key)){group.items.forEach(function(item){var part=document.createElement('button');part.className='index-item index-part'+(selectedUid===item.metadata.uid?' active':'');var partName=document.createElement('span');partName.className='index-name';partName.textContent='Part '+(item.metadata.indexPart||group.items.indexOf(item)+1)+' of '+(item.metadata.indexPartCount||group.items.length);var partPath=document.createElement('span');partPath.className='index-path';partPath.textContent=numberFormat.format(item.metadata.fileCount)+' files · '+numberFormat.format(item.metadata.symbolCount)+' symbols';part.append(partName,partPath);part.onclick=function(){selectedUid=item.metadata.uid;selectedGroup='';renderIndexList();renderOverview();renderSelectedGraph();renderSearch();};list.appendChild(part);});}
      });
      if(query&&visibleGroups.length===0){var empty=document.createElement('div');empty.className='index-empty';empty.textContent='No matching workspaces';list.appendChild(empty);}
      element('index-total').textContent=numberFormat.format(groups.length)+' repositories';
    }

    function renderOverview(){
      var selected=activeIndex();var scope=scopedIndexes();var selectedRepo=selectedGroup?indexGroups().find(function(group){return group.key===selectedGroup;}):undefined;var values=totals(scope);
      var metrics=element('metrics');metrics.replaceChildren();values.forEach(function(item){var box=document.createElement('div');box.className='metric';var value=document.createElement('div');value.className='metric-value';value.textContent=numberFormat.format(item.value);var label=document.createElement('div');label.className='metric-label';label.textContent=item.label;box.append(value,label);metrics.appendChild(box);});
      element('title').textContent=selected?(selected.metadata.indexLabel||selected.metadata.workspaceRoot.split('/').filter(Boolean).pop()||selected.metadata.workspaceRoot):selectedRepo?selectedRepo.label:'All workspaces';
      element('workspace-path').textContent=selected?selected.metadata.workspaceRoot:selectedRepo?numberFormat.format(selectedRepo.items.length)+' index parts · aggregate totals':'Search across every discovered index';
      element('updated').textContent=selected?'UPDATED '+new Date(selected.metadata.updatedAt).toLocaleString():selectedRepo?selectedRepo.items.length+' PARTS':indexes.length+' INDEX PARTS';
      element('composition-label').textContent=selected?'SELECTED INDEX':selectedRepo?'REPOSITORY TOTAL':'ALL INDEXES';
      var maximum=Math.max(1,...values.map(function(item){return item.value;}));var bars=element('bars');bars.replaceChildren();values.forEach(function(item){var row=document.createElement('div');row.className='bar-row';var label=document.createElement('span');label.className='bar-label';label.textContent=item.label;var track=document.createElement('div');track.className='bar-track';var fill=document.createElement('div');fill.className='bar-fill';fill.style.width=(item.value/maximum*100)+'%';track.appendChild(fill);var value=document.createElement('span');value.className='bar-value';value.textContent=numberFormat.format(item.value);row.append(label,track,value);bars.appendChild(row);});
      renderRelationBreakdown(scope);
    }

    function renderRelationBreakdown(scope){
      var counts={};scope.forEach(function(item){Object.keys(item.relationKinds||{}).forEach(function(kind){counts[kind]=(counts[kind]||0)+item.relationKinds[kind];});});
      var entries=Object.keys(counts).map(function(kind){return {kind:kind,count:counts[kind]};}).sort(function(left,right){return right.count-left.count;});
      var maximum=Math.max(1,...entries.map(function(entry){return entry.count;}));var container=element('relation-bars');container.replaceChildren();
      element('relation-scope').textContent=activeIndex()?'Selected index':selectedGroup?'Repository total':'All indexes';
      if(entries.length===0){var empty=document.createElement('div');empty.className='status';empty.textContent='No relation data in this scope.';container.appendChild(empty);return;}
      entries.forEach(function(entry){var row=document.createElement('div');row.className='relation-row';var name=document.createElement('span');name.className='relation-name';name.textContent=entry.kind;var track=document.createElement('div');track.className='relation-track';var fill=document.createElement('div');fill.className='relation-fill';fill.style.setProperty('--relation-color',relationColors[entry.kind]||'#176b58');fill.style.width=(entry.count/maximum*100)+'%';track.appendChild(fill);var count=document.createElement('span');count.className='relation-value';count.textContent=numberFormat.format(entry.count);row.append(name,track,count);container.appendChild(row);});
    }

    async function renderSelectedGraph(){
      var graph=element('graph');graph.replaceChildren();var selected=activeIndex();
      var graphOpen=element('graph-open');graphOpen.hidden=!selected;if(selected)graphOpen.href='/graph/'+encodeURIComponent(selected.metadata.uid);
      if(!selected){element('graph-empty').style.display='grid';element('graph-empty').textContent=selectedGroup?'Select an index part to explore its symbol graph.':'Select a workspace to inspect its resolved symbol relations.';element('relation-count').textContent='0 EDGES';return;}
      try{
        var response=await fetch('/api/indexes/'+encodeURIComponent(selected.metadata.uid));var payload=await response.json();var nodes=payload.graph.nodes||[];var edges=payload.graph.edges||[];
        element('relation-count').textContent=numberFormat.format(edges.length)+' EDGES';
        if(nodes.length===0||edges.length===0){element('graph-empty').style.display='grid';element('graph-empty').textContent='No resolved symbol-to-symbol relations in this index.';return;}
        element('graph-empty').style.display='none';var width=620,height=280,cx=width/2,cy=height/2,radius=Math.min(width,height)*.37;var positions=new Map();
        nodes.forEach(function(node,index){var angle=(Math.PI*2*index/nodes.length)-Math.PI/2;positions.set(node.id,{x:cx+Math.cos(angle)*radius,y:cy+Math.sin(angle)*radius});});
        edges.forEach(function(edge){var from=positions.get(edge.source),to=positions.get(edge.target);if(!from||!to)return;graph.appendChild(makeSvg('line',{x1:from.x,y1:from.y,x2:to.x,y2:to.y,class:'graph-edge'}));});
        nodes.forEach(function(node){var point=positions.get(node.id);var group=makeSvg('g',{});var circle=makeSvg('circle',{cx:point.x,cy:point.y,r:5,class:'graph-node'});var label=makeSvg('text',{x:point.x+8,y:point.y-7,class:'graph-label'});label.textContent=node.name.length>18?node.name.slice(0,17)+'…':node.name;var title=makeSvg('title',{});title.textContent=node.kind+' · '+node.filePath;group.append(circle,label,title);graph.appendChild(group);});
        element('graph-note').textContent=(payload.graph.truncated?'Overview shows the 80 most connected symbols. ':'')+'Open the full graph to explore every symbol and resolved edge.';
      }catch(error){element('graph-empty').style.display='grid';element('graph-empty').textContent='Could not load graph: '+String(error);}
    }

    async function renderSearch(){
      var query=element('query').value.trim();var container=element('results');
      if(query.length<2){element('result-count').textContent='Type at least 2 characters';container.innerHTML='<div class="status">Search is performed locally against the saved index data.</div>';return;}
      if(searchController)searchController.abort();searchController=new AbortController();container.innerHTML='<div class="status"><span class="spinner"></span>Searching indexes…</div>';
      var url='/api/search?q='+encodeURIComponent(query)+'&limit=50'+(selectedUid?'&index='+encodeURIComponent(selectedUid):selectedGroup?'&group='+encodeURIComponent(selectedGroup):'');
      try{var response=await fetch(url,{signal:searchController.signal});var payload=await response.json();var results=payload.results||[];element('result-count').textContent=numberFormat.format(results.length)+' MATCHES';container.replaceChildren();if(results.length===0){container.innerHTML='<div class="status">No matching indexed files.</div>';return;}results.forEach(function(result){var row=document.createElement('article');row.className='result-row';var location=document.createElement('div');location.className='result-location';var file=document.createElement('span');file.textContent=result.path;var workspace=document.createElement('small');workspace.textContent=result.workspace+' · '+result.language;location.append(file,workspace);var excerpt=document.createElement('div');excerpt.className='result-excerpt';excerpt.textContent=result.excerpt||result.language;var score=document.createElement('div');score.className='result-score';score.textContent=result.score.toFixed(1);var graphLink=document.createElement('a');graphLink.className='result-graph';graphLink.href='/graph/'+encodeURIComponent(result.uid);graphLink.target='_blank';graphLink.rel='noopener';graphLink.textContent='Open graph ↗';row.append(location,excerpt,score,graphLink);container.appendChild(row);});}catch(error){if(error.name!=='AbortError'){element('result-count').textContent='SEARCH FAILED';container.textContent=String(error);}}
    }

    element('query').addEventListener('input',function(){clearTimeout(searchTimer);searchTimer=setTimeout(renderSearch,180);});
    element('index-filter').addEventListener('input',renderIndexList);
    element('github-form').addEventListener('submit',startGitHubIndex);
    element('refresh').addEventListener('click',refreshIndexes);
    refreshIndexes();
  </script>
</body>
</html>`;