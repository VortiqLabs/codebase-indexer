import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  select,
  zoom,
  zoomIdentity
} from 'd3';

const uid = document.body.dataset.indexUid;
const canvas = document.getElementById('network');
const context = canvas.getContext('2d');
const relationColors = {
  calls: '#61d6ad',
  imports: '#70b7e3',
  references: '#f4c95d',
  contains: '#9aa99f',
  extends: '#ff8868',
  implements: '#bd98f2',
  exports: '#ee8dbe'
};
const symbolColors = {
  class: '#d4f46c',
  function: '#ff8868',
  method: '#61d6ad',
  variable: '#f4c95d',
  constant: '#f2a65a',
  interface: '#70b7e3',
  type: '#bd98f2',
  module: '#ee8dbe',
  namespace: '#6ec6d3',
  property: '#a6d17a',
  constructor: '#f28fba'
};
const nodes = [];
let links = [];
const visibleKinds = new Set(['calls', 'imports', 'extends', 'implements']);
const neighbors = new Map();
const symbolPaths = {
  class: 'M12 2 21 7v10l-9 5-9-5V7z',
  function: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  method: 'M5 5h14v14H5z',
  variable: 'M12 3 21 20H3z',
  constant: 'M12 3 21 12 12 21 3 12z',
  interface: 'M12 2 22 12 12 22 2 12z',
  type: 'M4 6h16v12H4z M8 10h8',
  module: 'M4 5h16v15H4z M4 9h16',
  namespace: 'M4 4h16v16H4z M8 8h8v8H8z',
  property: 'M5 5h14v14H5z M8 12h8',
  constructor: 'M12 3v18M4 11h16M6 6l12 12'
};
let simulation;
let monacoEditor;
let monacoModel;
let monacoPromise;
let sourceRequest = 0;
let transform = zoomIdentity;
let activeNode;
let hoveredNode;
let filter = '';
let paused = false;
let pixelRatio = window.devicePixelRatio || 1;
let canvasWidth = 1;
let canvasHeight = 1;

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function symbolColor(kind) {
  return symbolColors[kind] || '#c1ccc4';
}

function createSymbolIcon(kind) {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', symbolPaths[kind] || symbolPaths.function);
  icon.appendChild(path);
  return icon;
}

function drawSymbol(node, radius) {
  context.beginPath();
  const x = node.x;
  const y = node.y;
  if (node.kind === 'class' || node.kind === 'type') {
    for (let index = 0; index < 6; index++) {
      const angle = Math.PI / 3 * index - Math.PI / 6;
      const pointX = x + Math.cos(angle) * radius;
      const pointY = y + Math.sin(angle) * radius;
      if (index === 0) context.moveTo(pointX, pointY);
      else context.lineTo(pointX, pointY);
    }
    context.closePath();
  } else if (node.kind === 'interface' || node.kind === 'constant') {
    context.moveTo(x, y - radius);
    context.lineTo(x + radius, y);
    context.lineTo(x, y + radius);
    context.lineTo(x - radius, y);
    context.closePath();
  } else if (node.kind === 'variable') {
    context.moveTo(x, y - radius);
    context.lineTo(x + radius, y + radius);
    context.lineTo(x - radius, y + radius);
    context.closePath();
  } else if (node.kind === 'method' || node.kind === 'property' || node.kind === 'module') {
    context.rect(x - radius * 0.75, y - radius * 0.75, radius * 1.5, radius * 1.5);
  } else {
    context.arc(x, y, radius, 0, Math.PI * 2);
  }
  context.fillStyle = symbolColor(node.kind);
  context.fill();
  if (node.kind === 'type' || node.kind === 'module' || node.kind === 'property') {
    context.strokeStyle = '#14201a';
    context.lineWidth = 1;
    context.stroke();
  }
}

function getVisibleLabels() {
  const labels = new Set([activeNode, hoveredNode].filter(Boolean));
  if (filter) {
    nodes.filter((node) => node.name.toLowerCase().includes(filter) || node.filePath.toLowerCase().includes(filter))
      .slice(0, 60).forEach((node) => labels.add(node));
  }
  if (transform.k < 0.75) return labels;
  const cellWidth = Math.max(48, 150 / transform.k);
  const cellHeight = Math.max(18, 38 / transform.k);
  const occupied = new Set();
  for (const node of nodes) {
    if (labels.has(node)) continue;
    const [screenX, screenY] = transform.apply([node.x, node.y]);
    if (screenX < 0 || screenX > canvasWidth || screenY < 50 || screenY > canvasHeight - 36) continue;
    const cell = Math.floor(screenX / cellWidth) + ':' + Math.floor(screenY / cellHeight);
    if (!occupied.has(cell)) {
      occupied.add(cell);
      labels.add(node);
    }
  }
  return labels;
}

function findNodeAt(screenX, screenY) {
  const point = transform.invert([screenX, screenY]);
  let closest;
  let closestDistance = 20 / transform.k;
  for (const node of nodes) {
    const distance = Math.hypot(node.x - point[0], node.y - point[1]);
    if (distance < closestDistance) {
      closest = node;
      closestDistance = distance;
    }
  }
  return closest;
}

function updateStatus() {
  const visibleEdges = links.filter((link) => visibleKinds.has(link.kind)).length;
  setText('status', nodes.length.toLocaleString() + ' symbols · ' + visibleEdges.toLocaleString() + ' of ' + links.length.toLocaleString() + ' resolved connections shown');
}

function isRelatedToHover(node) {
  if (!hoveredNode) return true;
  return node === hoveredNode || (neighbors.get(hoveredNode.id) || new Set()).has(node.id);
}

function rebuildNeighbors() {
  neighbors.clear();
  nodes.forEach((node) => neighbors.set(node.id, new Set()));
  links.forEach((link) => {
    if (!visibleKinds.has(link.kind)) return;
    const source = typeof link.source === 'string' ? link.source : link.source.id;
    const target = typeof link.target === 'string' ? link.target : link.target.id;
    neighbors.get(source)?.add(target);
    neighbors.get(target)?.add(source);
  });
}

function draw() {
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.save();
  context.translate(transform.x, transform.y);
  context.scale(transform.k, transform.k);
  const labels = getVisibleLabels();

  for (const link of links) {
    if (!visibleKinds.has(link.kind)) continue;
    if (!link.source || !link.target || typeof link.source === 'string' || typeof link.target === 'string') continue;
    const source = link.source;
    const target = link.target;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const radius = 7;
    const endX = target.x - dx / distance * radius;
    const endY = target.y - dy / distance * radius;
    let hash = 0;
    for (const character of link.id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
    const bend = ((Math.abs(hash) % 11) - 5) * 2.2;
    const normalX = -dy / distance;
    const normalY = dx / distance;
    const control1X = source.x + dx * 0.32 + normalX * bend;
    const control1Y = source.y + dy * 0.32 + normalY * bend;
    const control2X = target.x - dx * 0.32 + normalX * bend;
    const control2Y = target.y - dy * 0.32 + normalY * bend;
    const color = relationColors[link.kind] || '#9aa99f';
    const matchesSearch = !filter || link.source.name.toLowerCase().includes(filter) || link.target.name.toLowerCase().includes(filter);
    const touchesHover = hoveredNode && (source === hoveredNode || target === hoveredNode);
    context.globalAlpha = hoveredNode ? (touchesHover ? 0.92 : 0.035) : (filter && !matchesSearch ? 0.06 : 0.64);
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = link.kind === 'calls' ? 1.5 : 1;
    context.lineCap = 'round';
    context.setLineDash(link.kind === 'references' ? [2, 4] : link.kind === 'imports' ? [7, 4] : []);
    context.beginPath();
    context.moveTo(source.x, source.y);
    context.bezierCurveTo(control1X, control1Y, control2X, control2Y, endX, endY);
    context.stroke();
    context.setLineDash([]);
    const angle = Math.atan2(endY - control2Y, endX - control2X);
    context.beginPath();
    context.moveTo(endX, endY);
    context.lineTo(endX - 5 * Math.cos(angle - Math.PI / 6), endY - 5 * Math.sin(angle - Math.PI / 6));
    context.lineTo(endX - 5 * Math.cos(angle + Math.PI / 6), endY - 5 * Math.sin(angle + Math.PI / 6));
    context.closePath();
    context.fill();
  }

  for (const node of nodes) {
    const matched = !filter || node.name.toLowerCase().includes(filter) || node.filePath.toLowerCase().includes(filter);
    const selected = activeNode === node;
    const hovered = hoveredNode === node;
    const related = isRelatedToHover(node);
    const radius = selected || hovered ? 9 : 6;
    context.globalAlpha = hoveredNode && !related ? 0.12 : (filter && !matched ? 0.16 : 1);
    drawSymbol(node, radius);
    if (selected || hovered || matched && filter) {
      context.strokeStyle = selected ? '#ffffff' : '#d4f46c';
      context.lineWidth = 1.5;
      context.stroke();
    }
    if (labels.has(node)) {
      context.font = (selected || hovered ? '600 11px' : '10px') + ' "IBM Plex Mono", monospace';
      context.fillStyle = '#e7eee8';
      const label = node.name.length > 30 ? node.name.slice(0, 29) + '…' : node.name;
      context.lineWidth = 3;
      context.strokeStyle = '#111917';
      context.strokeText(label, node.x + radius + 4, node.y + 3);
      context.fillText(label, node.x + radius + 4, node.y + 3);
    }
  }
  context.globalAlpha = 1;
  context.restore();
}

function resize() {
  const bounds = canvas.getBoundingClientRect();
  canvasWidth = bounds.width;
  canvasHeight = bounds.height;
  pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvasWidth * pixelRatio);
  canvas.height = Math.round(canvasHeight * pixelRatio);
  if (simulation) simulation.force('center', forceCenter(canvasWidth / 2, canvasHeight / 2)).alpha(0.2).restart();
  draw();
}

function showNode(node) {
  activeNode = node;
  setText('selected-name', node.name);
  setText('selected-path', node.filePath);
  const kind = document.getElementById('selected-kind');
  kind.className = 'selected-kind';
  kind.style.backgroundColor = symbolColor(node.kind);
  kind.replaceChildren(createSymbolIcon(node.kind), document.createTextNode(node.kind));
  void openSource(node);
  draw();
}

function loadMonaco() {
  if (monacoPromise) return monacoPromise;
  monacoPromise = new Promise((resolve, reject) => {
    window.require(['vs/editor/editor.main'], () => resolve(window.monaco), reject);
  });
  return monacoPromise;
}

function monacoLanguage(language) {
  const aliases = { objectivec: 'objective-c', csharp: 'csharp', cpp: 'cpp', bash: 'shell', elisp: 'lisp', rescript: 'javascript' };
  const available = new Set(['abap','apex','azcli','bat','bicep','cameligo','clojure','coffeescript','c','cpp','csharp','csp','css','cypher','dart','dockerfile','ecl','elixir','flow9','fsharp','go','graphql','handlebars','hcl','html','ini','java','javascript','julia','kotlin','less','lexon','lua','m3','markdown','mdx','mips','msdax','mysql','objective-c','pascal','pascaligo','perl','pgsql','php','plaintext','postiats','powerquery','powershell','protobuf','pug','python','qsharp','r','razor','redis','redshift','restructuredtext','ruby','rust','sb','scala','scheme','scss','shell','sol','sql','st','swift','systemverilog','tcl','twig','typescript','typespec','vb','verilog','wgsl','xml','yaml']);
  const candidate = aliases[language] || language;
  return available.has(candidate) ? candidate : 'plaintext';
}

async function openSource(node) {
  const requestId = ++sourceRequest;
  const dock = document.getElementById('source-dock');
  const editorHost = document.getElementById('source-editor');
  const sourceFile = document.getElementById('source-file');
  const sourceSymbol = document.getElementById('source-symbol');
  const sourceTitle = node.filePath + ':' + node.startLine;
  dock.classList.add('open');
  dock.setAttribute('aria-hidden', 'false');
  document.body.classList.add('source-open');
  sourceFile.textContent = sourceTitle;
  sourceSymbol.textContent = node.kind + ' · ' + node.name;
  if (!monacoEditor) editorHost.innerHTML = '<div class="source-loading">Loading source…</div>';

  try {
    const response = await fetch('/api/indexes/' + encodeURIComponent(uid) + '/source?path=' + encodeURIComponent(node.filePath));
    const payload = await response.json();
    if (requestId !== sourceRequest) return;
    if (!response.ok) throw new Error(payload.error || 'Source file could not be loaded');
    const monaco = await loadMonaco();
    if (requestId !== sourceRequest) return;
    if (!monacoEditor) {
      editorHost.replaceChildren();
      monacoEditor = monaco.editor.create(editorHost, {
        value: '',
        language: 'plaintext',
        theme: 'vs-dark',
        readOnly: true,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderLineHighlight: 'all',
        lineNumbersMinChars: 4,
        padding: { top: 10, bottom: 10 },
        fontSize: 13,
        fontFamily: '"IBM Plex Mono", Consolas, monospace'
      });
    }
    if (monacoModel) monacoModel.dispose();
    monacoModel = monaco.editor.createModel(payload.content, monacoLanguage(payload.language));
    monacoEditor.setModel(monacoModel);
    const startLineNumber = Math.max(1, node.startLine || 1);
    const endLineNumber = Math.max(startLineNumber, node.endLine || startLineNumber);
    const range = {
      startLineNumber,
      startColumn: Math.max(1, (node.startColumn || 0) + 1),
      endLineNumber,
      endColumn: Math.max(1, (node.endColumn || 0) + 1)
    };
    monacoEditor.setSelection(range);
    monacoEditor.revealRangeInCenter(range, monaco.editor.ScrollType.Smooth);
    monacoEditor.focus();
  } catch (error) {
    if (requestId !== sourceRequest) return;
    editorHost.innerHTML = '';
    const message = document.createElement('div');
    message.className = 'source-loading error';
    message.textContent = error instanceof Error ? error.message : String(error);
    editorHost.appendChild(message);
  }
}

function closeSource() {
  sourceRequest++;
  document.getElementById('source-dock').classList.remove('open');
  document.getElementById('source-dock').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('source-open');
  if (monacoEditor) monacoEditor.blur();
}

function fitGraph() {
  if (!nodes.length) return;
  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y));
  const padding = 90;
  const scale = Math.min(canvasWidth / (maxX - minX + padding * 2), canvasHeight / (maxY - minY + padding * 2), 1.5);
  const x = canvasWidth / 2 - (minX + maxX) / 2 * scale;
  const y = canvasHeight / 2 - (minY + maxY) / 2 * scale;
  select(canvas).transition().duration(500).call(zoomBehavior.transform, zoomIdentity.translate(x, y).scale(scale));
}

function renderLegend() {
  const legend = document.getElementById('relation-filters');
  Object.entries(relationColors).forEach(([kind, color]) => {
    const count = links.filter((link) => link.kind === kind).length;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'legend-item';
    item.classList.toggle('active', visibleKinds.has(kind));
    item.setAttribute('aria-pressed', String(visibleKinds.has(kind)));
    const swatch = document.createElement('i');
    swatch.className = 'edge-swatch';
    swatch.style.backgroundColor = color;
    const label = document.createElement('span');
    label.textContent = kind;
    const countLabel = document.createElement('span');
    countLabel.className = 'legend-count';
    countLabel.textContent = count.toLocaleString();
    item.append(swatch, label, countLabel);
    item.addEventListener('click', () => {
      if (visibleKinds.has(kind)) visibleKinds.delete(kind);
      else visibleKinds.add(kind);
      rebuildNeighbors();
      item.classList.toggle('active', visibleKinds.has(kind));
      item.setAttribute('aria-pressed', String(visibleKinds.has(kind)));
      updateStatus();
      draw();
    });
    legend.appendChild(item);
  });
}

function renderSymbolGuide() {
  const guide = document.getElementById('symbol-guide');
  const kinds = [...new Set(nodes.map((node) => node.kind))].sort();
  kinds.forEach((kind) => {
    const item = document.createElement('span');
    item.className = 'symbol-kind';
    item.style.color = symbolColor(kind);
    const icon = createSymbolIcon(kind);
    const label = document.createElement('span');
    label.textContent = kind;
    item.append(icon, label);
    guide.appendChild(item);
  });
}

const zoomBehavior = zoom()
  .scaleExtent([0.08, 8])
  .on('zoom', (event) => {
    transform = event.transform;
    draw();
  });

select(canvas).call(zoomBehavior).on('dblclick.zoom', null);
canvas.addEventListener('pointermove', (event) => {
  const bounds = canvas.getBoundingClientRect();
  const node = findNodeAt(event.clientX - bounds.left, event.clientY - bounds.top);
  if (node !== hoveredNode) {
    hoveredNode = node;
    draw();
  }
  canvas.style.cursor = node ? 'pointer' : 'grab';
});
canvas.addEventListener('pointerleave', () => {
  hoveredNode = undefined;
  draw();
});
canvas.addEventListener('click', (event) => {
  const bounds = canvas.getBoundingClientRect();
  const node = findNodeAt(event.clientX - bounds.left, event.clientY - bounds.top);
  if (node) showNode(node);
});
document.getElementById('find').addEventListener('input', (event) => {
  filter = event.target.value.trim().toLowerCase();
  draw();
});
document.getElementById('zoom-in').addEventListener('click', () => select(canvas).transition().call(zoomBehavior.scaleBy, 1.35));
document.getElementById('zoom-out').addEventListener('click', () => select(canvas).transition().call(zoomBehavior.scaleBy, 0.74));
document.getElementById('fit').addEventListener('click', fitGraph);
document.getElementById('pause').addEventListener('click', (event) => {
  if (!simulation) return;
  paused = !paused;
  if (paused) simulation.stop();
  else simulation.alpha(0.3).restart();
  const button = event.currentTarget;
  button.title = paused ? 'Resume layout animation' : 'Pause layout animation';
  button.setAttribute('aria-label', paused ? 'Resume animation' : 'Pause animation');
  document.getElementById('pause-icon').innerHTML = paused
    ? '<path d="m8 5 11 7-11 7z"></path>'
    : '<path d="M8 5v14M16 5v14"></path>';
});
document.getElementById('source-close').addEventListener('click', closeSource);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSource();
});
document.getElementById('show-all').addEventListener('click', () => {
  Object.keys(relationColors).forEach((kind) => visibleKinds.add(kind));
  rebuildNeighbors();
  document.querySelectorAll('.legend-item').forEach((item) => {
    item.classList.add('active');
    item.setAttribute('aria-pressed', 'true');
  });
  updateStatus();
  draw();
});
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(document.getElementById('stage'));

renderLegend();
resize();
fetch('/api/indexes/' + encodeURIComponent(uid) + '?all=true')
  .then((response) => {
    if (!response.ok) throw new Error('Index not found');
    return response.json();
  })
  .then((payload) => {
    const graph = payload.graph;
    nodes.push(...graph.nodes);
    links = graph.edges;
    rebuildNeighbors();
    setText('workspace-name', payload.metadata.workspaceRoot.split('/').filter(Boolean).pop() || payload.metadata.workspaceRoot);
    setText('workspace-path', payload.metadata.workspaceRoot);
    setText('node-count', nodes.length.toLocaleString());
    setText('edge-count', links.length.toLocaleString());
    simulation = forceSimulation(nodes)
      .force('link', forceLink(links).id((node) => node.id).distance(82).strength(0.42))
        .force('charge', forceManyBody().strength(-230).distanceMax(780))
      .force('center', forceCenter(canvasWidth / 2, canvasHeight / 2))
        .force('collision', forceCollide(23).strength(0.9))
      .alphaDecay(0.025)
      .on('tick', draw);
    renderLegend();
      renderSymbolGuide();
    updateStatus();
    document.getElementById('loading').classList.add('hidden');
    setTimeout(fitGraph, 450);
  })
  .catch((error) => {
    const loading = document.getElementById('loading');
    loading.classList.remove('hidden');
    loading.innerHTML = '';
    loading.classList.add('error');
    loading.textContent = 'Could not load graph: ' + error.message;
  });