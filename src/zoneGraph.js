export const zoneGraph = {
  north: [
    { node: "concN", distance: 1.0 },
    { node: "east", distance: 2.5 },
    { node: "west", distance: 2.5 }
  ],
  south: [
    { node: "concS", distance: 1.0 },
    { node: "east", distance: 2.3 },
    { node: "west", distance: 2.3 }
  ],
  east: [
    { node: "concN", distance: 1.2 },
    { node: "concS", distance: 1.2 },
    { node: "gates", distance: 2.8 }
  ],
  west: [
    { node: "concN", distance: 1.2 },
    { node: "concS", distance: 1.2 },
    { node: "gates", distance: 2.8 }
  ],
  concN: [
    { node: "gates", distance: 1.6 },
    { node: "concS", distance: 2.7 }
  ],
  concS: [
    { node: "gates", distance: 1.6 }
  ],
  gates: [
    { node: "parking", distance: 2.4 }
  ],
  parking: []
};
