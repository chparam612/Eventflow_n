import { zoneCoordinates } from '../src/zoneCoordinates.js';
import { zoneGraph } from '../src/zoneGraph.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    console.error(`  ❌ FAILED: ${message}`);
  }
}

console.log('\n🧭 ZONE MAPPING SYSTEM TESTS');

const EXPECTED_ZONES = ['north', 'south', 'east', 'west', 'concN', 'concS', 'gates', 'parking'];

console.log('\n🔹 TEST 1 — All Zones Have Coordinates');
let t1_success = true;
EXPECTED_ZONES.forEach(zone => {
  if (!zoneCoordinates[zone] || zoneCoordinates[zone].lat === undefined || zoneCoordinates[zone].lng === undefined) t1_success = false;
});
assert(t1_success, "Each zone contains lat and lng.");

console.log('\n🔹 TEST 2 — Coordinates Valid');
let t2_success = true;
Object.values(zoneCoordinates).forEach(coord => {
  if (typeof coord.lat !== 'number' || typeof coord.lng !== 'number') t2_success = false;
  if (coord.lat < -90 || coord.lat > 90) t2_success = false;
  if (coord.lng < -180 || coord.lng > 180) t2_success = false;
});
assert(t2_success, "Lat between -90 to 90 and lng between -180 to 180.");

console.log('\n🔹 TEST 3 — Graph Connectivity');
let t3_success = true;
EXPECTED_ZONES.forEach(zone => {
  if (!zoneGraph[zone] || !Array.isArray(zoneGraph[zone])) t3_success = false;
});
Object.values(zoneGraph).forEach(edges => {
  edges.forEach(edge => {
    if (!zoneGraph[edge.node] || edge.distance <= 0) t3_success = false;
  });
});
assert(t3_success, "Each zone must exist inside zoneGraph.");

console.log(`\n──────────────────────────────────────────────────`);
console.log(`  Results: ${passed}/${total} tests passed`);
console.log(`\n${passed === total ? '🎉 All tests passed' : '🚨 Tests failed'}`);
process.exit(passed === total ? 0 : 1);
