import { clearRouteCache, findAlternatePath, findBestRoute, updateDensityMap, zoneDensityMap } from '../src/pathfindingEngine.js';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ ${msg}`);
    failed++;
  }
}

console.log('\n🧭 PATHFINDING ENGINE TESTS');

const baseZones = [
  { id: 'north', currentFans: 0, capacity: 10000, blocked: false },
  { id: 'south', currentFans: 0, capacity: 10000, blocked: false },
  { id: 'east', currentFans: 0, capacity: 10000, blocked: false },
  { id: 'west', currentFans: 0, capacity: 10000, blocked: false },
  { id: 'concN', currentFans: 0, capacity: 10000, blocked: false },
  { id: 'concS', currentFans: 0, capacity: 10000, blocked: false },
  { id: 'gates', currentFans: 0, capacity: 10000, blocked: false },
  { id: 'parking', currentFans: 0, capacity: 10000, blocked: false }
];

clearRouteCache();
updateDensityMap({});
updateDensityMap({ a: 0.5, b: 50, c: -10, d: 150, e: null, f: undefined });
assert(zoneDensityMap.a === 50, 'Normalizes 0-1 scale density values to percentages');
assert(zoneDensityMap.b === 50, 'Keeps 0-100 percentage values as-is');
assert(zoneDensityMap.c === 0 && zoneDensityMap.d === 100, 'Clamps density values to the [0,100] range');
assert(zoneDensityMap.e === 0 && zoneDensityMap.f === 0, 'Handles null/undefined density input safely');
updateDensityMap({});

const baseline = findBestRoute('north', 'parking', baseZones);
assert(baseline.path.length > 0, 'Finds a route from north to parking');
assert(baseline.path[0] === 'north' && baseline.path[baseline.path.length - 1] === 'parking', 'Route starts and ends at requested zones');
assert(Number.isFinite(baseline.totalCost) && baseline.totalCost > 0, 'Route total cost is finite and positive');

clearRouteCache();
const blockedZones = baseZones.map(zone => zone.id === 'concN' ? { ...zone, blocked: true } : zone);
const blockedRoute = findBestRoute('north', 'parking', blockedZones);
assert(blockedRoute.path.length > 0, 'Still finds a route when concN is blocked');
assert(blockedRoute.path[blockedRoute.path.length - 1] === 'parking', 'Blocked-zone reroute still reaches parking');
assert(!blockedRoute.path.includes('concN'), 'Blocked zone is excluded from computed route');

clearRouteCache();
const eastBaseline = findBestRoute('east', 'gates', baseZones);
assert(eastBaseline.path.length > 0, 'Baseline east to gates route is available');

clearRouteCache();
const congestedZones = baseZones.map(zone => zone.id === 'concN'
  ? { ...zone, currentFans: 9500, capacity: 10000 }
  : zone
);
const reroute = findBestRoute('east', 'gates', congestedZones);
assert(reroute.path.length > 0, 'Finds route under heavy density');
assert(reroute.totalCost >= eastBaseline.totalCost, 'Congestion does not produce a lower-than-baseline route cost');
assert(!reroute.path.includes('concN') || reroute.totalCost > eastBaseline.totalCost, 'Congestion around concN influences pathing or cost');

clearRouteCache();
const impossibleZones = baseZones.map(zone => zone.id === 'gates' ? { ...zone, blocked: true } : zone);
const noRoute = findBestRoute('north', 'parking', impossibleZones);
assert(Array.isArray(noRoute.path) && noRoute.path.length === 0, 'No-route returns empty path');
assert(noRoute.totalCost === Infinity, 'No-route returns Infinity cost');

clearRouteCache();
const cachedA = findBestRoute('north', 'parking', baseZones);
const cachedB = findBestRoute('north', 'parking', baseZones);
assert(cachedA === cachedB, 'Identical routing state returns cached object');

clearRouteCache();
const primary = findBestRoute('north', 'parking', baseZones);
const alternate = findAlternatePath('north', 'parking', primary.path, baseZones);
assert(alternate && alternate.path.length > 1, 'Alternate route generation returns valid path');
assert(alternate.path.join('_') !== primary.path.join('_'), 'Alternate route differs from best route');

console.log(`\nTests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
