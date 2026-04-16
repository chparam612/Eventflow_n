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

console.log('\n🟢 MAP RENDERING TESTS');

const EXPECTED_ZONES = ['north', 'south', 'east', 'west', 'concN', 'concS', 'gates', 'parking'];

console.log('\n🔹 TEST 1 — All Zones Have Coordinates');
let t1_success = true;
EXPECTED_ZONES.forEach(zone => {
  if (!zoneCoordinates[zone]) t1_success = false;
  else {
    if (typeof zoneCoordinates[zone].lat !== 'number') t1_success = false;
    if (typeof zoneCoordinates[zone].lng !== 'number') t1_success = false;
  }
});
assert(t1_success, "All expected zones possess valid lat/lng coordinate definitions.");

console.log('\n🔹 TEST 2 — All Routes Have Valid Path');
let t2_success = true;
Object.keys(zoneGraph).forEach(zoneId => {
  const connections = zoneGraph[zoneId];
  connections.forEach(connection => {
    const start = zoneCoordinates[zoneId];
    const end = zoneCoordinates[connection.node];
    
    if (!start || !start.lat || !start.lng) t2_success = false;
    if (!end || !end.lat || !end.lng) t2_success = false;
  });
});
assert(t2_success, "All connected routes logically map to valid underlying coordinates.");

console.log(`\n──────────────────────────────────────────────────`);
console.log(`  Results: ${passed}/${total} tests passed`);
console.log(`\n${passed === total ? '🎉 All tests passed' : '🚨 Tests failed'}`);
process.exit(passed === total ? 0 : 1);
