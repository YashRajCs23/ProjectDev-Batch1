// services/geoapify.service.js — Wrapper for Geoapify APIs
import axios from "axios";

const KEY = process.env.GEOAPIFY_API_KEY;
const BASE_GEO = "https://api.geoapify.com/v1/geocode";
const BASE_ROUTE = "https://api.geoapify.com/v1/routing";

/**
 * Geocode an address to coordinates.
 */
export const geocodeAddress = async (text) => {
  const { data } = await axios.get(`${BASE_GEO}/search`, {
    params: { text, format: "json", apiKey: KEY, limit: 1 },
  });
  if (!data.results?.length) throw new Error("Address not found.");
  const r = data.results[0];
  return { lat: r.lat, lng: r.lon, address: r.formatted };
};

/**
 * Get route between two coordinates.
 * Returns { distanceKm, durationMin, polyline: [{lat,lng}] }
 */
export const getRoute = async (fromLat, fromLng, toLat, toLng) => {
  const waypoints = `${fromLat},${fromLng}|${toLat},${toLng}`;
  const { data } = await axios.get(BASE_ROUTE, {
    params: { waypoints, mode: "drive", apiKey: KEY },
  });

  const feature = data?.features?.[0];
  if (!feature) throw new Error("Route not found.");

  const props = feature.properties;
  const distanceKm = (props.distance / 1000).toFixed(2);
  const durationMin = Math.ceil(props.time / 60);

  // Decode polyline coordinates from GeoJSON
  const coords = feature.geometry?.coordinates || [];
  const polyline = coords.map(([lng, lat]) => ({ lat, lng }));

  return { distanceKm: parseFloat(distanceKm), durationMin, polyline };
};

/**
 * Autocomplete addresses (for frontend, but can be called from backend too).
 */
export const autocomplete = async (text, lat, lng) => {
  const params = { text, format: "json", apiKey: KEY, limit: 5 };
  if (lat && lng) { params.bias = `proximity:${lng},${lat}`; }
  const { data } = await axios.get(`${BASE_GEO}/autocomplete`, { params });
  return (data.results || []).map((r) => ({
    address: r.formatted,
    lat: r.lat,
    lng: r.lon,
  }));
};
