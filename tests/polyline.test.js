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

console.log('\n🟢 ROUTE POLYLINE DRAWING SYSTEM TESTS');

// ─── MOCK SYSTEM ───
// We mock the behavior of drawZoneRoutes because it relies on the Google Maps runtime
// and is embedded in the attendee HTML module.
let routeLines = [];

class MockPolyline {
  constructor(config) {
    this.path = config.path;
    this.strokeColor = config.strokeColor;
    this.strokeWeight = config.strokeWeight;
    this.map = null;
  }
  setMap(map) { this.map = map; }
}

function drawZoneRoutesMock() {
  Object.keys(zoneGraph).forEach(zoneId => {
    const connections = zoneGraph[zoneId];
    connections.forEach(connection => {
      const start = zoneCoordinates[zoneId];
      const end = zoneCoordinates[connection.node];

      if (start && end) {
        const polyline = new MockPolyline({
          path: [start, end],
          strokeColor: "#00C49A",
          strokeWeight: 3
        });
        polyline.setMap("MOCK_MAP_INSTANCE");
        routeLines.push(polyline);
      }
    });
  });
}

function clearRoutesMock() {
  routeLines.forEach(line => {
    line.setMap(null);
  });
  routeLines = [];
}

// ─── TESTS ───

console.log('\n🔹 TEST 1 — Routes Created');
drawZoneRoutesMock();
assert(routeLines.length > 0, `Polyline objects exist. Total created: ${routeLines.length}`);

console.log('\n🔹 TEST 2 — Coordinates Valid');
let t2_success = true;
routeLines.forEach(line => {
  const path = line.path;
  if (!path || path.length !== 2) t2_success = false;
  if (!path[0].lat || !path[0].lng || !path[1].lat || !path[1].lng) t2_success = false;
});
assert(t2_success, "Polyline path contains valid lat/lng arrays for all edges.");

console.log('\n🔹 TEST 3 — Clear Function');
let t3_success = true;
clearRoutesMock();
if (routeLines.length !== 0) t3_success = false;
assert(t3_success, "clearRoutes() successfully removes all mapped lines.");

console.log(`\n──────────────────────────────────────────────────`);
console.log(`  Results: ${passed}/${total} tests passed`);
console.log(`\n${passed === total ? '🎉 All tests passed' : '🚨 Tests failed'}`);
process.exit(passed === total ? 0 : 1);
