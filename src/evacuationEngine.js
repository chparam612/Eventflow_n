/**
 * EventFlow V2 — Evacuation Time Engine
 * Calculates real-time evacuation durations and ranks safe exits.
 */

/**
 * FUNCTION 1 — calculateEvacuationTime(zone)
 * Logic: time = currentFans / exitRate
 */
export function calculateEvacuationTime(zoneData) {
  const { id, currentFans = 0, exitRate = 20, blocked = false } = zoneData;

  if (blocked) {
    return {
      id,
      time: Infinity,
      status: "BLOCKED"
    };
  }

  // Prevent divide-by-zero
  const safeExitRate = exitRate > 0 ? exitRate : 20;
  const time = Math.ceil(currentFans / safeExitRate);

  return {
    id,
    time,
    status: "ACTIVE"
  };
}

/**
 * FUNCTION 2 — rankBestExit(zones, densities, blockedZoneId = null)
 * Logic: Sorts zones by evacuation time (lowest first)
 */
export function rankBestExit(zones, densities, blockedZoneId = null) {
  const estimates = Object.entries(zones)
    .filter(([id]) => id !== 'parking' && id !== 'gates') // Exclude non-exit zones
    .map(([id, z]) => {
      const density = densities[id] || 0;
      const currentFans = density * (z.cap || 10000);
      const isBlocked = (id === blockedZoneId);
      
      return calculateEvacuationTime({
        id,
        currentFans,
        exitRate: z.exitRate || 20,
        blocked: isBlocked
      });
    });

  // Sort by time (Infinity/Blocked goes to end)
  const rankedList = estimates.sort((a, b) => a.time - b.time);
  
  const recommended = rankedList.find(e => e.status === "ACTIVE");

  return {
    recommendedGate: recommended ? recommended.id : null,
    rankedList
  };
}
