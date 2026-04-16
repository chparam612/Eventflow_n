/**
 * EventFlow V2 — Emergency Evacuation Engine
 * Manages safety-critical routing and evacuation logic.
 */

/**
 * FUNCTION 1 — activateEmergency(type, zone)
 * Marks a zone as blocked and triggers timestamped state.
 */
export function activateEmergency(type, zoneId) {
  const allowedTypes = ["FIRE", "MEDICAL", "SECURITY"];
  if (!allowedTypes.includes(type)) {
    throw new Error(`Invalid emergency type: ${type}`);
  }

  return {
    active: true,
    type,
    zone: zoneId,
    timestamp: Date.now()
  };
}

/**
 * FUNCTION 2 — calculateEvacuationRoutes(zones, blockedZoneId)
 * Finds safest alternative zones.
 * Logic: Exclude blocked zone, prioritize low density zones.
 */
export function calculateEvacuationRoutes(zones, densities, blockedZoneId) {
  const candidates = Object.keys(zones).filter(id => id !== blockedZoneId && id !== 'parking' && id !== 'gates');
  
  // Sort by density (ascending) to find 'safest' paths
  const sorted = candidates.sort((a, b) => (densities[a] || 0) - (densities[b] || 0));
  
  return {
    safeRoutes: sorted.slice(0, 2) // Return top 2 safest zones
  };
}

/**
 * FUNCTION 3 — getEmergencyMessage(type, blockedZoneName, safeZoneName)
 * Formats critical alert text for broadcast.
 */
export function getEmergencyMessage(type, blockedZoneName, safeZoneName) {
  return `🚨 EMERGENCY ALERT: ${type} detected in ${blockedZoneName}. Avoid this area. Proceed to ${safeZoneName}. Follow staff instructions.`;
}
