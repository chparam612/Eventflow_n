/**
 * EventFlow V2 — Crowd Heatmap Engine
 * Calculates color gradients based on density intensity.
 */

/**
 * FUNCTION 1 — calculateDensityColor(percent)
 * Maps density percentage to specific heatmap colors.
 */
export function calculateDensityColor(percent) {
  if (percent > 85) return '#C0392B'; // DARK RED
  if (percent > 60) return '#E74C3C'; // RED
  if (percent > 30) return '#F1C40F'; // YELLOW
  return '#3498DB'; // BLUE
}

/**
 * FUNCTION 2 — applyHeatmapToZones(zones, densities)
 * Calculates heatmap colors for all zones.
 */
export function applyHeatmapToZones(zones, densities) {
  const heatmapData = {};
  
  Object.keys(zones).forEach(id => {
    const d = densities[id] || 0;
    const percent = Math.round(d * 100);
    heatmapData[id] = {
      percent,
      color: calculateDensityColor(percent)
    };
  });

  return heatmapData;
}
