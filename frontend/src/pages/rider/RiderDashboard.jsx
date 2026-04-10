// src/pages/rider/RiderDashboard.jsx — FIXED VERSION
// Fixes: modern map, all cab fares shown, scrollable, forbidden booking fix
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import api from "../../utils/api";
import RideLayout from "../../components/common/RideLayout";

const GEOAPIFY_KEY = "42275beb38a64d1486b88a378b90a008";

const CAB_TYPES = [
  { id: "MINI",    label: "Mini",    icon: "🚗", desc: "Up to 4",  base: 30, perKm: 10, perMin: 1.5 },
  { id: "SEDAN",   label: "Sedan",   icon: "🚙", desc: "Up to 4",  base: 50, perKm: 14, perMin: 2.0 },
  { id: "SUV",     label: "SUV",     icon: "🚐", desc: "Up to 6",  base: 80, perKm: 18, perMin: 2.5 },
  { id: "PREMIUM", label: "Premium", icon: "🏎️", desc: "Luxury 4", base: 120, perKm: 25, perMin: 3.5 },
];

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const pickupIcon = new L.DivIcon({
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 10px #22c55e88"></div>`,
  className: "", iconSize: [16, 16], iconAnchor: [8, 8],
});
const dropIcon = new L.DivIcon({
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 0 10px #ef444488"></div>`,
  className: "", iconSize: [16, 16], iconAnchor: [8, 8],
});

function MapFlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, zoom || 14, { duration: 1.0 }); }, [JSON.stringify(center)]);
  return null;
}

function AddressInput({ label, dotColor, value, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  useEffect(() => { if (value?.address) setQuery(value.address); else setQuery(""); }, [value?.address]);

  const onChange = (q) => {
    setQuery(q);
    clearTimeout(timer.current);
    if (q.length < 3) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&limit=6&format=json&apiKey=${GEOAPIFY_KEY}`);
        const d = await r.json();
        setResults((d.results || []).map(x => ({ address: x.formatted, lat: x.lat, lng: x.lon })));
        setOpen(true);
      } catch { setResults([]); }
    }, 350);
  };

  const select = (item) => { setQuery(item.address); setResults([]); setOpen(false); onSelect(item); };

  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 5 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 10, height: 10, borderRadius: "50%", background: dotColor, boxShadow: `0 0 8px ${dotColor}` }} />
        <input value={query} onChange={e => onChange(e.target.value)} onFocus={() => results.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={`Search ${label.toLowerCase()}...`}
          style={{ width: "100%", padding: "11px 11px 11px 28px", borderRadius: 10, fontSize: 14, border: `1px solid var(--border)`, background: "var(--bg2)" }} />
      </div>
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 9999, maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          {results.map((r, i) => (
            <div key={i} onMouseDown={() => select(r)}
              style={{ padding: "9px 12px", fontSize: 13, cursor: "pointer", borderBottom: i < results.length - 1 ? "1px solid var(--border)" : "none", color: "var(--text)", lineHeight: 1.4 }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
              onMouseLeave={e => e.currentTarget.style.background = ""}>
              📍 {r.address}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const calcFare = (cab, dist, dur, isShared) => {
  if (!dist) return null;
  let f = cab.base + dist * cab.perKm + dur * cab.perMin;
  if (isShared) f *= 0.55;
  return Math.round(f);
};

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
  const [routeData, setRouteData] = useState(null); // { distanceKm, durationMin, polyline }
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [sharedRides, setSharedRides] = useState([]);
  const [booking, setBooking] = useState(false);
  const [err, setErr] = useState("");
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090]);
  const [mapZoom, setMapZoom] = useState(12);

  useEffect(() => {
    if (pickup && drop) fetchRoute();
    else setRouteData(null);
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng]);

  useEffect(() => {
    if (rideType === "SHARED" && pickup && drop) fetchSharedRides();
    else setSharedRides([]);
  }, [rideType, pickup?.lat, drop?.lat]);

  const fetchRoute = async () => {
    setLoadingRoute(true); setErr("");
    try {
      const { data } = await api.get("/rides/estimate", {
        params: { fromLat: pickup.lat, fromLng: pickup.lng, toLat: drop.lat, toLng: drop.lng, cabType: "SEDAN", rideType },
      });
      setRouteData({ distanceKm: data.distanceKm, durationMin: data.durationMin, polyline: data.polyline });
    } catch (e) { setErr("Could not get route. Check locations."); }
    setLoadingRoute(false);
  };

  const fetchSharedRides = async () => {
    try {
      const { data } = await api.get("/rides/shared", { params: { lat: pickup.lat, lng: pickup.lng, dropLat: drop.lat, dropLng: drop.lng, cabType } });
      setSharedRides(data.rides || []);
    } catch {}
  };

  const selectedFare = routeData ? calcFare(CAB_TYPES.find(c => c.id === cabType), routeData.distanceKm, routeData.durationMin, rideType === "SHARED") : null;

  const bookRide = async (existingRideId = null) => {
    if (!pickup || !drop) return setErr("Please select both locations.");
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
        socket?.emit("riderSearching", { rideId, cabType, rideType, pickup, fare: selectedFare, genderPref });
      }
      nav(`/ride/track/${rideId}`);
    } catch (e) { setErr(e.response?.data?.message || "Booking failed."); }
    finally { setBooking(false); }
  };

  const polyline = routeData?.polyline?.map(p => [p.lat, p.lng]) || [];

  const handlePickup = (p) => { setPickup(p); setMapCenter([p.lat, p.lng]); setMapZoom(14); };
  const handleDrop = (d) => {
    setDrop(d);
    if (pickup) { setMapCenter([(pickup.lat + d.lat) / 2, (pickup.lng + d.lng) / 2]); setMapZoom(12); }
    else { setMapCenter([d.lat, d.lng]); setMapZoom(14); }
  };

  return (
    <RideLayout>
      <div style={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>

        {/* ── Scrollable left panel ── */}
        <div style={{ width: 390, background: "var(--surface)", borderRight: "1px solid var(--border)", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "20px 18px 24px" }}>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 28, color: "var(--accent)", letterSpacing: 1, marginBottom: 2 }}>BOOK A RIDE</h2>
            <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 16 }}>Hello, {user?.name?.split(" ")[0]} 👋</p>

            {/* Ride type */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[["PRIVATE", "🚗 Private"], ["SHARED", "👥 Share Cab"]].map(([v, l]) => (
                <button key={v} onClick={() => setRideType(v)}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1.5px solid ${rideType === v ? "var(--accent)" : "var(--border)"}`, background: rideType === v ? "var(--accent-dim)" : "var(--bg2)", color: rideType === v ? "var(--accent)" : "var(--text2)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {l}
                </button>
              ))}
            </div>

            <AddressInput label="Pickup Location" dotColor="#22c55e" value={pickup} onSelect={handlePickup} />
            <AddressInput label="Drop Location" dotColor="#ef4444" value={drop} onSelect={handleDrop} />

            {/* All 4 cab types with fares */}
            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                {loadingRoute ? "⏳ Calculating fares..." : routeData ? "Select Cab — All Fares" : "Select Cab Type"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {CAB_TYPES.map(c => {
                  const fare = calcFare(c, routeData?.distanceKm, routeData?.durationMin, rideType === "SHARED");
                  const active = cabType === c.id;
                  return (
                    <div key={c.id} onClick={() => setCabType(c.id)}
                      style={{ padding: "12px 10px", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent-dim)" : "var(--bg2)", transition: "all 0.15s", position: "relative", overflow: "hidden" }}>
                      {active && <div style={{ position: "absolute", top: 0, right: 0, width: 0, height: 0, borderStyle: "solid", borderWidth: "0 20px 20px 0", borderColor: `transparent var(--accent) transparent transparent` }} />}
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: active ? "var(--accent)" : "var(--text)" }}>{c.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>{c.desc}</div>
                      <div style={{ fontSize: fare ? 16 : 12, fontWeight: 800, color: active ? "var(--accent)" : "var(--text)" }}>
                        {fare ? `₹${fare}` : `₹${c.perKm}/km`}
                      </div>
                      {rideType === "SHARED" && fare && (
                        <div style={{ fontSize: 10, color: "var(--green)" }}>45% off</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Route summary */}
            {routeData && (
              <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "12px 16px", marginBottom: 14, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 0, justifyContent: "space-around" }}>
                  {[["₹" + selectedFare, "Fare"], [routeData.distanceKm + " km", "Distance"], [routeData.durationMin + " min", "ETA"]].map(([v, l]) => (
                    <div key={l} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: l === "Fare" ? "var(--accent)" : "var(--text)" }}>{v}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)" }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gender preference */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Driver Gender Preference</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["ANY", "👤 Any"], ["MALE_ONLY", "👨 Male"], ["FEMALE_ONLY", "👩 Female"]].map(([v, l]) => (
                  <button key={v} onClick={() => setGenderPref(v)}
                    style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: `1px solid ${genderPref === v ? "var(--accent)" : "var(--border)"}`, background: genderPref === v ? "var(--accent-dim)" : "var(--bg2)", color: genderPref === v ? "var(--accent)" : "var(--text2)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Shared rides */}
            {rideType === "SHARED" && sharedRides.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                  ✓ {sharedRides.length} shared ride{sharedRides.length > 1 ? "s" : ""} available
                </div>
                {sharedRides.slice(0, 3).map(ride => (
                  <div key={ride._id} onClick={() => bookRide(ride._id)}
                    style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg2)", marginBottom: 8, cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--green)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{ride.pickup?.address?.split(",")[0]}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: ride.matchScore?.routeMatch >= 80 ? "var(--green)" : "var(--accent)" }}>{ride.matchScore?.routeMatch}% match</span>
                    </div>
                    <div style={{ height: 3, background: "var(--border)", borderRadius: 2 }}>
                      <div style={{ width: `${ride.matchScore?.routeMatch || 0}%`, height: "100%", background: ride.matchScore?.routeMatch >= 80 ? "var(--green)" : "var(--accent)", borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Payment */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Payment Method</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[["CASH", "💵 Cash"], ["RAZORPAY", "💳 Online"]].map(([v, l]) => (
                  <button key={v} onClick={() => setPayMethod(v)}
                    style={{ flex: 1, padding: "9px", borderRadius: 9, border: `1px solid ${payMethod === v ? "var(--accent)" : "var(--border)"}`, background: payMethod === v ? "var(--accent-dim)" : "var(--bg2)", color: payMethod === v ? "var(--accent)" : "var(--text2)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {err && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{err}</div>}

            <button onClick={() => bookRide()} disabled={booking || !pickup || !drop}
              style={{ width: "100%", padding: "14px", background: !pickup || !drop ? "rgba(245,197,24,0.2)" : "var(--accent)", border: "none", borderRadius: 12, color: !pickup || !drop ? "rgba(245,197,24,0.4)" : "#000", fontSize: 15, fontWeight: 800, cursor: !pickup || !drop ? "not-allowed" : "pointer" }}>
              {booking ? "Booking..." : !pickup ? "Enter pickup first" : !drop ? "Enter drop location" : `🚗 Book${selectedFare ? ` · ₹${selectedFare}` : ""}`}
            </button>
          </div>
        </div>

        {/* ── Map — OSM Bright Smooth (modern) ── */}
        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              url={`https://maps.geoapify.com/v1/tile/osm-bright-smooth/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`}
              attribution='© <a href="https://www.geoapify.com/">Geoapify</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <MapFlyTo center={mapCenter} zoom={mapZoom} />
            {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}><Popup>🟢 {pickup.address}</Popup></Marker>}
            {drop && <Marker position={[drop.lat, drop.lng]} icon={dropIcon}><Popup>🔴 {drop.address}</Popup></Marker>}
            {polyline.length > 1 && <Polyline positions={polyline} color="#f5c518" weight={5} opacity={0.9} />}
          </MapContainer>

          {/* Fare overlay on map */}
          {routeData && selectedFare && (
            <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(12,12,15,0.9)", backdropFilter: "blur(12px)", borderRadius: 12, padding: "12px 16px", border: "1px solid var(--border)", zIndex: 1000 }}>
              <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>{cabType}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)" }}>₹{selectedFare}</div>
              <div style={{ fontSize: 12, color: "var(--text2)" }}>{routeData.distanceKm} km · {routeData.durationMin} min</div>
            </div>
          )}
        </div>
      </div>
    </RideLayout>
  );
}
