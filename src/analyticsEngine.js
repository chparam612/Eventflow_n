/**
 * EventFlow V2 — Analytics Engine
 * Provides real-time metrics for crowd behavior, density, and wait times.
 */

export function calculateTotalVisitors(zones) {
  return zones.reduce((total, zone) => {
    return total + (zone.currentFans || 0);
  }, 0);
}

export function calculateAverageDensity(zones) {
  if (!zones || zones.length === 0) return 0;
  let totalPercent = 0;
  let validZones = 0;

  zones.forEach(zone => {
    const capacity = zone.capacity || 1000;
    const currentFans = zone.currentFans || 0;
    if (capacity > 0) {
      totalPercent += (currentFans / capacity) * 100;
      validZones++;
    }
  });

  return validZones > 0 ? Math.round(totalPercent / validZones) : 0;
}

export function findPeakZone(zones) {
  if (!zones || zones.length === 0) return { zoneId: null, densityPercent: 0 };
  
  let peakZone = null;
  let maxDensity = -1;

  zones.forEach(zone => {
    const capacity = zone.capacity || 1000;
    const currentFans = zone.currentFans || 0;
    const densityPercent = capacity > 0 ? (currentFans / capacity) * 100 : 0;
    
    if (densityPercent > maxDensity) {
      maxDensity = densityPercent;
      peakZone = zone.id;
    }
  });

  return {
    zoneId: peakZone,
    densityPercent: Math.round(maxDensity)
  };
}

export function calculateGateUtilization(zones) {
  return zones
    .filter(zone => zone.id !== 'parking' && zone.id !== 'gates') // Only evaluate actual stands/concourses
    .map(zone => {
    const capacity = zone.capacity || 1000;
    const currentFans = zone.currentFans || 0;
    const utilizationPercent = capacity > 0 ? (currentFans / capacity) * 100 : 0;
    return {
      zoneId: zone.id,
      utilizationPercent: Math.round(utilizationPercent)
    };
  });
}

export function estimateAverageWaitTime(zones) {
  if (!zones || zones.length === 0) return 0;
  
  let totalWaitTime = 0;
  let exitZonesCount = 0;

  zones.forEach(zone => {
    const currentFans = zone.currentFans || 0;
    // Default exit rate is 20 if missing, to prevent divide-by-zero
    const exitRate = zone.exitRate && zone.exitRate > 0 ? zone.exitRate : 20;
    
    if (currentFans > 0 && zone.id !== 'parking' && zone.id !== 'gates') {
      totalWaitTime += (currentFans / exitRate);
      exitZonesCount++;
    }
  });

  return exitZonesCount > 0 ? Math.round(totalWaitTime / exitZonesCount) : 0;
}
