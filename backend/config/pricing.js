export const PRICING = {
  MINI:    { base: 30, perKm: 10, perMin: 1.5, name: "Mini",    capacity: 4 },
  SEDAN:   { base: 50, perKm: 14, perMin: 2.0, name: "Sedan",   capacity: 4 },
  SUV:     { base: 80, perKm: 18, perMin: 2.5, name: "SUV",     capacity: 6 },
  PREMIUM: { base: 120, perKm: 25, perMin: 3.5, name: "Premium", capacity: 4 },
};

// Shared ride discount (riders pay less since seat is split)
export const SHARED_DISCOUNT = 0.55; // 45% off base fare

/**
 * Calculate fare for a ride.
 * @param {string} cabType - MINI | SEDAN | SUV | PREMIUM
 * @param {number} distanceKm - distance in km
 * @param {number} durationMin - estimated duration in minutes
 * @param {boolean} isShared - shared ride?
 * @param {number} surgeMultiplier - 1.0 = normal
 */
export const calculateFare = (cabType, distanceKm, durationMin = 0, isShared = false, surgeMultiplier = 1.0) => {
  const rate = PRICING[cabType] || PRICING.MINI;
  let fare = rate.base + distanceKm * rate.perKm + durationMin * rate.perMin;
  if (isShared) fare *= SHARED_DISCOUNT;
  fare *= surgeMultiplier;
  return Math.round(fare); // Round to nearest INR
};
