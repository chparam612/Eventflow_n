export const zoneGraph = {
  north: [
    { node: "concN", distance: 1 }
  ],
  south: [
    { node: "concS", distance: 1 }
  ],
  east: [
    { node: "concN", distance: 1 },
    { node: "concS", distance: 1 }
  ],
  west: [
    { node: "concN", distance: 1 },
    { node: "concS", distance: 1 }
  ],
  concN: [
    { node: "gates", distance: 2 }
  ],
  concS: [
    { node: "gates", distance: 2 }
  ],
  gates: [
    { node: "parking", distance: 3 }
  ],
  parking: []
};
