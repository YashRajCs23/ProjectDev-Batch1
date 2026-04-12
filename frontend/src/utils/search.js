// src/utils/search.js — Multi-provider India place search using Nominatim + Geoapify

const GEO_KEY = "42275beb38a64d1486b88a378b90a008";

/**
 * Search Indian places.
 * Primary: OpenStreetMap Nominatim (indexes ALL temples, shrines, landmarks)
 * Fallback: Geoapify (better address autocomplete)
 */
export async function searchIndiaPlaces(query, userLat, userLng) {
  const q = query.trim();
  if (q.length < 2) return [];

  // Run both in parallel, use whichever returns first with results
  try {
    const [nomRes, geoRes] = await Promise.allSettled([
      nominatim(q, userLat, userLng),
      geoapify(q, userLat, userLng),
    ]);

    const nom = nomRes.status === "fulfilled" ? nomRes.value : [];
    const geo = geoRes.status === "fulfilled" ? geoRes.value : [];

    // Combine: Nominatim first (better POI coverage), then unique Geoapify results
    const combined = [...nom];
    for (const g of geo) {
      const isDupe = combined.some(c =>
        Math.abs(c.lat - g.lat) < 0.004 && Math.abs(c.lng - g.lng) < 0.004
      );
      if (!isDupe) combined.push(g);
    }

    return combined.slice(0, 8);
  } catch {
    return [];
  }
}

/** OpenStreetMap Nominatim search — best for Indian POIs */
async function nominatim(query, userLat, userLng) {
  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      addressdetails: "1",
      limit: "6",
      countrycodes: "in",
      "accept-language": "en",
    });

    if (userLat && userLng) {
      // Soft bias (bounded=0 means prefer but don't restrict)
      params.set("viewbox", `${userLng - 3},${userLat + 3},${userLng + 3},${userLat - 3}`);
      params.set("bounded", "0");
    }

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "RideBook/1.0" },
    });

    if (!res.ok) return [];
    const data = await res.json();

    return (data || []).map(x => ({
      address: buildAddress(x),
      lat: parseFloat(x.lat),
      lng: parseFloat(x.lon),
    })).filter(x => !isNaN(x.lat) && !isNaN(x.lng));
  } catch {
    return [];
  }
}

function buildAddress(x) {
  const a = x.address || {};
  const parts = [];
  if (x.name && x.name.length > 0) parts.push(x.name);
  const sub = a.neighbourhood || a.suburb || a.quarter;
  if (sub && sub !== x.name) parts.push(sub);
  const city = a.city || a.town || a.village || a.county;
  if (city && city !== x.name) parts.push(city);
  if (a.state) parts.push(a.state);
  return parts.length > 0 ? parts.join(", ") : (x.display_name || "").split(",").slice(0, 3).join(",").trim();
}

/** Geoapify autocomplete */
async function geoapify(query, userLat, userLng) {
  try {
    const bias = (userLat && userLng)
      ? `proximity:${userLng},${userLat}`
      : "proximity:78.9629,20.5937";

    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=5&filter=countrycode:in&lang=en&bias=${bias}&format=json&apiKey=${GEO_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();

    return (data.results || []).map(x => ({
      address: x.formatted,
      lat: x.lat,
      lng: x.lon,
    }));
  } catch {
    return [];
  }
}

/** Reverse geocode coordinates → address string */
export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { "User-Agent": "RideBook/1.0" } }
    );
    if (!res.ok) throw new Error();
    const data = await res.json();
    return buildAddress(data) || data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    // Fallback to Geoapify reverse
    try {
      const res = await fetch(
        `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&format=json&apiKey=${GEO_KEY}`
      );
      const data = await res.json();
      return data.results?.[0]?.formatted || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }
}
