/**
 * EventFlow V2 — Dijkstra Smart Routing Engine
 * Powered by realtime density and emergency zone mapping.
 */

import { zoneGraph as graph } from './zoneGraph.js';

const DEFAULT_CAPACITY = 10000;
const ALT_EDGE_PENALTY = 50;
const EPSILON = 1e-9;

// STEP 1 — CREATE DENSITY STORE
export let zoneDensityMap = {};

export function updateDensityMap(densities) {
  if (!densities || typeof densities !== 'object') return;

  const next = { ...zoneDensityMap };
  Object.keys(densities).forEach(id => {
    const raw = densities[id];
    const value = typeof raw === 'number'
      ? raw
      : (raw && typeof raw.density === 'number' ? raw.density : 0);
    next[id] = normalizeDensity(value);
  });
  zoneDensityMap = next;
}

// STEP 3 — CREATE DYNAMIC COST FUNCTION
export function getDynamicWeight(zoneId, baseDistance, densities = zoneDensityMap) {
  const density = densities[zoneId] || 0;
  if (density < 50) {
    return baseDistance;
  }
  if (density >= 50 && density <= 80) {
    return baseDistance * 1.5;
  }
  if (density > 80) {
    return baseDistance * 3;
  }
  return baseDistance;
}

// STEP 4 — CREATE ROUTE CACHE
let routeCache = new Map();

const undirectedGraph = buildUndirectedGraph(graph);

export function clearRouteCache() {
  routeCache = new Map();
}

function normalizeDensity(value) {
  const numeric = Number.isFinite(value) ? value : 0;
  if (numeric <= 1 && numeric >= 0) return numeric * 100;
  if (numeric > 1 && numeric <= 2.5) return Math.min(100, numeric * 100);
  return Math.min(100, Math.max(0, numeric));
}

function buildUndirectedGraph(sourceGraph) {
  const merged = {};

  Object.keys(sourceGraph).forEach(node => {
    if (!merged[node]) merged[node] = [];
    const edges = Array.isArray(sourceGraph[node]) ? sourceGraph[node] : [];
    edges.forEach(edge => {
      if (!edge || !edge.node || !Number.isFinite(edge.distance) || edge.distance <= 0) return;

      if (!merged[edge.node]) merged[edge.node] = [];

      if (!merged[node].some(e => e.node === edge.node)) {
        merged[node].push({ node: edge.node, distance: edge.distance });
      }

      if (!merged[edge.node].some(e => e.node === node)) {
        merged[edge.node].push({ node, distance: edge.distance });
      }
    });
  });

  return merged;
}

function buildZoneContext(zones) {
  const zoneDataMap = {};
  const densities = { ...zoneDensityMap };
  const blocked = new Set();

  for (const zone of zones) {
    if (!zone || !zone.id) continue;
    zoneDataMap[zone.id] = zone;

    if (zone.blocked) blocked.add(zone.id);

    const capacity = Number.isFinite(zone.capacity) && zone.capacity > 0
      ? zone.capacity
      : DEFAULT_CAPACITY;
    const currentFans = Number.isFinite(zone.currentFans) ? zone.currentFans : 0;
    const percent = (currentFans / capacity) * 100;
    densities[zone.id] = normalizeDensity(percent);
  }

  return { zoneDataMap, densities, blocked };
}

function hashState(startZone, destinationZone, penalties, blockedSet, densities) {
  const penaltyState = Object.keys(penalties)
    .sort()
    .map(key => `${key}->${penalties[key]}`)
    .join('|');

  const blockedState = Array.from(blockedSet).sort().join('|');
  const densityState = Object.keys(densities)
    .sort()
    .map(key => `${key}:${Math.round(densities[key] * 100) / 100}`)
    .join('|');

  return `${startZone}|${destinationZone}|${penaltyState}|${blockedState}|${densityState}`;
}

class MinPriorityQueue {
  constructor() {
    this.heap = [];
  }

  push(node, priority) {
    this.heap.push({ node, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0 && last) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  get size() {
    return this.heap.length;
  }

  bubbleUp(index) {
    let i = index;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].priority <= this.heap[i].priority) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  bubbleDown(index) {
    let i = index;
    const length = this.heap.length;

    while (true) {
      const left = (2 * i) + 1;
      const right = left + 1;
      let smallest = i;

      if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === i) break;

      [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
      i = smallest;
    }
  }
}

/**
 * STEP 3 — IMPLEMENT DIJKSTRA ALGORITHM
 * 
 * @param {string} startZone 
 * @param {string} destinationZone
 * @param {Array} zones - Array of { id, currentFans, capacity, blocked }
 * @param {Object} penalties - Dynamic penalty configuration map.
 * @returns {Object} { path: [], totalCost: number }
 */
export function findBestRoute(startZone, destinationZone, zones = [], penalties = {}) {
  if (!startZone || !destinationZone) {
    return { path: [], totalCost: Infinity };
  }

  if (startZone === destinationZone) {
    return { path: [startZone], totalCost: 0 };
  }

  if (!undirectedGraph[startZone] || !undirectedGraph[destinationZone]) {
    return { path: [], totalCost: Infinity };
  }

  const { densities, blocked } = buildZoneContext(zones);
  if (blocked.has(startZone) || blocked.has(destinationZone)) {
    return { path: [], totalCost: Infinity };
  }

  zoneDensityMap = densities;

  const cacheKey = hashState(startZone, destinationZone, penalties, blocked, densities);
  const cached = routeCache.get(cacheKey);
  if (cached) return cached;

  const distances = {};
  const previous = {};
  const visited = new Set();
  const queue = new MinPriorityQueue();

  Object.keys(undirectedGraph).forEach(node => {
    distances[node] = Infinity;
    previous[node] = null;
  });
  distances[startZone] = 0;
  queue.push(startZone, 0);

  while (queue.size > 0) {
    const currentEntry = queue.pop();
    if (!currentEntry) break;
    const { node: current, priority: currentDistance } = currentEntry;
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === destinationZone) break;
    if (currentDistance - distances[current] > EPSILON) continue;

    const neighbors = undirectedGraph[current] || [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.node)) continue;
      if (blocked.has(neighbor.node)) continue;

      let stepCost = getDynamicWeight(neighbor.node, neighbor.distance, densities);
      if (penalties[current] === neighbor.node || penalties[neighbor.node] === current) {
        stepCost += ALT_EDGE_PENALTY;
      }

      const alternativeDistance = distances[current] + stepCost;
      if (alternativeDistance < distances[neighbor.node]) {
        distances[neighbor.node] = alternativeDistance;
        previous[neighbor.node] = current;
        queue.push(neighbor.node, alternativeDistance);
      }
    }
  }

  if (distances[destinationZone] === Infinity) {
    const noPath = { path: [], totalCost: Infinity };
    routeCache.set(cacheKey, noPath);
    return noPath;
  }

  const path = [];
  let currentWalk = destinationZone;
  while (currentWalk !== null) {
    path.unshift(currentWalk);
    currentWalk = previous[currentWalk];
  }

  const result = { path, totalCost: distances[destinationZone] };
  routeCache.set(cacheKey, result);
  return result;
}

// STEP 4 — ADD ALTERNATE ROUTE ENGINE
export function findAlternatePath(startZone, destinationZone, bestPath, zones = []) {
  if (!bestPath || bestPath.length < 2) return null;
  
  const penalties = {};
  for (let i = 0; i < bestPath.length - 1; i++) {
    penalties[bestPath[i]] = bestPath[i+1];
  }

  const altResult = findBestRoute(startZone, destinationZone, zones, penalties);
  
  // Validate alternate is somewhat comparable or physically distinct
  if (!altResult.path || altResult.path.length <= 1) return null;
  if (altResult.path.join('_') === bestPath.join('_')) return null;

  return altResult;
}
