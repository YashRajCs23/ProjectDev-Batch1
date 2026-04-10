// src/pages/rider/RiderDashboard.jsx
// Fixes: India-only search, current location button, total fares, ride requests to driver
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import api from "../../utils/api";
import RideLayout from "../../components/common/RideLayout";

const KEY = "42275beb38a64d1486b88a378b90a008";

const CABS = [
  { id: "MINI",    label: "Mini",    icon: "🚗", cap: "Up to 4", base: 30,  perKm: 10, perMin: 1.5 },
  { id: "SEDAN",   label: "Sedan",   icon: "🚙", cap: "Up to 4", base: 50,  perKm: 14, perMin: 2.0 },
  { id: "SUV",     label: "SUV",     icon: "🚐", cap: "Up to 6", base: 80,  perKm: 18, perMin: 2.5 },
  { id: "PREMIUM", label: "Premium", icon: "🏎️", cap: "Luxury",  base: 120, perKm: 25, perMin: 3.5 },
];

const calcFare = (cab, dist, dur, shared) => {
  if (!dist || !cab) return null;
  let f = cab.base + dist * cab.perKm + (dur || 0) * cab.perMin;
  if (shared) f *= 0.55;
  return Math.round(f);
};

// Fix leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const mkIcon = (color, emoji) => new L.DivIcon({
  html: `<div style="background:${color};border:2px solid #fff;border-radius:50% 50% 50% 0;width:28px;height:28px;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4)"><span style="transform:rotate(45deg);font-size:13px">${emoji}</span></div>`,
  className: "", iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -28],
});

const pickupIcon = mkIcon("#22c55e", "🟢");
const dropIcon = mkIcon("#ef4444", "🔴");
const myLocIcon = mkIcon("#3b82f6", "📍");

// Fly map to coordinates
function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center?.[0] && center?.[1]) map.flyTo(center, zoom || 14, { duration: 0.9 });
  }, [center?.[0], center?.[1]]);
  return null;
}

// Current location button on map
function LocateButton({ onLocate }) {
  return (
    <div style={{ position: "absolute", bottom: 80, right: 12, zIndex: 1000 }}>
      <button onClick={onLocate} title="My Location"
        style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(12,12,15,0.92)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
        📍
      </button>
    </div>
  );
}

// India-specific address autocomplete
function AddressInput({ label, dotColor, value, onSelect, userLat, userLng }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (value?.address) setQuery(value.address);
    else setQuery("");
  }, [value?.address]);

  const onChange = async (q) => {
    setQuery(q);
    clearTimeout(timer.current);
    setResults([]);
    if (q.length < 2) { setOpen(false); return; }

    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        // India-specific Geoapify autocomplete
        const params = new URLSearchParams({
          text: q,
          format: "json",
          apiKey: KEY,
          limit: "8",
          filter: "countrycode:in",
          lang: "en",
        });
        // Bias toward user location or center of India
        if (userLat && userLng) {
          params.append("bias", `proximity:${userLng},${userLat}`);
        } else {
          params.append("bias", "proximity:78.9629,20.5937");
        }

        const r = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`);
        const d = await r.json();
        const items = (d.results || []).map(x => ({
          address: x.formatted,
          lat: x.lat,
          lng: x.lon,
          city: x.city || x.county || "",
          state: x.state || "",
        }));
        setResults(items);
        setOpen(items.length > 0);
      } catch { setResults([]); }
      setLoading(false);
    }, 350);
  };

  const select = (item) => {
    setQuery(item.address);
    setResults([]);
    setOpen(false);
    onSelect(item);
  };

  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", width: 9, height: 9, borderRadius: "50%", background: dotColor, boxShadow: `0 0 6px ${dotColor}88`, zIndex: 1 }} />
        <input
          value={query}
          onChange={e => onChange(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={`Search in India...`}
          style={{ width: "100%", padding: "11px 11px 11px 27px", borderRadius: 10, fontSize: 13, border: `1px solid var(--border)`, background: "var(--bg2)", color: "var(--text)" }}
        />
        {loading && (
          <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--text3)" }}>⏳</div>
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 9999, maxHeight: 240, overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.7)" }}>
          {results.map((r, i) => (
            <div key={i} onMouseDown={() => select(r)}
              style={{ padding: "9px 12px", fontSize: 13, cursor: "pointer", borderBottom: i < results.length - 1 ? "1px solid var(--border)" : "none", color: "var(--text)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
              onMouseLeave={e => e.currentTarget.style.background = ""}>
              <div style={{ fontWeight: 500 }}>📍 {r.address.split(",")[0]}</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>{r.address.split(",").slice(1).join(",").trim()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RiderDashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const nav = useNavigate();

  const [pickup, setPickup] = useState(null);
  const [drop, setDrop] = useState(null);
  const [cabType, setCabType] = useState("SEDAN");
  const [rideType, setRideType] = useState("PRIVATE");
  const [genderPref, setGenderPref] = useState("ANY");
  const [payMethod, setPayMethod] = useState("CASH");

  const [routeData, setRouteData] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [sharedRides, setSharedRides] = useState([]);
  const [booking, setBooking] = useState(false);
  const [err, setErr] = useState("");

  const [userLoc, setUserLoc] = useState(null);
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); // Center of India
  const [mapZoom, setMapZoom] = useState(5);
  const mapRef = useRef(null);

  // Get user's current location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = [pos.coords.latitude, pos.coords.longitude];
          setUserLoc(loc);
          setMapCenter(loc);
          setMapZoom(13);
        },
        () => {
          // Fallback to Delhi if GPS denied
          setMapCenter([28.6139, 77.2090]);
          setMapZoom(12);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // Fetch route when both points selected
  useEffect(() => {
    if (pickup && drop) fetchRoute();
    else setRouteData(null);
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng]);

  // Fetch shared rides
  useEffect(() => {
    if (rideType === "SHARED" && pickup && drop) fetchShared();
    else setSharedRides([]);
  }, [rideType, pickup?.lat, drop?.lat, cabType]);

  const fetchRoute = async () => {
    setLoadingRoute(true); setErr("");
    try {
      const { data } = await api.get("/rides/estimate", {
        params: {
          fromLat: pickup.lat, fromLng: pickup.lng,
          toLat: drop.lat, toLng: drop.lng,
          cabType: "SEDAN", rideType,
        },
      });
      setRouteData({ distanceKm: data.distanceKm, durationMin: data.durationMin, polyline: data.polyline });

      // Fit map to show full route
      if (data.polyline?.length > 1) {
        const lats = data.polyline.map(p => p.lat);
        const lngs = data.polyline.map(p => p.lng);
        const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        setMapCenter([midLat, midLng]);
        setMapZoom(11);
      }
    } catch (e) {
      setErr("Could not calculate route. Try again.");
      console.error(e);
    }
    setLoadingRoute(false);
  };

  const fetchShared = async () => {
    try {
      const { data } = await api.get("/rides/shared", {
        params: { lat: pickup.lat, lng: pickup.lng, dropLat: drop.lat, dropLng: drop.lng, cabType },
      });
      setSharedRides(data.rides || []);
    } catch {}
  };

  const onPickup = (p) => {
    setPickup(p);
    setMapCenter([p.lat, p.lng]);
    setMapZoom(14);
  };
  const onDrop = (d) => {
    setDrop(d);
    if (pickup) {
      setMapCenter([(pickup.lat + d.lat) / 2, (pickup.lng + d.lng) / 2]);
      setMapZoom(12);
    } else {
      setMapCenter([d.lat, d.lng]);
      setMapZoom(14);
    }
  };

  const locateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const loc = [pos.coords.latitude, pos.coords.longitude];
        setUserLoc(loc);
        setMapCenter(loc);
        setMapZoom(15);
      });
    }
  };

  const bookRide = async (existingRideId = null) => {
    if (!pickup || !drop) return setErr("Select both pickup and drop locations.");
    setBooking(true); setErr("");
    try {
      let rideId;
      if (existingRideId) {
        const { data } = await api.post(`/rides/${existingRideId}/join-shared`, {
          pickupAddress: pickup.address, pickupLat: pickup.lat, pickupLng: pickup.lng,
          dropAddress: drop.address, dropLat: drop.lat, dropLng: drop.lng,
        });
        rideId = data.ride._id;
      } else {
        const { data } = await api.post("/rides", {
          pickupAddress: pickup.address, pickupLat: pickup.lat, pickupLng: pickup.lng,
          dropAddress: drop.address, dropLat: drop.lat, dropLng: drop.lng,
          cabType, rideType, genderPreference: genderPref, paymentMethod: payMethod,
        });
        rideId = data.ride._id;
        // Emit to all online drivers
        socket?.emit("riderSearching", {
          rideId, cabType, rideType,
          pickup: { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
          fare: selectedFare,
          genderPref,
        });
      }
      nav(`/ride/track/${rideId}`);
    } catch (e) {
      setErr(e.response?.data?.message || "Booking failed. Please try again.");
    } finally { setBooking(false); }
  };

  const selectedCab = CABS.find(c => c.id === cabType);
  const selectedFare = calcFare(selectedCab, routeData?.distanceKm, routeData?.durationMin, rideType === "SHARED");
  const polyline = routeData?.polyline?.map(p => [p.lat, p.lng]) || [];

  return (
    <RideLayout>
      <div style={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>

        {/* ── Left scrollable panel ── */}
        <div style={{ width: 380, background: "var(--surface)", borderRight: "1px solid var(--border)", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "18px 16px 28px" }}>

            {/* Header */}
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontFamily: "var(--font-head)", fontSize: 26, color: "var(--accent)", letterSpacing: 1, marginBottom: 1 }}>BOOK A RIDE</h2>
              <p style={{ color: "var(--text3)", fontSize: 12 }}>Hello, {user?.name?.split(" ")[0]} 👋 · India</p>
            </div>

            {/* Ride type */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, background: "var(--bg2)", borderRadius: 10, padding: 4 }}>
              {[["PRIVATE", "🚗 Private"], ["SHARED", "👥 Share Cab"]].map(([v, l]) => (
                <button key={v} onClick={() => setRideType(v)}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: rideType === v ? "var(--surface2)" : "transparent", color: rideType === v ? "var(--accent)" : "var(--text3)", fontWeight: rideType === v ? 700 : 400, fontSize: 13, cursor: "pointer" }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Address inputs */}
            <AddressInput label="Pickup Location" dotColor="#22c55e" value={pickup} onSelect={onPickup} userLat={userLoc?.[0]} userLng={userLoc?.[1]} />
            <AddressInput label="Drop Location" dotColor="#ef4444" value={drop} onSelect={onDrop} userLat={userLoc?.[0]} userLng={userLoc?.[1]} />

            {/* Route loading */}
            {loadingRoute && (
              <div style={{ textAlign: "center", padding: "12px 0", fontSize: 13, color: "var(--text3)" }}>
                ⏳ Calculating route & fares...
              </div>
            )}

            {/* ── All 4 cab types with TOTAL fares ── */}
            <div style={{ marginTop: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                {routeData ? `Select Cab · ${routeData.distanceKm} km · ${routeData.durationMin} min` : "Select Cab Type"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {CABS.map(c => {
                  const fare = calcFare(c, routeData?.distanceKm, routeData?.durationMin, rideType === "SHARED");
                  const active = cabType === c.id;
                  return (
                    <div key={c.id} onClick={() => setCabType(c.id)}
                      style={{ padding: "10px 9px", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent-dim)" : "var(--bg2)", position: "relative", transition: "all 0.12s" }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = "rgba(245,197,24,0.4)"; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = "var(--border)"; }}
                    >
                      {active && <div style={{ position: "absolute", top: 5, right: 6, fontSize: 10, color: "var(--accent)" }}>✓</div>}
                      <div style={{ fontSize: 18, marginBottom: 3 }}>{c.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: active ? "var(--accent)" : "var(--text)", marginBottom: 1 }}>{c.label}</div>
                      <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 5 }}>{c.cap}</div>

                      {/* Total fare if route available, else per-km rate */}
                      {fare ? (
                        <div>
                          <div style={{ fontSize: 17, fontWeight: 800, color: active ? "var(--accent)" : "var(--text)", lineHeight: 1 }}>₹{fare}</div>
                          <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 2 }}>
                            {rideType === "SHARED" ? "45% off · " : ""}total
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, fontWeight: 700, color: active ? "var(--accent)" : "var(--text2)" }}>₹{c.perKm}/km</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Summary bar */}
              {selectedFare && routeData && (
                <div style={{ marginTop: 10, background: "var(--bg2)", borderRadius: 10, padding: "11px 14px", border: `1px solid var(--accent)44`, display: "flex", justifyContent: "space-around" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: 20, color: "var(--accent)" }}>₹{selectedFare}</div>
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>Total Fare</div>
                  </div>
                  <div style={{ width: 1, background: "var(--border)" }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{routeData.distanceKm}</div>
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>km</div>
                  </div>
                  <div style={{ width: 1, background: "var(--border)" }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{routeData.durationMin}</div>
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>min</div>
                  </div>
                  {rideType === "SHARED" && (
                    <>
                      <div style={{ width: 1, background: "var(--border)" }} />
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--green)" }}>45%</div>
                        <div style={{ fontSize: 10, color: "var(--text3)" }}>saved</div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Gender preference */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>Driver Gender</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["ANY", "👤 Any"], ["MALE_ONLY", "👨 Male"], ["FEMALE_ONLY", "👩 Female"]].map(([v, l]) => (
                  <button key={v} onClick={() => setGenderPref(v)}
                    style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: `1px solid ${genderPref === v ? "var(--accent)" : "var(--border)"}`, background: genderPref === v ? "var(--accent-dim)" : "var(--bg2)", color: genderPref === v ? "var(--accent)" : "var(--text2)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Shared rides matches */}
            {rideType === "SHARED" && sharedRides.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>
                  {sharedRides.length} Shared Ride{sharedRides.length > 1 ? "s" : ""} Available
                </div>
                {sharedRides.slice(0, 3).map(ride => {
                  const pct = ride.matchScore?.routeMatch || 0;
                  return (
                    <div key={ride._id} onClick={() => bookRide(ride._id)}
                      style={{ padding: "9px 11px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg2)", marginBottom: 7, cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--green)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{ride.pickup?.address?.split(",")[0]}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: pct >= 80 ? "var(--green)" : "var(--accent)" }}>{pct}%</span>
                      </div>
                      <div style={{ height: 3, background: "var(--border)", borderRadius: 2 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: pct >= 80 ? "var(--green)" : "var(--accent)", borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4 }}>{ride.riders?.length}/{ride.maxRiders} passengers · Tap to join</div>
                    </div>
                  );
                })}
              </div>
            )}
            {rideType === "SHARED" && pickup && drop && sharedRides.length === 0 && !loadingRoute && (
              <div style={{ marginBottom: 12, padding: "10px 12px", background: "rgba(245,197,24,0.06)", border: "1px solid rgba(245,197,24,0.2)", borderRadius: 9, fontSize: 12, color: "var(--text2)" }}>
                No shared rides on this route yet. Book one and others can join!
              </div>
            )}

            {/* Payment */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>Payment</div>
              <div style={{ display: "flex", gap: 7 }}>
                {[["CASH", "💵 Cash"], ["RAZORPAY", "💳 Online"]].map(([v, l]) => (
                  <button key={v} onClick={() => setPayMethod(v)}
                    style={{ flex: 1, padding: "9px", borderRadius: 9, border: `1px solid ${payMethod === v ? "var(--accent)" : "var(--border)"}`, background: payMethod === v ? "var(--accent-dim)" : "var(--bg2)", color: payMethod === v ? "var(--accent)" : "var(--text2)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {err && (
              <div style={{ padding: "9px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, color: "var(--red)", fontSize: 12, marginBottom: 12 }}>
                ⚠️ {err}
              </div>
            )}

            {/* Book button */}
            <button onClick={() => bookRide()} disabled={booking || !pickup || !drop}
              style={{ width: "100%", padding: "14px", background: !pickup || !drop ? "rgba(245,197,24,0.15)" : booking ? "rgba(245,197,24,0.5)" : "var(--accent)", border: "none", borderRadius: 12, color: !pickup || !drop ? "rgba(245,197,24,0.35)" : "#000", fontSize: 14, fontWeight: 800, cursor: !pickup || !drop ? "not-allowed" : "pointer", transition: "all 0.15s" }}>
              {booking ? "⏳ Booking..." : !pickup ? "Enter pickup location first" : !drop ? "Enter drop location" : selectedFare ? `🚗 Book ${cabType} · ₹${selectedFare}` : `🚗 Book ${rideType === "SHARED" ? "Shared" : "Private"} Ride`}
            </button>
          </div>
        </div>

        {/* ── Map ── */}
        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: "100%", width: "100%" }} ref={mapRef}>
            <TileLayer
              url={`https://maps.geoapify.com/v1/tile/osm-bright-smooth/{z}/{x}/{y}.png?apiKey=${KEY}`}
              attribution='© <a href="https://www.geoapify.com/">Geoapify</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={20}
            />
            <FlyTo center={mapCenter} zoom={mapZoom} />
            {userLoc && (
              <Marker position={userLoc} icon={myLocIcon}>
                <Popup>📍 You are here</Popup>
              </Marker>
            )}
            {pickup && (
              <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
                <Popup><strong>🟢 Pickup</strong><br />{pickup.address}</Popup>
              </Marker>
            )}
            {drop && (
              <Marker position={[drop.lat, drop.lng]} icon={dropIcon}>
                <Popup><strong>🔴 Drop</strong><br />{drop.address}</Popup>
              </Marker>
            )}
            {polyline.length > 1 && (
              <Polyline positions={polyline} color="#f5c518" weight={5} opacity={0.9} />
            )}
          </MapContainer>

          {/* Current location button */}
          <LocateButton onLocate={locateMe} />

          {/* Fare overlay on map */}
          {selectedFare && routeData && (
            <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(12,12,15,0.92)", backdropFilter: "blur(14px)", borderRadius: 12, padding: "12px 16px", border: "1px solid rgba(245,197,24,0.2)", zIndex: 1000, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>{cabType} · {rideType}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>₹{selectedFare}</div>
              <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 3 }}>{routeData.distanceKm} km · {routeData.durationMin} min</div>
            </div>
          )}
        </div>
      </div>
    </RideLayout>
  );
}
