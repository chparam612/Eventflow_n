import { clearRouteCache, findAlternatePath, findBestRoute, updateDensityMap } from '../src/pathfindingEngine.js';

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

const baseline = findBestRoute('north', 'parking', baseZones);
assert(baseline.path.length > 0, 'Finds a route from north to parking');
assert(baseline.path[0] === 'north' && baseline.path[baseline.path.length - 1] === 'parking', 'Route starts and ends at requested zones');
assert(Number.isFinite(baseline.totalCost) && baseline.totalCost > 0, 'Route total cost is finite and positive');

clearRouteCache();
const blockedZones = baseZones.map(zone => zone.id === 'concN' ? { ...zone, blocked: true } : zone);
const blockedRoute = findBestRoute('north', 'parking', blockedZones);
assert(blockedRoute.path.length > 0, 'Still finds a route when concN is blocked');
assert(!blockedRoute.path.includes('concN'), 'Blocked zone is excluded from computed route');

clearRouteCache();
const congestedZones = baseZones.map(zone => zone.id === 'concN'
  ? { ...zone, currentFans: 9500, capacity: 10000 }
  : zone
);
const reroute = findBestRoute('east', 'gates', congestedZones);
assert(reroute.path.length > 0, 'Finds route under heavy density');
assert(!reroute.path.includes('concN'), 'High-density concN is avoided when alternatives exist');

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
