import { findBestRoute, generateSmartSuggestion, clearRouteCache } from '../src/pathfindingEngine.js';

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ ${msg}\n     Expected: ${JSON.stringify(expected)}\n     Got: ${JSON.stringify(actual)}`);
    failed++;
  }
}

async function test(name, fn) {
  try {
    await fn();
  } catch (e) {
    console.error(`  ❌ ${name} threw an error:`, e);
    failed++;
  }
}

console.log('\n🧭 SMART NAVIGATION ENGINE TESTS');

const baseZones = [
  { id: 'north', currentFans: 0, capacity: 10000, blocked: false },
  { id: 'east', currentFans: 0, capacity: 10000, blocked: false },
  { id: 'west', currentFans: 0, capacity: 10000, blocked: false },
  { id: 'south', currentFans: 0, capacity: 10000, blocked: false },
  { id: 'gates', currentFans: 0, capacity: 10000, blocked: false }
];

test('TEST 1 — Shortest Path', () => {
  clearRouteCache();
  // With 0 density, 'north' -> 'east' -> 'south' -> 'gates' cost is 2 + 2 + 1 = 5
  // 'north' -> 'west' -> 'south' -> 'gates' cost is 3 + 4 + 1 = 8
  const route = findBestRoute('north', baseZones);
  assertEqual(route.path, ['north', 'east', 'gates'], 'Should take the shorter east route directly to gates');
});

test('TEST 2 — Density Impact', () => {
  clearRouteCache();
  // Make 'east' heavily congested (90% density)
  const congestedZones = [
    { id: 'north', currentFans: 0, capacity: 10000, blocked: false },
    { id: 'east', currentFans: 9000, capacity: 10000, blocked: false }, // 90%
    { id: 'west', currentFans: 0, capacity: 10000, blocked: false },
    { id: 'south', currentFans: 0, capacity: 10000, blocked: false },
    { id: 'gates', currentFans: 0, capacity: 10000, blocked: false }
  ];

  const congestedRoute = findBestRoute('north', congestedZones);
  // 'east' densityFactor = 0.9.  cost of north->east = 2 * (1 + 0.9) = 3.8. east->south = 2 * 1.9 = 3.8. Total = 7.6
  // 'west' densityFactor = 0. cost of north->west = 3. west->south = 4. 
  // Wait, the calculation in pathfinding applies density of the TARGET node.
  // north->east uses 'east' density (0.9). Cost = 2 * 1.9 = 3.8
  // east->south uses 'south' density (0). Cost = 2 * 1 = 2
  // north->east->south: 3.8 + 2 = 5.8 
  // north->west->south uses 'west' (0). Cost 3 + 4 = 7
  // If we want west to be better, let's make east 100% capacity (Factor 1.0) and cost is 2*2=4 + 2*1=2 -> 6. Still 6 < 7.
  // Let's modify the density so `east` is heavily congested to force reroute.
  // We can make east 300% temporarily or blocked, but let's test density impact.
  // Original distance north->west is 3, west->south is 4 (total 7). north->east is 2, east->south is 2 (total 4).
  // If Target is Gate, north-east-south-gate is 2+2+1=5. north-west-south-gate is 3+4+1=8.
  // Let's just make 'east' very congested (cost multiplier = 3.0 -> 200% fans)
  const heavyCongested = JSON.parse(JSON.stringify(congestedZones));
  heavyCongested.find(z => z.id === 'east').currentFans = 25000; // Factor 2.5. 2*(1+2.5) = 7.
  
  const reroute = findBestRoute('north', heavyCongested);
  assertEqual(reroute.path, ['north', 'west', 'gates'], 'High density should reroute through west directly to gates');
});

test('TEST 3 — Emergency Avoidance', () => {
  clearRouteCache();
  // Block the shorter 'east' route
  const blockedZones = [
    { id: 'north', currentFans: 0, capacity: 10000, blocked: false },
    { id: 'east', currentFans: 0, capacity: 10000, blocked: true }, // BLOCKED
    { id: 'west', currentFans: 0, capacity: 10000, blocked: false },
    { id: 'south', currentFans: 0, capacity: 10000, blocked: false },
    { id: 'gates', currentFans: 0, capacity: 10000, blocked: false }
  ];

  const blockedRoute = findBestRoute('north', blockedZones);
  assertEqual(blockedRoute.path, ['north', 'west', 'gates'], 'Blocked emergency zones must be avoided');
});

test('TEST 4 — Cache Efficiency', () => {
  clearRouteCache();
  const r1 = findBestRoute('north', baseZones);
  
  // Make uncacheable change but the cache should be hit because it checks reference or identical hash
  baseZones[0].currentFans = 0; // Same state
  const r2 = findBestRoute('north', baseZones);
  
  assertEqual(r1 === r2, true, 'Same input state should return identical cached object reference');
});

console.log(`\nTests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
