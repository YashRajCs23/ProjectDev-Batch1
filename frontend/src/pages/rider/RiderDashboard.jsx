// src/pages/rider/RiderDashboard.jsx — FINAL v5
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { searchIndiaPlaces, reverseGeocode } from "../../utils/search";
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
  return Math.round(shared ? f * 0.55 : f);
};

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const mkPin = (bg, lbl) => new L.DivIcon({
  html: `<div style="width:28px;height:36px;position:relative">
    <div style="width:28px;height:28px;background:${bg};border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 10px rgba(0,0,0,0.35)"></div>
    <div style="position:absolute;top:5px;left:0;width:28px;text-align:center;font-size:11px">${lbl}</div>
  </div>`,
  className: "", iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -36],
});

const G_PIN = mkPin("#16a34a", "🟢");
const R_PIN = mkPin("#dc2626", "🔴");
const B_PIN = mkPin("#2563eb", "📍");

// Imperative map controller
function MapController({ flyRef }) {
  const map = useMap();
  useEffect(() => {
    flyRef.current = (lat, lng, zoom = 14) =>
      map.flyTo([lat, lng], zoom, { duration: 0.9, easeLinearity: 0.4 });
  }, [map]);
  return null;
}

// ── Address Input with "Use My Location" as first option ──
function PlaceInput({ label, dot, value, onSelect, userLat, userLng, onUseMyLocation }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const t = useRef(null);

  useEffect(() => { setQ(value?.address || ""); }, [value?.address]);

  const onChange = (v) => {
    setQ(v);
    clearTimeout(t.current);
    if (v.length < 2) { setItems([]); setOpen(false); return; }
    t.current = setTimeout(async () => {
      setBusy(true);
      const res = await searchIndiaPlaces(v, userLat, userLng);
      setItems(res);
      setOpen(true);
      setBusy(false);
    }, 350);
  };

  const pick = (item) => {
    setQ(item.address); setItems([]); setOpen(false); onSelect(item);
  };

  const useMyLoc = async () => {
    setLocBusy(true); setOpen(false);
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 })
      );
      const { latitude: lat, longitude: lng } = pos.coords;
      const address = await reverseGeocode(lat, lng);
      const item = { address, lat, lng };
      setQ(address);
      onSelect(item);
      if (onUseMyLocation) onUseMyLocation(lat, lng);
    } catch {
      alert("Could not get location. Allow location access in browser settings.");
    }
    setLocBusy(false);
  };

  const handleFocus = () => {
    // Show "Use my location" option immediately on focus
    setOpen(true);
  };

  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", width: 9, height: 9, borderRadius: "50%", background: dot, boxShadow: `0 0 6px ${dot}88`, zIndex: 1 }} />
        <input
          value={q}
          onChange={e => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={() => setTimeout(() => setOpen(false), 220)}
          placeholder="Temple, area, city..."
          style={{ width: "100%", padding: "11px 30px 11px 26px", borderRadius: 10, fontSize: 13, border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`, background: "var(--bg2)", color: "var(--text)", outline: "none" }}
        />
        <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12 }}>
          {busy ? <span style={{ color: "var(--text3)" }}>⏳</span> : value ? <span style={{ color: "var(--green)" }}>✓</span> : null}
        </div>
      </div>

      {/* Dropdown — always shows "Use my location" + search results */}
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 9999, maxHeight: 260, overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.65)" }}>
          
          {/* "Use my location" always at top */}
          <div onMouseDown={useMyLoc}
            style={{ padding: "11px 13px", cursor: "pointer", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "rgba(59,130,246,0.06)" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.12)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(59,130,246,0.06)"}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {locBusy ? "⏳" : "📍"}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#3b82f6" }}>
                {locBusy ? "Getting your location..." : "Use my current location"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>
                {userLat && userLng ? `GPS: ${userLat.toFixed(4)}, ${userLng.toFixed(4)}` : "Tap to enable GPS"}
              </div>
            </div>
          </div>

          {/* Search results */}
          {items.map((r, i) => (
            <div key={i} onMouseDown={() => pick(r)}
              style={{ padding: "9px 12px", fontSize: 13, cursor: "pointer", borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none", color: "var(--text)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
              onMouseLeave={e => e.currentTarget.style.background = ""}>
              <div style={{ fontWeight: 500, marginBottom: 1 }}>📍 {r.address.split(",")[0]}</div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>{r.address.split(",").slice(1, 3).join(",").trim()}</div>
            </div>
          ))}

          {q.length >= 2 && items.length === 0 && !busy && (
            <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "var(--text3)" }}>
              No results found. Try a different spelling.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────
export default function RiderDashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const nav = useNavigate();

  const [pickup, setPickup]     = useState(null);
  const [drop, setDrop]         = useState(null);
  const [cabType, setCabType]   = useState("SEDAN");
  const [rideType, setRideType] = useState("PRIVATE");
  const [gender, setGender]     = useState("ANY");
  const [pay, setPay]           = useState("CASH");
  const [routeData, setRouteData] = useState(null);
  const [loadRoute, setLoadRoute] = useState(false);
  const [sharedRides, setSharedRides] = useState([]);
  const [booking, setBooking]   = useState(false);
  const [err, setErr]           = useState("");
  const [userLoc, setUserLoc]   = useState(null); // [lat, lng]

  const flyRef = useRef(null);

  // Get GPS on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => {
        const loc = [p.coords.latitude, p.coords.longitude];
        setUserLoc(loc);
        setTimeout(() => flyRef.current?.(loc[0], loc[1], 13), 500);
      },
      () => setTimeout(() => flyRef.current?.(28.6139, 77.2090, 12), 500),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Fetch route when both points ready
  useEffect(() => {
    if (pickup && drop) fetchRoute();
    else setRouteData(null);
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng]);

  useEffect(() => {
    if (rideType === "SHARED" && pickup && drop) fetchShared();
    else setSharedRides([]);
  }, [rideType, pickup?.lat, drop?.lat, cabType]);

  const fetchRoute = async () => {
    setLoadRoute(true); setErr("");
    try {
      const { data } = await api.get("/rides/estimate", {
        params: { fromLat: pickup.lat, fromLng: pickup.lng, toLat: drop.lat, toLng: drop.lng, cabType: "SEDAN", rideType },
      });
      setRouteData({ distanceKm: data.distanceKm, durationMin: data.durationMin, polyline: data.polyline });
      if (data.polyline?.length > 1) {
        const lats = data.polyline.map(p => p.lat), lngs = data.polyline.map(p => p.lng);
        flyRef.current?.(
          (Math.min(...lats) + Math.max(...lats)) / 2,
          (Math.min(...lngs) + Math.max(...lngs)) / 2,
          11
        );
      }
    } catch (e) { setErr("Route error: " + (e.response?.data?.message || e.message)); }
    setLoadRoute(false);
  };

  const fetchShared = async () => {
    try {
      const { data } = await api.get("/rides/shared", {
        params: { lat: pickup.lat, lng: pickup.lng, dropLat: drop.lat, dropLng: drop.lng, cabType },
      });
      setSharedRides(data.rides || []);
    } catch {}
  };

  const onPickup = p => { setPickup(p); flyRef.current?.(p.lat, p.lng, 15); };
  const onDrop   = d => {
    setDrop(d);
    flyRef.current?.(pickup ? (pickup.lat + d.lat) / 2 : d.lat, pickup ? (pickup.lng + d.lng) / 2 : d.lng, pickup ? 12 : 15);
  };

  const onPickupMyLoc = (lat, lng) => { setUserLoc([lat, lng]); flyRef.current?.(lat, lng, 15); };
  const onDropMyLoc   = (lat, lng) => flyRef.current?.(lat, lng, 15);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) return alert("GPS not available.");
    navigator.geolocation.getCurrentPosition(
      p => { const l = [p.coords.latitude, p.coords.longitude]; setUserLoc(l); flyRef.current?.(l[0], l[1], 15); },
      () => alert("Allow location access in browser settings.")
    );
  }, []);

  const bookRide = async (joinId = null) => {
    if (!pickup || !drop) return setErr("Select both locations.");
    setBooking(true); setErr("");
    try {
      let rideId;
      if (joinId) {
        const { data } = await api.post(`/rides/${joinId}/join-shared`, {
          pickupAddress: pickup.address, pickupLat: pickup.lat, pickupLng: pickup.lng,
          dropAddress: drop.address,   dropLat: drop.lat,   dropLng: drop.lng,
        });
        rideId = data.ride._id;
      } else {
        const { data } = await api.post("/rides", {
          pickupAddress: pickup.address, pickupLat: pickup.lat, pickupLng: pickup.lng,
          dropAddress: drop.address,   dropLat: drop.lat,   dropLng: drop.lng,
          cabType, rideType, genderPreference: gender, paymentMethod: pay,
        });
        rideId = data.ride._id;
        socket?.emit("riderSearching", {
          rideId: data.ride._id, cabType, rideType,
          pickup: { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
          fare: selFare, distanceKm: routeData?.distanceKm, genderPref: gender,
        });
      }
      nav(`/ride/track/${rideId}`);
    } catch (e) { setErr(e.response?.data?.message || "Booking failed."); }
    finally { setBooking(false); }
  };

  const selCab  = CABS.find(c => c.id === cabType);
  const selFare = calcFare(selCab, routeData?.distanceKm, routeData?.durationMin, rideType === "SHARED");
  const poly    = routeData?.polyline?.map(p => [p.lat, p.lng]) || [];

  return (
    <RideLayout>
      <div style={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>

        {/* ── Scrollable left panel ── */}
        <div style={{ width: 380, background: "var(--surface)", borderRight: "1px solid var(--border)", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "18px 16px 36px" }}>

            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 26, color: "var(--accent)", letterSpacing: 1, marginBottom: 2 }}>BOOK A RIDE</h2>
            <p style={{ color: "var(--text3)", fontSize: 12, marginBottom: 14 }}>Hello, {user?.name?.split(" ")[0]} 👋</p>

            {/* Ride type */}
            <div style={{ display: "flex", background: "var(--bg2)", borderRadius: 10, padding: 3, marginBottom: 14 }}>
              {[["PRIVATE", "🚗 Private"], ["SHARED", "👥 Share Cab"]].map(([v, l]) => (
                <button key={v} onClick={() => setRideType(v)}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: rideType === v ? "var(--surface)" : "transparent", color: rideType === v ? "var(--accent)" : "var(--text3)", fontWeight: rideType === v ? 700 : 400, fontSize: 13, cursor: "pointer", boxShadow: rideType === v ? "0 1px 4px rgba(0,0,0,0.3)" : "none" }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Location inputs — with "Use my location" button */}
            <PlaceInput
              label="Pickup Location" dot="#22c55e" value={pickup}
              onSelect={onPickup} onUseMyLocation={onPickupMyLoc}
              userLat={userLoc?.[0]} userLng={userLoc?.[1]}
            />
            <PlaceInput
              label="Drop Location" dot="#ef4444" value={drop}
              onSelect={onDrop} onUseMyLocation={onDropMyLoc}
              userLat={userLoc?.[0]} userLng={userLoc?.[1]}
            />

            {loadRoute && <div style={{ textAlign: "center", padding: "8px 0", fontSize: 12, color: "var(--accent)" }}>⏳ Calculating fares...</div>}

            {/* Cab type grid with all fares */}
            <div style={{ marginTop: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                {routeData ? `All Fares · ${routeData.distanceKm} km · ${routeData.durationMin} min` : "Select Cab Type"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {CABS.map(c => {
                  const f = calcFare(c, routeData?.distanceKm, routeData?.durationMin, rideType === "SHARED");
                  const active = c.id === cabType;
                  return (
                    <div key={c.id} onClick={() => setCabType(c.id)}
                      style={{ padding: "11px 10px", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent-dim)" : "var(--bg2)", position: "relative", transition: "all 0.1s" }}>
                      {active && <div style={{ position: "absolute", top: 5, right: 7, fontSize: 10, color: "var(--accent)", fontWeight: 800 }}>✓</div>}
                      <div style={{ fontSize: 20, marginBottom: 3 }}>{c.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: active ? "var(--accent)" : "var(--text)", marginBottom: 1 }}>{c.label}</div>
                      <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 5 }}>{c.cap}</div>
                      {f != null
                        ? <><div style={{ fontSize: 17, fontWeight: 800, color: active ? "var(--accent)" : "var(--text)", lineHeight: 1 }}>₹{f}</div>
                            {rideType === "SHARED" && <div style={{ fontSize: 9, color: "var(--green)", marginTop: 1 }}>45% off</div>}</>
                        : <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>₹{c.perKm}/km</div>
                      }
                    </div>
                  );
                })}
              </div>

              {/* Summary bar */}
              {selFare != null && routeData && (
                <div style={{ marginTop: 10, background: "var(--bg2)", borderRadius: 10, padding: "11px 14px", border: "1px solid rgba(245,197,24,0.2)", display: "flex", justifyContent: "space-around" }}>
                  {[["₹" + selFare, "Total Fare", "var(--accent)"], [routeData.distanceKm + " km", "Distance", "var(--text)"], [routeData.durationMin + " min", "ETA", "var(--text)"]].map(([v, l, c]) => (
                    <div key={l} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: l === "Total Fare" ? 20 : 16, fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div>
                      <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Gender preference */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>Driver Gender</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["ANY", "👤 Any"], ["MALE_ONLY", "👨 Male"], ["FEMALE_ONLY", "👩 Female"]].map(([v, l]) => (
                  <button key={v} onClick={() => setGender(v)}
                    style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: `1px solid ${gender === v ? "var(--accent)" : "var(--border)"}`, background: gender === v ? "var(--accent-dim)" : "var(--bg2)", color: gender === v ? "var(--accent)" : "var(--text2)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Shared rides */}
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
                    </div>
                  );
                })}
              </div>
            )}

            {/* Payment */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>Payment</div>
              <div style={{ display: "flex", gap: 7 }}>
                {[["CASH", "💵 Cash"], ["RAZORPAY", "💳 Online"]].map(([v, l]) => (
                  <button key={v} onClick={() => setPay(v)}
                    style={{ flex: 1, padding: "9px", borderRadius: 9, border: `1px solid ${pay === v ? "var(--accent)" : "var(--border)"}`, background: pay === v ? "var(--accent-dim)" : "var(--bg2)", color: pay === v ? "var(--accent)" : "var(--text2)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {err && <div style={{ padding: "9px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, color: "var(--red)", fontSize: 12, marginBottom: 12 }}>⚠️ {err}</div>}

            <button onClick={() => bookRide()} disabled={booking || !pickup || !drop}
              style={{ width: "100%", padding: "14px", background: !pickup || !drop ? "rgba(245,197,24,0.12)" : booking ? "rgba(245,197,24,0.5)" : "var(--accent)", border: "none", borderRadius: 12, color: !pickup || !drop ? "rgba(245,197,24,0.3)" : "#000", fontSize: 14, fontWeight: 800, cursor: !pickup || !drop ? "not-allowed" : "pointer" }}>
              {booking ? "⏳ Booking..." : !pickup ? "Enter pickup location" : !drop ? "Enter drop location" : selFare ? `🚗 Book ${cabType} · ₹${selFare}` : `🚗 Book ${rideType === "SHARED" ? "Shared" : "Private"} Ride`}
            </button>
          </div>
        </div>

        {/* ── Map ── */}
        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              url={`https://maps.geoapify.com/v1/tile/osm-bright-smooth/{z}/{x}/{y}.png?apiKey=${KEY}`}
              attribution='© <a href="https://www.geoapify.com/">Geoapify</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={20}
            />
            <MapController flyRef={flyRef} />
            {userLoc && <Marker position={userLoc} icon={B_PIN}><Popup>📍 You are here</Popup></Marker>}
            {pickup   && <Marker position={[pickup.lat, pickup.lng]} icon={G_PIN}><Popup>🟢 {pickup.address}</Popup></Marker>}
            {drop     && <Marker position={[drop.lat,   drop.lng]}   icon={R_PIN}><Popup>🔴 {drop.address}</Popup></Marker>}
            {poly.length > 1 && <Polyline positions={poly} color="#f5c518" weight={5} opacity={0.9} />}
          </MapContainer>

          {/* Locate me button */}
          <button onClick={locateMe} title="Go to my location"
            style={{ position: "absolute", bottom: 90, right: 14, width: 42, height: 42, zIndex: 1000, borderRadius: 10, background: "rgba(12,12,15,0.9)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
            📍
          </button>

          {/* Fare overlay */}
          {selFare != null && routeData && (
            <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(12,12,15,0.92)", backdropFilter: "blur(14px)", borderRadius: 12, padding: "11px 15px", border: "1px solid rgba(245,197,24,0.2)", zIndex: 1000, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{cabType} · {rideType}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>₹{selFare}</div>
              <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>{routeData.distanceKm} km · {routeData.durationMin} min</div>
            </div>
          )}
        </div>
      </div>
    </RideLayout>
  );
}
