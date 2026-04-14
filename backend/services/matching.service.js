const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const routeLen = (coords) => {
  let d = 0;
  for (let i = 0; i < coords.length - 1; i++)
    d += haversine(coords[i].lat, coords[i].lng, coords[i + 1].lat, coords[i + 1].lng);
  return d;
};

export const calcRouteMatch = (rideCoords, riderPickup, riderDrop) => {
  if (!rideCoords?.length) {
    const pd = haversine(riderPickup.lat, riderPickup.lng, rideCoords?.[0]?.lat || 0, rideCoords?.[0]?.lng || 0);
    return Math.max(0, Math.round((1 - pd / 10) * 100));
  }
  const total = routeLen(rideCoords);
  if (total === 0) return 100;

  let pIdx = 0, dIdx = 0, pMin = Infinity, dMin = Infinity;
  rideCoords.forEach((c, i) => {
    const pd = haversine(c.lat, c.lng, riderPickup.lat, riderPickup.lng);
    const dd = haversine(c.lat, c.lng, riderDrop.lat, riderDrop.lng);
    if (pd < pMin) { pMin = pd; pIdx = i; }
    if (dd < dMin) { dMin = dd; dIdx = i; }
  });

  if (pIdx >= dIdx) return 0;
  const common = routeLen(rideCoords.slice(pIdx, dIdx + 1));
  return Math.min(100, Math.round((common / total) * 100));
};

export const calcMatchScore = ({ ride, riderPickup, riderDrop, requestedTime, riderGender }) => {
  const routeMatch = calcRouteMatch(ride.routeCoordinates, riderPickup, riderDrop);

  const timeDiff = Math.abs(new Date(ride.departureTime) - new Date(requestedTime)) / 60000;
  const timeMatch = timeDiff <= 15 ? 100 : timeDiff <= 30 ? 80 : timeDiff <= 60 ? 50 : 20;

  let prefMatch = 100;
  if (ride.genderPreference === "MALE_ONLY" && riderGender !== "MALE") prefMatch = 0;
  if (ride.genderPreference === "FEMALE_ONLY" && riderGender !== "FEMALE") prefMatch = 0;

  if (prefMatch === 0) return { score: 0, routeMatch, timeMatch, prefMatch, disqualified: true };

  const score = Math.round(routeMatch * 0.6 + timeMatch * 0.2 + prefMatch * 0.2);
  return { score, routeMatch, timeMatch, prefMatch, disqualified: false };
};
