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
 * @param {Array} zones - Array of { id, currentFans, capacity, blocked }
 * @returns {Object} { path: [], totalCost: number }
 */
export function findBestRoute(startZone, zones = []) {
  if (!graph[startZone]) {
    // STEP 11 — FALLBACK SAFETY
    return { path: [startZone], totalCost: 0 };
  }

  const cacheKey = hashState(startZone, zones);
  if (routeCache[cacheKey]) {
    return routeCache[cacheKey]; // Return reused cached route
  }

  const zoneDataMap = {};
  for (const z of zones) {
    zoneDataMap[z.id] = z;
  }

  // Dijkstra initialization
  const distances = {};
  const previous = {};
  const unvisited = new Set(Object.keys(graph));

  for (const node of unvisited) {
    distances[node] = Infinity;
    previous[node] = null;
  }
  distances[startZone] = 0;

  while (unvisited.size > 0) {
    // Find node with minimum distance
    let current = null;
    let minDistance = Infinity;
    
    for (const node of unvisited) {
      if (distances[node] < minDistance) {
        minDistance = distances[node];
        current = node;
      }
    }

    // Graph disconnected or target reached and unvisited populated
    if (current === null || minDistance === Infinity) break;

    unvisited.delete(current);

    // If terminal node (exit) and we're looking for any exit, we can stop early, 
    // but Dijkstra traditionally processes all to find shortest to all.
    const neighbors = graph[current] || [];
    for (const neighbor of neighbors) {
      if (!unvisited.has(neighbor.node)) continue;

      const neighborZone = zoneDataMap[neighbor.node];
      
      // Avoid blocked zones completely
      if (neighborZone && neighborZone.blocked) {
        continue;
      }

      // Fallback density map setup if not running via updateDensityMap route (safety)
      if (!zoneDensityMap[neighbor.node]) {
        const capacity = neighborZone && neighborZone.capacity ? neighborZone.capacity : 10000;
        const currentFans = neighborZone && neighborZone.currentFans ? neighborZone.currentFans : 0;
        zoneDensityMap[neighbor.node] = (currentFans / capacity) * 100;
      }

      // STEP 4 — MODIFY DIJKSTRA WITH DYNAMIC WEIGHT
      const stepCost = getDynamicWeight(neighbor.node, neighbor.distance);
      
      const alternativeDistance = distances[current] + stepCost;

      if (alternativeDistance < distances[neighbor.node]) {
        distances[neighbor.node] = alternativeDistance;
        previous[neighbor.node] = current;
      }
    }
  }

  // Find shortest path to any terminal node (empty array in graph config like "south" or "gates")
  let bestTerminal = null;
  let minTerminalDist = Infinity;
  for (const [node, edges] of Object.entries(graph)) {
    if (edges.length === 0 && distances[node] < minTerminalDist) {
      minTerminalDist = distances[node];
      bestTerminal = node;
    }
  }

  // Fallback: If no terminal node is reachable, return nearest available exit (itself)
  if (!bestTerminal || minTerminalDist === Infinity) {
    return { path: [startZone], totalCost: 0 };
  }

  // Reconstruct path
  const path = [];
  let currentWalk = bestTerminal;
  while (currentWalk !== null) {
    path.unshift(currentWalk);
    currentWalk = previous[currentWalk];
  }

  const result = { path, totalCost: minTerminalDist };
  routeCache[cacheKey] = result;
  
  return result;
}

/**
 * STEP 7 — UPDATE SMART MESSAGE & STEP 8 — SMART SUGGESTIONS ENGINE
 * 
 * @param {Array} path 
 * @param {Array} zones 
 */
export function generateSmartSuggestion(path, zones = []) {
  if (path.length === 0) return "Analyzing optimal routes...";

  const terminalNode = path[path.length - 1];
  
  if (zones.find(z => z.blocked)) {
    return "Emergency detected. Proceed to nearest safe exit.";
  }

  // Check if route avoids crowded zones based on tier scale
  let isAvoiding = false;
  path.forEach(node => {
     let d = zoneDensityMap[node] || 0;
     if (d >= 50) isAvoiding = true; // High density path components trigger congestion alerts
  });

  // Find the stand/concourse name for the current recommended node
  const activeNode = path.length > 1 ? path[1] : path[0];
  let friendlyName = activeNode;
  if (activeNode === 'concN') friendlyName = 'North Concourse';
  else if (activeNode === 'concS') friendlyName = 'South Concourse';
  else if (activeNode === 'north') friendlyName = 'North Stand';
  else if (activeNode === 'south') friendlyName = 'South Stand';
  else if (activeNode === 'east') friendlyName = 'East Stand';
  else if (activeNode === 'west') friendlyName = 'West Stand';
  else if (activeNode === 'gates') friendlyName = 'Main Gates';
  
  if (isAvoiding) {
     return `Using ${friendlyName} — less crowded.`;
  }
  
  return `Path looks clear.`;
}
