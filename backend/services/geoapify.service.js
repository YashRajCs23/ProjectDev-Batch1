import axios from "axios";

const KEY = process.env.GEOAPIFY_API_KEY || "42275beb38a64d1486b88a378b90a008";
const BASE_GEO   = "https://api.geoapify.com/v1/geocode";
const BASE_ROUTE = "https://api.geoapify.com/v1/routing";

/**
 * Geocode a text address → { lat, lng, address }
 */
export const geocodeAddress = async (text) => {
  const { data } = await axios.get(`${BASE_GEO}/search`, {
    params: { text, format: "json", apiKey: KEY, limit: 1, filter: "countrycode:in" },
  });
  if (!data.results?.length) throw new Error(`Address not found: ${text}`);
  const r = data.results[0];
  return { lat: r.lat, lng: r.lon, address: r.formatted };
};

/**
 * Get route between two coordinates.
 * Handles both LineString and MultiLineString from Geoapify.
 * Returns { distanceKm, durationMin, polyline: [{lat,lng}] }
 */
export const getRoute = async (fromLat, fromLng, toLat, toLng) => {
  // Validate inputs
  if (!fromLat || !fromLng || !toLat || !toLng) {
    throw new Error("Invalid coordinates for routing.");
  }

  try {
    const { data } = await axios.get(BASE_ROUTE, {
      params: {
        waypoints: `${fromLat},${fromLng}|${toLat},${toLng}`,
        mode: "drive",
        apiKey: KEY,
      },
      timeout: 10000,
    });

    const feature = data?.features?.[0];
    if (!feature) {
      // Fallback: estimate distance using Haversine if route API fails
      return haversineFallback(fromLat, fromLng, toLat, toLng);
    }

    const props = feature.properties;
    const distanceKm = parseFloat((props.distance / 1000).toFixed(2));
    const durationMin = Math.max(1, Math.ceil((props.time || props.duration || 0) / 60));

    // Handle both LineString and MultiLineString geometries
    const geom = feature.geometry;
    let polyline = [];

    if (geom?.type === "MultiLineString") {
      // Flatten all segments
      for (const segment of geom.coordinates) {
        for (const [lng, lat] of segment) {
          polyline.push({ lat, lng });
        }
      }
    } else if (geom?.type === "LineString") {
      polyline = (geom.coordinates || []).map(([lng, lat]) => ({ lat, lng }));
    } else {
      // No geometry — just use straight line between points
      polyline = [
        { lat: fromLat, lng: fromLng },
        { lat: toLat, lng: toLng },
      ];
    }

    return { distanceKm, durationMin, polyline };
  } catch (err) {
    // If routing API fails entirely, use Haversine estimate
    console.warn("Routing API failed, using distance estimate:", err.message);
    return haversineFallback(fromLat, fromLng, toLat, toLng);
  }
};

/**
 * Fallback: estimate distance using Haversine formula when API fails.
 */
const haversineFallback = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const distanceKm = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3).toFixed(2)); // 1.3 = road factor
  const durationMin = Math.max(1, Math.ceil((distanceKm / 40) * 60)); // assume 40 km/h avg

  return {
    distanceKm,
    durationMin,
    polyline: [
      { lat: lat1, lng: lng1 },
      { lat: lat2, lng: lng2 },
    ],
  };
};

/**
 * India-specific autocomplete — searches within India only.
 * Also handles famous landmarks by name.
 */
export const autocomplete = async (text, lat, lng) => {
  try {
    const params = {
      text,
      format: "json",
      apiKey: KEY,
      limit: 8,
      filter: "countrycode:in",  // Restrict to India
      lang: "en",
    };

    // Bias toward user's location if provided
    if (lat && lng) {
      params.bias = `proximity:${lng},${lat}`;
    } else {
      // Default bias toward center of India
      params.bias = "proximity:78.9629,20.5937";
    }

    const { data } = await axios.get(`${BASE_GEO}/autocomplete`, { params, timeout: 8000 });
    return (data.results || []).map((r) => ({
      address: r.formatted,
      lat: r.lat,
      lng: r.lon,
    }));
  } catch (err) {
    console.error("Autocomplete error:", err.message);
    return [];
  }
};