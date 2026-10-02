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

let currentMode = 'dot';
let nodes = [];
let links = [];
let matrixData = null;
let radialData = null;
let flowData = null;
let highlightedPath = new Set();
let simulation = null;
let transform = zoomIdentity;
let activeNode = null;
let hoveredNode = null;
let pixelRatio = window.devicePixelRatio || 1;
let canvasWidth = 1;
let canvasHeight = 1;

function isLightTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

function themeText() {
  return isLightTheme() ? '#111111' : '#ffffff';
}

function themeBg() {
  return isLightTheme() ? '#ffffff' : '#080808';
}

function draw() {
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.save();
  context.translate(transform.x, transform.y);
  context.scale(transform.k, transform.k);

  if (currentMode === 'matrix' && matrixData) {
    drawMatrixView();
  } else {
    drawNetworkGraph();
  }

  context.restore();
}

function drawNetworkGraph() {
  for (const link of links) {
    if (!link.source || !link.target || typeof link.source === 'string' || typeof link.target === 'string') continue;
    const color = relationColors[link.kind] || '#8a8a8a';
    const isHighlighted = highlightedPath.has(link.source.name) && highlightedPath.has(link.target.name);
    context.globalAlpha = isHighlighted ? 1.0 : 0.6;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = isHighlighted ? 2.5 : 1;
    context.setLineDash([4, 4]);

    const dx = link.target.x - link.source.x;
    const dy = link.target.y - link.source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const endX = link.target.x - (dx / distance) * 8;
    const endY = link.target.y - (dy / distance) * 8;

    context.beginPath();
    context.moveTo(link.source.x, link.source.y);
    context.lineTo(endX, endY);
    context.stroke();
    context.setLineDash([]);

    // Arrowhead
    const angle = Math.atan2(endY - link.source.y, endX - link.source.x);
    context.beginPath();
    context.moveTo(endX, endY);
    context.lineTo(endX - 6 * Math.cos(angle - Math.PI / 6), endY - 6 * Math.sin(angle - Math.PI / 6));
    context.lineTo(endX - 6 * Math.cos(angle + Math.PI / 6), endY - 6 * Math.sin(angle + Math.PI / 6));
    context.closePath();
    context.fill();
  }

  for (const node of nodes) {
    const isSelected = activeNode === node;
    const isHighlighted = highlightedPath.has(node.name);
    const radius = isSelected ? 9 : 6;
    context.globalAlpha = 1.0;

    context.beginPath();
    context.arc(node.x, node.y, radius, 0, Math.PI * 2);
    context.fillStyle = symbolColors[node.kind] || '#8a8a8a';
    context.fill();
    context.strokeStyle = isSelected || isHighlighted ? '#ffffff' : '#242424';
    context.lineWidth = isSelected || isHighlighted ? 2 : 1;
    context.stroke();

    context.font = (isSelected ? '600 11px' : '10px') + ' "JetBrains Mono", monospace';
    context.fillStyle = themeText();
    context.fillText(node.name, node.x + radius + 4, node.y + 3);
  }
}

function drawMatrixView() {
  if (!matrixData || !matrixData.nodes.length) return;
  const size = matrixData.nodes.length;
  const cellSize = Math.min(24, Math.floor(canvasWidth / (size + 3)));

  for (let i = 0; i < size; i++) {
    const node = matrixData.nodes[i];
    context.fillStyle = themeText();
    context.font = '10px "JetBrains Mono", monospace';
    context.fillText(node.name.slice(0, 10), 10, (i + 2) * cellSize);

    for (let j = 0; j < size; j++) {
      const val = matrixData.matrix[i][j];
      const x = (j + 2) * cellSize;
      const y = (i + 1) * cellSize;

      context.strokeStyle = '#242424';
      context.strokeRect(x, y, cellSize, cellSize);

      if (val > 0) {
        context.fillStyle = '#61d6ad';
        context.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
      }
    }
  }
}

function resize() {
  const bounds = canvas.getBoundingClientRect();
  canvasWidth = bounds.width;
  canvasHeight = bounds.height;
  pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvasWidth * pixelRatio);
  canvas.height = Math.round(canvasHeight * pixelRatio);
  draw();
}

function switchMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-mode') === mode);
  });

  if (mode === 'matrix') {
    fetch('/api/indexes/' + encodeURIComponent(uid) + '/graph/matrix')
      .then(r => r.json())
      .then(data => {
        matrixData = data;
        draw();
      });
  } else if (mode === 'radial') {
    fetch('/api/indexes/' + encodeURIComponent(uid) + '/graph/radial')
      .then(r => r.json())
      .then(data => {
        radialData = data;
        applyRadialLayout(data);
        draw();
      });
  } else if (mode === 'flow') {
    fetch('/api/indexes/' + encodeURIComponent(uid) + '/graph/flow')
      .then(r => r.json())
      .then(data => {
        flowData = data;
        applyFlowLayout(data);
        draw();
      });
  } else if (mode === 'hierarchical') {
    applyHierarchicalLayout();
    draw();
  } else {
    restartSimulation();
  }
}

function applyRadialLayout(data) {
  if (!data || !data.nodes.length) return;
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const radius = 180;

  data.nodes.forEach((n, idx) => {
    if (idx === 0) {
      n.x = cx;
      n.y = cy;
    } else {
      const angle = (Math.PI * 2 * idx) / (data.nodes.length - 1);
      n.x = cx + Math.cos(angle) * radius;
      n.y = cy + Math.sin(angle) * radius;
    }
  });
  nodes = data.nodes;
  links = data.edges.map(e => ({ source: nodes.find(n => n.id === e.source), target: nodes.find(n => n.id === e.target), kind: e.kind }));
}

function applyFlowLayout(data) {
  if (!data || !data.nodes.length) return;
  const levelX = { 1: 100, 2: 350, 3: 600 };
  const counts = { 1: 0, 2: 0, 3: 0 };

  data.nodes.forEach((n) => {
    const lvl = n.level || 1;
    counts[lvl] = (counts[lvl] || 0) + 1;
    n.x = levelX[lvl] || 200;
    n.y = counts[lvl] * 35 + 80;
  });
  nodes = data.nodes;
  links = data.edges.map(e => ({ source: nodes.find(n => n.id === e.source), target: nodes.find(n => n.id === e.target), kind: e.kind }));
}

function applyHierarchicalLayout() {
  nodes.forEach((n, idx) => {
    const depth = (n.filePath.split('/').length - 1);
    n.x = depth * 140 + 80;
    n.y = (idx % 15) * 35 + 60;
  });
}

function restartSimulation() {
  if (simulation) simulation.stop();
  simulation = forceSimulation(nodes)
    .force('link', forceLink(links).id((n) => n.id).distance(80))
    .force('charge', forceManyBody().strength(-200))
    .force('center', forceCenter(canvasWidth / 2, canvasHeight / 2))
    .force('collide', forceCollide(18))
    .on('tick', draw);
}

const zoomBehavior = zoom()
  .scaleExtent([0.1, 6])
  .on('zoom', (e) => {
    transform = e.transform;
    draw();
  });

select(canvas).call(zoomBehavior);

document.querySelectorAll('.mode-btn').forEach(b => {
  b.addEventListener('click', () => switchMode(b.getAttribute('data-mode')));
});

document.getElementById('btn-theme')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('codebase_theme', next);
  draw();
});

document.getElementById('btn-fit')?.addEventListener('click', () => {
  select(canvas).transition().call(zoomBehavior.transform, zoomIdentity);
});

document.getElementById('btn-find-path')?.addEventListener('click', () => {
  const from = document.getElementById('path-from').value.trim();
  const to = document.getElementById('path-to').value.trim();
  if (!from || !to) return;

  fetch('/api/indexes/' + encodeURIComponent(uid) + '/graph/path?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to))
    .then(r => r.json())
    .then(data => {
      highlightedPath = new Set(data.nodes || []);
      document.getElementById('path-result').textContent = 'Path length: ' + data.depth + ' hops (' + (data.nodes || []).join(' → ') + ')';
      draw();
    });
});

document.getElementById('btn-cycles')?.addEventListener('click', () => {
  fetch('/api/indexes/' + encodeURIComponent(uid) + '/graph/cycles')
    .then(r => r.json())
    .then(data => {
      const cycles = data.cycles || [];
      if (cycles.length > 0) {
        highlightedPath = new Set(cycles[0].symbols);
        document.getElementById('status-text').textContent = 'Found ' + cycles.length + ' cycle(s)! Highlighting: ' + cycles[0].symbols.join(' → ');
      } else {
        document.getElementById('status-text').textContent = 'No dependency cycles detected.';
      }
      draw();
    });
});

window.addEventListener('resize', resize);
resize();

fetch('/api/indexes/' + encodeURIComponent(uid) + '?all=true')
  .then((r) => r.json())
  .then((payload) => {
    nodes = payload.graph.nodes || [];
    links = payload.graph.edges || [];
    document.getElementById('workspace-name').textContent = payload.metadata.workspaceRoot.split('/').pop() || 'Workspace';
    document.getElementById('workspace-path').textContent = payload.metadata.workspaceRoot;
    document.getElementById('status-text').textContent = nodes.length + ' nodes · ' + links.length + ' edges loaded';
    restartSimulation();
  });
