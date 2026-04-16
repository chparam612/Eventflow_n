export const zoneCoordinates = {
  north: {
    lat: 23.0932,
    lng: 72.5972
  },
  south: {
    lat: 23.0903,
    lng: 72.5972
  },
  east: {
    lat: 23.0918,
    lng: 72.5988
  },
  west: {
    lat: 23.0918,
    lng: 72.5956
  },
  concN: {
    lat: 23.0926,
    lng: 72.5972
  },
  concS: {
    lat: 23.0910,
    lng: 72.5972
  },
  gates: {
    lat: 23.0940,
    lng: 72.5978
  },
  parking: {
    lat: 23.0955,
    lng: 72.5995
  }
};

export function getZonePosition(zoneId) {
  return zoneCoordinates[zoneId] || {
    lat: 23.0918,
    lng: 72.5972
  };
}
