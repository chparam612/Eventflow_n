/**
 * EventFlow V2 — Dijkstra Smart Routing Engine
 * Powered by realtime density and emergency zone mapping.
 */

import { zoneGraph as graph } from './zoneGraph.js';

// STEP 1 — CREATE DENSITY STORE
export let zoneDensityMap = {};

export function updateDensityMap(densities) {
  Object.keys(densities).forEach(id => {
    // Expected density is provided directly or converted to 0-100 scale.
    // If the simulation backend defines density as 0.0-1.0, convert to 0-100%
    const d = densities[id];
    zoneDensityMap[id] = d <= 1.0 ? d * 100 : d; // Handle both 0.9 and 90 seamlessly
  });
}

// STEP 3 — CREATE DYNAMIC COST FUNCTION
export function getDynamicWeight(zoneId, baseDistance) {
  const density = zoneDensityMap[zoneId] || 0;

  console.log(
    "Weight calc:",
    zoneId,
    density
  );

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
let routeCache = {};

export function clearRouteCache() {
  routeCache = {};
}

// Helper to hash densities for cache verification
function hashState(startZone, zones) {
  let hash = `${startZone}_`;
  for (const z of zones) {
    hash += `${z.id}:${z.currentFans || 0}:${z.blocked || false}_`;
  }
  hash += Object.keys(zoneDensityMap).map(k => `${k}:${zoneDensityMap[k]}`).join('_');
  return hash;
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
  // 1. Build an undirected graph dynamically for bidirectional support
  const undirectedGraph = {};
  Object.keys(graph).forEach(node => { undirectedGraph[node] = []; });
  Object.keys(graph).forEach(node => {
    graph[node].forEach(edge => {
      // Add forward edge
      if (!undirectedGraph[node].find(e => e.node === edge.node)) {
        undirectedGraph[node].push(edge);
      }
      // Add reverse edge
      if (!undirectedGraph[edge.node]) undirectedGraph[edge.node] = [];
      if (!undirectedGraph[edge.node].find(e => e.node === node)) {
        undirectedGraph[edge.node].push({ node, distance: edge.distance });
      }
    });
  });

  if (!undirectedGraph[startZone] || !undirectedGraph[destinationZone]) {
    return { path: [startZone], totalCost: 0 };
  }

  const zoneDataMap = {};
  for (const z of zones) {
    zoneDataMap[z.id] = z;
  }

  // Dijkstra init
  const distances = {};
  const previous = {};
  const unvisited = new Set(Object.keys(undirectedGraph));

  for (const node of unvisited) {
    distances[node] = Infinity;
    previous[node] = null;
  }
  distances[startZone] = 0;

  while (unvisited.size > 0) {
    let current = null;
    let minDistance = Infinity;
    
    for (const node of unvisited) {
      if (distances[node] < minDistance) {
        minDistance = distances[node];
        current = node;
      }
    }

    if (current === null || current === destinationZone || minDistance === Infinity) break;

    unvisited.delete(current);

    const neighbors = undirectedGraph[current] || [];
    for (const neighbor of neighbors) {
      if (!unvisited.has(neighbor.node)) continue;

      const neighborZone = zoneDataMap[neighbor.node];
      if (neighborZone && neighborZone.blocked) continue;

      if (!zoneDensityMap[neighbor.node]) {
        const capacity = neighborZone && neighborZone.capacity ? neighborZone.capacity : 10000;
        const currentFans = neighborZone && neighborZone.currentFans ? neighborZone.currentFans : 0;
        zoneDensityMap[neighbor.node] = (currentFans / capacity) * 100;
      }

      // Density dynamic weight
      let stepCost = getDynamicWeight(neighbor.node, neighbor.distance);
      
      // Inject Alternate Route Penalties
      if (penalties[current] === neighbor.node || penalties[neighbor.node] === current) {
         stepCost += 50; // Mass penalty to enforce alternate routing
      }
      
      const alternativeDistance = distances[current] + stepCost;

      if (alternativeDistance < distances[neighbor.node]) {
        distances[neighbor.node] = alternativeDistance;
        previous[neighbor.node] = current;
      }
    }
  }

  if (distances[destinationZone] === Infinity) {
    return { path: [startZone], totalCost: 0 };
  }

  // Reconstruct path
  const path = [];
  let currentWalk = destinationZone;
  while (currentWalk !== null) {
    path.unshift(currentWalk);
    currentWalk = previous[currentWalk];
  }

  return { path, totalCost: distances[destinationZone] };
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

