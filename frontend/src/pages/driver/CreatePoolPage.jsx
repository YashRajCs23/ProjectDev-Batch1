// src/pages/driver/CreatePoolPage.jsx — Driver creates a scheduled shared ride
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useAuth } from "../../context/AuthContext";
import { searchIndiaPlaces } from "../../utils/search";
import api from "../../utils/api";
import RideLayout from "../../components/common/RideLayout";

const KEY = "42275beb38a64d1486b88a378b90a008";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const mkPin = (bg, lbl) => new L.DivIcon({
  html: `<div style="width:26px;height:34px;position:relative"><div style="width:26px;height:26px;background:${bg};border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,0.3)"></div><div style="position:absolute;top:4px;left:0;width:26px;text-align:center;font-size:11px">${lbl}</div></div>`,
  className: "", iconSize: [26, 34], iconAnchor: [13, 34],
});
const G_PIN = mkPin("#16a34a", "🟢");
const R_PIN = mkPin("#dc2626", "🔴");

function MapController({ flyRef }) {
  const map = useMap();
  useEffect(() => { flyRef.current = (lat, lng, z = 13) => map.flyTo([lat, lng], z, { duration: 0.8 }); }, [map]);
  return null;
}

function LocationInput({ label, dot, value, onSelect, userLat, userLng }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const t = useRef(null);

  useEffect(() => { setQ(value?.address || ""); }, [value?.address]);

  const onChange = (v) => {
    setQ(v);
    clearTimeout(t.current);
    if (v.length < 2) { setItems([]); setOpen(false); return; }
    t.current = setTimeout(async () => {
      setBusy(true);
      const res = await searchIndiaPlaces(v, userLat, userLng);
      setItems(res); setOpen(res.length > 0); setBusy(false);
    }, 350);
  };

  const pick = (item) => { setQ(item.address); setItems([]); setOpen(false); onSelect(item); };

  return (
    <div style={{ position: "relative", marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", width: 9, height: 9, borderRadius: "50%", background: dot }} />
        <input value={q} onChange={e => onChange(e.target.value)} onFocus={() => items.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search location..."
          style={{ width: "100%", padding: "10px 10px 10px 26px", borderRadius: 10, fontSize: 13, border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`, background: "var(--bg2)", color: "var(--text)" }} />
        {value && <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--green)", fontSize: 13 }}>✓</div>}
        {busy && <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", fontSize: 12 }}>⏳</div>}
      </div>
      {open && items.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 9999, maxHeight: 200, overflowY: "auto", boxShadow: "0 10px 32px rgba(0,0,0,0.6)" }}>
          {items.map((r, i) => (
            <div key={i} onMouseDown={() => pick(r)}
              style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
              onMouseLeave={e => e.currentTarget.style.background = ""}>
              <div style={{ fontWeight: 500 }}>📍 {r.address.split(",")[0]}</div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>{r.address.split(",").slice(1, 3).join(",").trim()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PrefToggle = ({ icon, label, value, onChange }) => (
  <div onClick={() => onChange(!value)}
    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: `1px solid ${value ? "var(--accent)" : "var(--border)"}`, background: value ? "var(--accent-dim)" : "var(--bg2)", cursor: "pointer", transition: "all 0.15s" }}>
    <span style={{ fontSize: 18 }}>{icon}</span>
    <span style={{ fontSize: 12, fontWeight: 600, color: value ? "var(--accent)" : "var(--text2)", flex: 1 }}>{label}</span>
    <div style={{ width: 36, height: 20, borderRadius: 10, background: value ? "var(--accent)" : "var(--border)", position: "relative", transition: "background 0.2s" }}>
      <div style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
    </div>
  </div>
);

export default function CreatePoolPage() {
  const { driverProfile } = useAuth();
  const nav = useNavigate();
  const flyRef = useRef(null);

  const [pickup, setPickup] = useState(null);
  const [drop, setDrop]     = useState(null);
  const [seats, setSeats]   = useState(2);
  const [departureTime, setDepartureTime] = useState(() => {
    const d = new Date(); d.setMinutes(d.getMinutes() + 30);
    return d.toISOString().slice(0, 16);
  });
  const [gender, setGender]     = useState("ANY");
  const [prefs, setPrefs]       = useState({ smoking: false, pets: false, music: true, ac: true, luggage: true, chatty: true });
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");
  const [userLoc, setUserLoc]   = useState(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(p => {
      const loc = [p.coords.latitude, p.coords.longitude];
      setUserLoc(loc);
      setTimeout(() => flyRef.current?.(loc[0], loc[1], 13), 500);
    });
  }, []);

  useEffect(() => {
    if (pickup && drop) fetchRoute();
  }, [pickup?.lat, drop?.lat]);

  const fetchRoute = async () => {
    try {
      const { data } = await api.get("/rides/estimate", {
        params: { fromLat: pickup.lat, fromLng: pickup.lng, toLat: drop.lat, toLng: drop.lng, cabType: driverProfile?.vehicle?.cabType || "SEDAN", rideType: "SHARED" },
      });
      setRouteData(data);
      if (data.polyline?.length > 1) {
        const lats = data.polyline.map(p => p.lat), lngs = data.polyline.map(p => p.lng);
        flyRef.current?.((Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2, 11);
      }
    } catch {}
  };

  const setPref = (k) => (v) => setPrefs(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!pickup) return setErr("Set your starting location.");
    if (!drop)   return setErr("Set your destination.");
    setLoading(true); setErr("");
    try {
      const { data } = await api.post("/rides/pool", {
        pickupAddress: pickup.address, pickupLat: pickup.lat, pickupLng: pickup.lng,
        dropAddress:   drop.address,   dropLat: drop.lat,     dropLng: drop.lng,
        cabType: driverProfile?.vehicle?.cabType,
        departureTime, availableSeats: seats,
        genderPreference: gender, preferences: prefs,
      });
      nav(`/ride/track/${data.pool._id}`);
    } catch (e) { setErr(e.response?.data?.message || "Failed to create pool."); }
    setLoading(false);
  };

  const poly = routeData?.polyline?.map(p => [p.lat, p.lng]) || [];
  const farePerSeat = routeData ? Math.round(routeData.fare) : null;

  return (
    <RideLayout>
      <div style={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>

        {/* Left panel */}
        <div style={{ width: 400, background: "var(--surface)", borderRight: "1px solid var(--border)", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "18px 16px 32px" }}>

            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 22, color: "var(--accent)", letterSpacing: 1, marginBottom: 4 }}>🚗 CREATE POOL</h2>
            <p style={{ color: "var(--text3)", fontSize: 12, marginBottom: 18 }}>
              Publish your ride — let others join and share costs
            </p>

            {/* Route */}
            <LocationInput label="Starting From" dot="#22c55e" value={pickup} onSelect={p => { setPickup(p); flyRef.current?.(p.lat, p.lng, 14); }} userLat={userLoc?.[0]} userLng={userLoc?.[1]} />
            <LocationInput label="Going To" dot="#ef4444" value={drop} onSelect={d => { setDrop(d); if (pickup) flyRef.current?.((pickup.lat+d.lat)/2,(pickup.lng+d.lng)/2,11); else flyRef.current?.(d.lat,d.lng,14); }} userLat={userLoc?.[0]} userLng={userLoc?.[1]} />

            {/* Fare estimate */}
            {routeData && (
              <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "12px 14px", marginBottom: 14, border: "1px solid rgba(245,197,24,0.2)", display: "flex", justifyContent: "space-around" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent)" }}>₹{farePerSeat}</div>
                  <div style={{ fontSize: 10, color: "var(--text3)" }}>per seat</div>
                </div>
                <div style={{ width: 1, background: "var(--border)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{routeData.distanceKm} km</div>
                  <div style={{ fontSize: 10, color: "var(--text3)" }}>distance</div>
                </div>
                <div style={{ width: 1, background: "var(--border)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{routeData.durationMin} min</div>
                  <div style={{ fontSize: 10, color: "var(--text3)" }}>ETA</div>
                </div>
              </div>
            )}

            {/* Date/time */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>Departure Time</label>
              <input type="datetime-local" value={departureTime} onChange={e => setDepartureTime(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text)" }} />
            </div>

            {/* Available seats */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
                Available Seats: <span style={{ color: "var(--accent)", fontSize: 16 }}>{seats}</span>
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {[1,2,3,4].map(n => (
                  <button key={n} onClick={() => setSeats(n)}
                    style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1.5px solid ${seats === n ? "var(--accent)" : "var(--border)"}`, background: seats === n ? "var(--accent-dim)" : "var(--bg2)", color: seats === n ? "var(--accent)" : "var(--text2)", fontWeight: seats === n ? 800 : 400, fontSize: 16, cursor: "pointer" }}>
                    {n}
                  </button>
                ))}
              </div>
              {routeData && farePerSeat && (
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6, textAlign: "center" }}>
                  You could earn up to ₹{farePerSeat * seats} if all {seats} seats fill
                </div>
              )}
            </div>

            {/* Gender preference */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 7 }}>Passenger Gender</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[["ANY","👤 Any"],["MALE_ONLY","👨 Male"],["FEMALE_ONLY","👩 Female"]].map(([v,l]) => (
                  <button key={v} onClick={() => setGender(v)}
                    style={{ flex: 1, padding: "8px 4px", borderRadius: 9, border: `1px solid ${gender===v?"var(--accent)":"var(--border)"}`, background: gender===v?"var(--accent-dim)":"var(--bg2)", color: gender===v?"var(--accent)":"var(--text2)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Ride Preferences */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 10 }}>Ride Preferences</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <PrefToggle icon="🚬" label="Smoking OK"      value={prefs.smoking} onChange={setPref("smoking")} />
                <PrefToggle icon="🐶" label="Pets Welcome"    value={prefs.pets}    onChange={setPref("pets")} />
                <PrefToggle icon="🎵" label="Music On"        value={prefs.music}   onChange={setPref("music")} />
                <PrefToggle icon="❄️"  label="AC On"           value={prefs.ac}      onChange={setPref("ac")} />
                <PrefToggle icon="🧳" label="Luggage OK"      value={prefs.luggage} onChange={setPref("luggage")} />
                <PrefToggle icon="💬" label="Chatty Ride"     value={prefs.chatty}  onChange={setPref("chatty")} />
              </div>
            </div>

            {err && <div style={{ padding: "9px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, color: "var(--red)", fontSize: 12, marginBottom: 12 }}>⚠️ {err}</div>}

            <button onClick={submit} disabled={loading || !pickup || !drop}
              style={{ width: "100%", padding: "14px", background: !pickup || !drop ? "rgba(245,197,24,0.12)" : loading ? "rgba(245,197,24,0.5)" : "var(--accent)", border: "none", borderRadius: 12, color: !pickup || !drop ? "rgba(245,197,24,0.3)" : "#000", fontSize: 14, fontWeight: 800, cursor: !pickup || !drop ? "not-allowed" : "pointer" }}>
              {loading ? "Publishing..." : `🚗 Publish Pool · ${seats} seat${seats>1?"s":""}`}
            </button>

            <p style={{ textAlign: "center", fontSize: 11, color: "var(--text3)", marginTop: 10 }}>
              Riders will send join requests. You approve or reject each one.
            </p>
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: "100%", width: "100%" }}>
            <TileLayer url={`https://maps.geoapify.com/v1/tile/osm-bright-smooth/{z}/{x}/{y}.png?apiKey=${KEY}`} attribution='© Geoapify' />
            <MapController flyRef={flyRef} />
            {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={G_PIN} />}
            {drop   && <Marker position={[drop.lat,   drop.lng]}   icon={R_PIN} />}
            {poly.length > 1 && <Polyline positions={poly} color="#f5c518" weight={5} opacity={0.9} />}
          </MapContainer>
        </div>
      </div>
    </RideLayout>
  );
}
