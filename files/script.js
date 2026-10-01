'use strict';

/* ==========================================================================
   Configuration & state
   ========================================================================== */

const ROWS = 20;
const COLS = 20;

const WEIGHTS = {
  empty: 1, start: 1, target: 1,
  mud: 3,
  mountain: 5,
  wall: Infinity
};

const state = {
  grid: [],            // grid[r][c] = { r, c, type, el }
  start: { r: 9, c: 2 },
  target: { r: 9, c: 17 },
  tool: 'wall',
  algo: 'astar',
  painting: false,
  animating: false
};

/* ==========================================================================
   DOM references
   ========================================================================== */

const gridEl = document.getElementById('grid');
const speedSlider = document.getElementById('speed-slider');
const stageHint = document.getElementById('stage-hint');

const mVisited = document.getElementById('m-visited');
const mLength = document.getElementById('m-length');
const mCost = document.getElementById('m-cost');
const mTime = document.getElementById('m-time');
const mStatus = document.getElementById('m-status');

/* ==========================================================================
   Grid construction
   ========================================================================== */

function buildGrid() {
  gridEl.innerHTML = '';
  state.grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const el = document.createElement('div');
      el.className = 'cell cell-empty';
      el.dataset.r = r;
      el.dataset.c = c;
      gridEl.appendChild(el);
      row.push({ r, c, type: 'empty', el });
    }
    state.grid.push(row);
  }
  state.grid[state.start.r][state.start.c].type = 'start';
  state.grid[state.target.r][state.target.c].type = 'target';
  redrawAll();
}

function redrawAll() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      paintCellDOM(state.grid[r][c]);
    }
  }
}

function paintCellDOM(cell) {
  cell.el.className = 'cell cell-' + cell.type;
}

function cellAt(r, c) {
  return state.grid[r][c];
}

function inBounds(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

function getWeight(type) {
  return WEIGHTS[type] ?? 1;
}

/* ==========================================================================
   Editing the board
   ========================================================================== */

function setCellType(r, c, type) {
  const cell = cellAt(r, c);

  if (type === 'start') {
    if (cell.type === 'target') return; // cannot overwrite target
    const old = cellAt(state.start.r, state.start.c);
    old.type = 'empty';
    paintCellDOM(old);
    cell.type = 'start';
    state.start = { r, c };
    paintCellDOM(cell);
    return;
  }

  if (type === 'target') {
    if (cell.type === 'start') return; // cannot overwrite start
    const old = cellAt(state.target.r, state.target.c);
    old.type = 'empty';
    paintCellDOM(old);
    cell.type = 'target';
    state.target = { r, c };
    paintCellDOM(cell);
    return;
  }

  // wall / mud / mountain / eraser(empty) — never overwrite start or target
  if (cell.type === 'start' || cell.type === 'target') return;
  cell.type = type;
  paintCellDOM(cell);
}

function clearVisualState() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = state.grid[r][c];
      if (cell.type === 'empty' || cell.type === 'wall' || cell.type === 'mud' || cell.type === 'mountain') {
        cell.el.classList.remove('cell-visited', 'cell-frontier', 'cell-path');
      } else {
        cell.el.classList.remove('cell-visited', 'cell-frontier', 'cell-path');
      }
    }
  }
}

function resetMetrics() {
  mVisited.textContent = '—';
  mLength.textContent = '—';
  mCost.textContent = '—';
  mTime.textContent = '—';
  mStatus.textContent = 'En espera';
}

function resetBoard() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      state.grid[r][c].type = 'empty';
    }
  }
  state.start = { r: 9, c: 2 };
  state.target = { r: 9, c: 17 };
  state.grid[state.start.r][state.start.c].type = 'start';
  state.grid[state.target.r][state.target.c].type = 'target';
  redrawAll();
  resetMetrics();
}

function rerollTarget() {
  if (state.animating) return;
  const candidates = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = state.grid[r][c];
      if (cell.type === 'empty') candidates.push(cell);
    }
  }
  if (!candidates.length) return;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const old = cellAt(state.target.r, state.target.c);
  old.type = 'empty';
  paintCellDOM(old);
  pick.type = 'target';
  state.target = { r: pick.r, c: pick.c };
  paintCellDOM(pick);
  clearVisualState();
  resetMetrics();
}

/* ==========================================================================
   Pointer interaction (click + drag painting)
   ========================================================================== */

function cellFromEvent(e) {
  const el = e.target.closest('.cell');
  if (!el) return null;
  return { r: parseInt(el.dataset.r, 10), c: parseInt(el.dataset.c, 10) };
}

function applyTool(r, c) {
  const type = state.tool === 'eraser' ? 'empty' : state.tool;
  setCellType(r, c, type);
}

gridEl.addEventListener('mousedown', (e) => {
  if (state.animating) return;
  const pos = cellFromEvent(e);
  if (!pos) return;
  e.preventDefault();
  state.painting = true;
  applyTool(pos.r, pos.c);
});

gridEl.addEventListener('mouseover', (e) => {
  if (!state.painting || state.animating) return;
  const pos = cellFromEvent(e);
  if (!pos) return;
  applyTool(pos.r, pos.c);
});

document.addEventListener('mouseup', () => { state.painting = false; });
gridEl.addEventListener('dragstart', (e) => e.preventDefault());

/* ==========================================================================
   Tool & algorithm selectors
   ========================================================================== */

document.getElementById('tool-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('.tool');
  if (!btn) return;
  document.querySelectorAll('.tool').forEach(b => b.classList.remove('is-active'));
  btn.classList.add('is-active');
  state.tool = btn.dataset.tool;
});

document.getElementById('algo-select').addEventListener('click', (e) => {
  const btn = e.target.closest('.algo-chip');
  if (!btn) return;
  document.querySelectorAll('.algo-chip').forEach(b => b.classList.remove('is-active'));
  btn.classList.add('is-active');
  state.algo = btn.dataset.algo;
});

/* ==========================================================================
   Min-heap priority queue (used by UCS and A*)
   ========================================================================== */

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item) {
    this.items.push(item);
    this._bubbleUp(this.items.length - 1);
  }
  pop() {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this._bubbleDown(0);
    }
    return top;
  }
  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.items[p].priority <= this.items[i].priority) break;
      [this.items[p], this.items[i]] = [this.items[i], this.items[p]];
      i = p;
    }
  }
  _bubbleDown(i) {
    const n = this.items.length;
    while (true) {
      const l = 2 * i + 1, r = 2 * i + 2;
      let smallest = i;
      if (l < n && this.items[l].priority < this.items[smallest].priority) smallest = l;
      if (r < n && this.items[r].priority < this.items[smallest].priority) smallest = r;
      if (smallest === i) break;
      [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
      i = smallest;
    }
  }
}

/* ==========================================================================
   Pathfinding algorithms
   ========================================================================== */

function create2D(fillValue) {
  const arr = [];
  for (let r = 0; r < ROWS; r++) arr.push(new Array(COLS).fill(fillValue));
  return arr;
}

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function passableNeighbors(r, c, shuffle) {
  const dirs = shuffle ? shuffleArray(DIRS.slice()) : DIRS;
  const out = [];
  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc) && state.grid[nr][nc].type !== 'wall') out.push({ r: nr, c: nc });
  }
  return out;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function manhattan(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

function reconstructPath(parent, start, target) {
  const path = [];
  let cur = { r: target.r, c: target.c };
  while (cur && !(cur.r === start.r && cur.c === start.c)) {
    path.push(cur);
    cur = parent[cur.r][cur.c];
  }
  path.push({ r: start.r, c: start.c });
  path.reverse();
  return path;
}

function pathCost(path) {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    cost += getWeight(state.grid[path[i].r][path[i].c].type);
  }
  return cost;
}

function makeResult(name, order, path, found, timeMs, explicitCost) {
  return {
    name,
    order,
    path,
    found,
    timeMs,
    visitedCount: order.length,
    length: found ? path.length : 0,
    cost: found ? (explicitCost !== undefined ? explicitCost : pathCost(path)) : 0
  };
}

function runBFS(start, target) {
  const t0 = performance.now();
  const visited = create2D(false);
  const parent = create2D(null);
  const queue = [{ r: start.r, c: start.c }];
  visited[start.r][start.c] = true;
  const order = [];
  let found = false;

  while (queue.length) {
    const cur = queue.shift();
    order.push(cur);
    if (cur.r === target.r && cur.c === target.c) { found = true; break; }
    for (const nb of passableNeighbors(cur.r, cur.c, false)) {
      if (!visited[nb.r][nb.c]) {
        visited[nb.r][nb.c] = true;
        parent[nb.r][nb.c] = cur;
        queue.push(nb);
      }
    }
  }
  const timeMs = performance.now() - t0;
  const path = found ? reconstructPath(parent, start, target) : [];
  return makeResult('BFS', order, path, found, timeMs);
}

function runDFS(start, target) {
  const t0 = performance.now();
  const visited = create2D(false);
  const parent = create2D(null);
  const stack = [{ r: start.r, c: start.c }];
  const order = [];
  let found = false;

  while (stack.length) {
    const cur = stack.pop();
    if (visited[cur.r][cur.c]) continue;
    visited[cur.r][cur.c] = true;
    order.push(cur);
    if (cur.r === target.r && cur.c === target.c) { found = true; break; }
    for (const nb of passableNeighbors(cur.r, cur.c, true)) {
      if (!visited[nb.r][nb.c]) {
        if (!parent[nb.r][nb.c]) parent[nb.r][nb.c] = cur;
        stack.push(nb);
      }
    }
  }
  const timeMs = performance.now() - t0;
  const path = found ? reconstructPath(parent, start, target) : [];
  return makeResult('DFS', order, path, found, timeMs);
}

function runUCS(start, target) {
  const t0 = performance.now();
  const dist = create2D(Infinity);
  const parent = create2D(null);
  const visited = create2D(false);
  dist[start.r][start.c] = 0;

  const heap = new MinHeap();
  heap.push({ r: start.r, c: start.c, priority: 0 });
  const order = [];
  let found = false;

  while (heap.size) {
    const cur = heap.pop();
    if (visited[cur.r][cur.c]) continue;
    visited[cur.r][cur.c] = true;
    order.push({ r: cur.r, c: cur.c });
    if (cur.r === target.r && cur.c === target.c) { found = true; break; }

    for (const nb of passableNeighbors(cur.r, cur.c, false)) {
      if (visited[nb.r][nb.c]) continue;
      const w = getWeight(state.grid[nb.r][nb.c].type);
      const nd = dist[cur.r][cur.c] + w;
      if (nd < dist[nb.r][nb.c]) {
        dist[nb.r][nb.c] = nd;
        parent[nb.r][nb.c] = { r: cur.r, c: cur.c };
        heap.push({ r: nb.r, c: nb.c, priority: nd });
      }
    }
  }
  const timeMs = performance.now() - t0;
  const path = found ? reconstructPath(parent, start, target) : [];
  const cost = found ? dist[target.r][target.c] : 0;
  return makeResult('UCS', order, path, found, timeMs, cost);
}

function runAStar(start, target) {
  const t0 = performance.now();
  const dist = create2D(Infinity);
  const parent = create2D(null);
  const visited = create2D(false);
  dist[start.r][start.c] = 0;

  const heap = new MinHeap();
  heap.push({ r: start.r, c: start.c, priority: manhattan(start, target) });
  const order = [];
  let found = false;

  while (heap.size) {
    const cur = heap.pop();
    if (visited[cur.r][cur.c]) continue;
    visited[cur.r][cur.c] = true;
    order.push({ r: cur.r, c: cur.c });
    if (cur.r === target.r && cur.c === target.c) { found = true; break; }

    for (const nb of passableNeighbors(cur.r, cur.c, false)) {
      if (visited[nb.r][nb.c]) continue;
      const w = getWeight(state.grid[nb.r][nb.c].type);
      const nd = dist[cur.r][cur.c] + w;
      if (nd < dist[nb.r][nb.c]) {
        dist[nb.r][nb.c] = nd;
        parent[nb.r][nb.c] = { r: cur.r, c: cur.c };
        heap.push({ r: nb.r, c: nb.c, priority: nd + manhattan(nb, target) });
      }
    }
  }
  const timeMs = performance.now() - t0;
  const path = found ? reconstructPath(parent, start, target) : [];
  const cost = found ? dist[target.r][target.c] : 0;
  return makeResult('A*', order, path, found, timeMs, cost);
}

function runAlgorithm(name, start, target) {
  switch (name) {
    case 'bfs': return runBFS(start, target);
    case 'dfs': return runDFS(start, target);
    case 'ucs': return runUCS(start, target);
    case 'astar': return runAStar(start, target);
    default: return runAStar(start, target);
  }
}

/* ==========================================================================
   Animated visualization
   ========================================================================== */

function speedToDelay() {
  const v = Number(speedSlider.value); // 1 (slow) .. 100 (fast)
  return Math.max(1, Math.round(46 * (1 - v / 100)) + 1);
}

function setRunningUI(running) {
  state.animating = running;
  document.getElementById('btn-run').disabled = running;
  document.getElementById('btn-race').disabled = running;
  document.getElementById('btn-maze').disabled = running;
  document.getElementById('btn-reset').disabled = running;
  document.getElementById('btn-reroll').disabled = running;
  document.getElementById('btn-clear-path').disabled = running;
}

function visualize() {
  if (state.animating) return;
  clearVisualState();
  const result = runAlgorithm(state.algo, state.start, state.target);

  setRunningUI(true);
  mStatus.textContent = 'Buscando…';
  mVisited.textContent = '0';
  mLength.textContent = '—';
  mCost.textContent = '—';
  mTime.textContent = '—';

  const delay = speedToDelay();
  let i = 0;

  function stepVisited() {
    if (i >= result.order.length) {
      finishExploration();
      return;
    }
    const { r, c } = result.order[i];
    const cell = state.grid[r][c];
    if (cell.type !== 'start' && cell.type !== 'target') {
      cell.el.classList.add('cell-visited');
    }
    i++;
    mVisited.textContent = String(i);
    setTimeout(stepVisited, delay);
  }

  function finishExploration() {
    mTime.textContent = result.timeMs.toFixed(2) + ' ms';
    if (!result.found) {
      mStatus.textContent = 'No se encontró ningún camino';
      mLength.textContent = '0';
      mCost.textContent = '0';
      setRunningUI(false);
      return;
    }
    mStatus.textContent = 'Trazando camino…';
    animatePath(result);
  }

  stepVisited();
}

function animatePath(result) {
  const delay = Math.max(speedToDelay() * 2, 16);
  let i = 0;

  function stepPath() {
    if (i >= result.path.length) {
      mStatus.textContent = 'Camino encontrado';
      mLength.textContent = String(result.length);
      mCost.textContent = String(result.cost);
      setRunningUI(false);
      return;
    }
    const { r, c } = result.path[i];
    const cell = state.grid[r][c];
    if (cell.type !== 'start' && cell.type !== 'target') {
      cell.el.classList.add('cell-path');
    }
    i++;
    setTimeout(stepPath, delay);
  }
  stepPath();
}

/* ==========================================================================
   Maze generator (randomized recursive backtracker)
   ========================================================================== */

function generateMaze() {
  if (state.animating) return;
  clearVisualState();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) state.grid[r][c].type = 'wall';
  }

  const visited = create2D(false);
  const carveRows = [];
  for (let r = 0; r < ROWS; r += 2) carveRows.push(r);
  const carveCols = [];
  for (let c = 0; c < COLS; c += 2) carveCols.push(c);

  const startNode = { r: 0, c: 0 };
  visited[0][0] = true;
  state.grid[0][0].type = 'empty';
  const stack = [startNode];

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const dirs = shuffleArray([[-2, 0], [2, 0], [0, -2], [0, 2]]);
    let advanced = false;

    for (const [dr, dc] of dirs) {
      const nr = cur.r + dr, nc = cur.c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      if (visited[nr][nc]) continue;
      const wr = cur.r + dr / 2, wc = cur.c + dc / 2;
      state.grid[wr][wc].type = 'empty';
      state.grid[nr][nc].type = 'empty';
      visited[nr][nc] = true;
      stack.push({ r: nr, c: nc });
      advanced = true;
      break;
    }
    if (!advanced) stack.pop();
  }

  // collect carved cells for start/target placement
  const carved = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (state.grid[r][c].type === 'empty') carved.push({ r, c });
    }
  }

  state.grid[0][0].type = 'start';
  state.start = { r: 0, c: 0 };

  // pick a carved cell far from the start as the target
  let best = carved[0];
  let bestDist = -1;
  for (const cell of carved) {
    const d = manhattan(cell, state.start);
    if (d > bestDist) { bestDist = d; best = cell; }
  }
  state.grid[best.r][best.c].type = 'target';
  state.target = { r: best.r, c: best.c };

  // sprinkle a little weighted terrain for flavor
  for (const cell of carved) {
    if (cell.r === state.start.r && cell.c === state.start.c) continue;
    if (cell.r === best.r && cell.c === best.c) continue;
    const roll = Math.random();
    if (roll < 0.06) state.grid[cell.r][cell.c].type = 'mud';
    else if (roll < 0.09) state.grid[cell.r][cell.c].type = 'mountain';
  }

  redrawAll();
  resetMetrics();
}

/* ==========================================================================
   Race mode
   ========================================================================== */

function hasWeightedTerrain() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = state.grid[r][c].type;
      if (t === 'mud' || t === 'mountain') return true;
    }
  }
  return false;
}

function runRace() {
  if (state.animating) return;
  const order = ['astar', 'ucs', 'bfs', 'dfs'];
  const labels = { astar: 'A*', ucs: 'UCS (Dijkstra)', bfs: 'BFS', dfs: 'DFS' };
  const results = order.map(key => ({ key, ...runAlgorithm(key, state.start, state.target) }));

  const weighted = hasWeightedTerrain();
  const optimality = {
    astar: true,
    ucs: true,
    bfs: !weighted,
    dfs: false
  };

  // pick winner: lowest cost among found paths, tie-break on time
  let winner = null;
  for (const res of results) {
    if (!res.found) continue;
    if (!winner || res.cost < winner.cost || (res.cost === winner.cost && res.timeMs < winner.timeMs)) {
      winner = res;
    }
  }

  const tbody = document.getElementById('race-table-body');
  tbody.innerHTML = '';
  for (const res of results) {
    const tr = document.createElement('tr');
    if (winner && res.key === winner.key) tr.classList.add('is-winner');
    const optOk = optimality[res.key];
    tr.innerHTML = `
      <td>${labels[res.key]}${winner && res.key === winner.key ? ' 🏆' : ''}</td>
      <td>${res.visitedCount}</td>
      <td>${res.found ? res.length : '—'}</td>
      <td>${res.found ? res.cost : '—'}</td>
      <td>${res.timeMs.toFixed(3)}</td>
      <td class="${optOk ? 'opt-yes' : 'opt-no'}">${optOk ? 'Sí' : (res.key === 'bfs' ? 'Solo sin pesos' : 'No')}</td>
    `;
    tbody.appendChild(tr);
  }

  const banner = document.getElementById('race-banner');
  if (winner) {
    banner.classList.remove('hidden');
    banner.innerHTML = `🏆 <strong>${labels[winner.key]}</strong> encontró el camino de menor coste en este tablero: coste <strong>${winner.cost}</strong>, ${winner.length} celdas, en ${winner.timeMs.toFixed(3)} ms.`;
  } else {
    banner.classList.remove('hidden');
    banner.innerHTML = `Ningún algoritmo alcanzó el objetivo: no hay una ruta libre entre el inicio y el objetivo.`;
  }

  openModal('modal-race');
}

/* ==========================================================================
   Modals
   ========================================================================== */

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(o => o.classList.add('hidden'));
  }
});

/* ==========================================================================
   Button wiring
   ========================================================================== */

document.getElementById('btn-run').addEventListener('click', visualize);
document.getElementById('btn-race').addEventListener('click', runRace);
document.getElementById('btn-guide').addEventListener('click', () => openModal('modal-guide'));
document.getElementById('btn-reroll').addEventListener('click', rerollTarget);
document.getElementById('btn-maze').addEventListener('click', generateMaze);
document.getElementById('btn-clear-path').addEventListener('click', () => {
  if (state.animating) return;
  clearVisualState();
  resetMetrics();
});
document.getElementById('btn-reset').addEventListener('click', () => {
  if (state.animating) return;
  resetBoard();
});

/* ==========================================================================
   Init
   ========================================================================== */

buildGrid();
resetMetrics();
