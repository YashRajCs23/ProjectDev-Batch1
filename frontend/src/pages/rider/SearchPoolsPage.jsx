// src/pages/rider/SearchPoolsPage.jsx — Auto-loads nearby pools, search + filters
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { searchIndiaPlaces, reverseGeocode } from "../../utils/search";
import api from "../../utils/api";
import RideLayout from "../../components/common/RideLayout";

// ── Location search input ─────────────────────────────────
function LocInput({ label, dot, value, onSelect }) {
  const [q, setQ]       = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy]   = useState(false);
  const [open, setOpen]   = useState(false);
  const t = useRef(null);

  useEffect(() => { setQ(value?.address || ""); }, [value?.address]);

  const onChange = (v) => {
    setQ(v); clearTimeout(t.current);
    if (v.length < 2) { setItems([]); setOpen(false); return; }
    t.current = setTimeout(async () => {
      setBusy(true);
      const res = await searchIndiaPlaces(v);
      setItems(res); setOpen(res.length > 0); setBusy(false);
    }, 350);
  };

  const pick = (item) => { setQ(item.address); setItems([]); setOpen(false); onSelect(item); };

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", background: dot, zIndex: 1 }} />
        <input value={q} onChange={e => onChange(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search location..."
          style={{ width: "100%", padding: "10px 10px 10px 24px", borderRadius: 10, fontSize: 13, border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`, background: "var(--bg2)", color: "var(--text)" }}
        />
        {busy && <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text3)" }}>⏳</span>}
        {value && !busy && <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--green)", fontSize: 13 }}>✓</span>}
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

const Pref = ({ on, icon, label }) => (
  <span title={`${label}: ${on ? "Yes" : "No"}`}
    style={{ fontSize: 18, opacity: on ? 1 : 0.2, transition: "opacity 0.2s" }}>
    {icon}
  </span>
);

export default function SearchPoolsPage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const nav = useNavigate();

  const [pickup, setPickup] = useState(null);
  const [drop, setDrop]     = useState(null);
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [filters, setFilters] = useState({ smoking: false, pets: false, gender: "ANY" });
  const [pools, setPools]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [userLoc, setUserLoc] = useState(null);

  // Join request state
  const [reqMsg, setReqMsg]   = useState("");
  const [reqStatus, setReqStatus] = useState({});
  const [requesting, setRequesting] = useState(null);
  const [approval, setApproval] = useState(null);

  // ── Auto-load pools on mount using GPS ────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { loadNearbyPools(); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setUserLoc({ lat, lng });
        // Reverse geocode to get address
        const addr = await reverseGeocode(lat, lng);
        const loc = { address: addr, lat, lng };
        setPickup(loc);
        loadNearbyPools(lat, lng);
      },
      () => loadNearbyPools(),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const loadNearbyPools = async (lat, lng) => {
    setLoading(true);
    try {
      const params = { date };
      if (lat && lng) { params.lat = lat; params.lng = lng; }
      const { data } = await api.get("/rides/search-pools", { params });
      setPools(data.pools || []);
      setSearched(true);
    } catch {}
    setLoading(false);
  };

  // ── Socket: listen for join approval ─────────────────────
  useEffect(() => {
    if (!socket || !user?._id) return;
    const ev = `joinResponse_${user._id}`;
    const handler = (data) => {
      if (data.action === "APPROVED") {
        setApproval({ rideId: data.rideId });
        setReqStatus(s => ({ ...s, [String(data.rideId)]: "APPROVED" }));
      } else {
        setReqStatus(s => ({ ...s, [String(data.rideId)]: "REJECTED" }));
      }
    };
    socket.on(ev, handler);
    return () => socket.off(ev, handler);
  }, [socket, user?._id]);

  const search = async () => {
    setLoading(true); setSearched(true);
    try {
      const params = { date };
      if (pickup?.lat) { params.lat = pickup.lat; params.lng = pickup.lng; }
      if (drop?.lat)   { params.dropLat = drop.lat; params.dropLng = drop.lng; }
      if (filters.smoking) params.smoking = "true";
      if (filters.pets)    params.pets    = "true";
      if (filters.gender !== "ANY") params.gender = filters.gender;
      const { data } = await api.get("/rides/search-pools", { params });
      setPools(data.pools || []);
    } catch {}
    setLoading(false);
  };

  const sendRequest = async (poolId) => {
    if (!pickup) return alert("Set your pickup location first.");
    setRequesting(poolId);
    try {
      const pool = pools.find(p => String(p._id) === String(poolId));
      const dropLoc = drop || { address: pool.drop.address, lat: pool.drop.coordinates.lat, lng: pool.drop.coordinates.lng };
      await api.post(`/rides/${poolId}/request-join`, {
        pickupAddress: pickup.address, pickupLat: pickup.lat, pickupLng: pickup.lng,
        dropAddress: dropLoc.address, dropLat: dropLoc.lat, dropLng: dropLoc.lng,
        message: reqMsg,
      });
      setReqStatus(s => ({ ...s, [poolId]: "PENDING" }));
    } catch (e) { alert(e.response?.data?.message || "Request failed."); }
    setRequesting(null);
  };

  const fmtTime = (d) => {
    const dt = new Date(d);
    const now = new Date();
    const diff = dt - now;
    if (diff < 0) return "Departed";
    if (diff < 60 * 60000) return `in ${Math.round(diff / 60000)} min`;
    if (diff < 24 * 60 * 60000) return dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    return dt.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const toggleFlt = (k) => setFilters(f => ({ ...f, [k]: !f[k] }));
  const setGender = (v) => setFilters(f => ({ ...f, gender: v }));

  return (
    <RideLayout>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 40px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-head)", fontSize: 28, color: "var(--accent)", letterSpacing: 1, marginBottom: 2 }}>🔍 FIND A POOL</h1>
            <p style={{ color: "var(--text3)", fontSize: 13 }}>Find shared rides nearby · save up to 45%</p>
          </div>
          {userLoc && (
            <div style={{ fontSize: 11, color: "var(--green)", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "4px 10px" }}>
              📍 GPS Active
            </div>
          )}
        </div>

        {/* Search panel */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20, marginBottom: 20 }}>

          {/* Location + Date row */}
          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <LocInput label="Pickup" dot="#22c55e" value={pickup} onSelect={setPickup} />
            <LocInput label="Drop (optional)" dot="#ef4444" value={drop} onSelect={setDrop} />
            <div style={{ minWidth: 140 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                style={{ padding: "10px 12px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text)", width: "100%" }} />
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 600 }}>Filters:</span>
            {[["🚬 Smoking", "smoking"], ["🐶 Pets", "pets"]].map(([l, k]) => (
              <button key={k} onClick={() => toggleFlt(k)}
                style={{ padding: "6px 13px", borderRadius: 20, border: `1px solid ${filters[k] ? "var(--accent)" : "var(--border)"}`, background: filters[k] ? "var(--accent-dim)" : "var(--bg2)", color: filters[k] ? "var(--accent)" : "var(--text2)", fontSize: 12, cursor: "pointer", fontWeight: filters[k] ? 700 : 400 }}>
                {l}
              </button>
            ))}
            <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: 4 }}>Gender:</span>
            {[["👤 Any","ANY"],["👨 Male","MALE_ONLY"],["👩 Female","FEMALE_ONLY"]].map(([l,v]) => (
              <button key={v} onClick={() => setGender(v)}
                style={{ padding: "6px 13px", borderRadius: 20, border: `1px solid ${filters.gender===v?"var(--accent)":"var(--border)"}`, background: filters.gender===v?"var(--accent-dim)":"var(--bg2)", color: filters.gender===v?"var(--accent)":"var(--text2)", fontSize: 12, cursor: "pointer", fontWeight: filters.gender===v?700:400 }}>
                {l}
              </button>
            ))}
          </div>

          <button onClick={search} disabled={loading}
            style={{ width: "100%", padding: "12px", background: loading ? "rgba(245,197,24,0.4)" : "var(--accent)", border: "none", borderRadius: 10, color: "#000", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "⏳ Searching..." : "🔍 Search Pools"}
          </button>
        </div>

        {/* Approval banner */}
        {approval && (
          <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid var(--green)", borderRadius: 12, padding: 18, marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 800, color: "var(--green)", fontSize: 15, marginBottom: 3 }}>🎉 Your request was approved!</div>
              <div style={{ fontSize: 13, color: "var(--text2)" }}>Driver accepted you into the pool</div>
            </div>
            <button onClick={() => nav(`/ride/track/${approval.rideId}`)}
              style={{ padding: "10px 20px", background: "var(--green)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, cursor: "pointer" }}>
              Track Ride →
            </button>
          </div>
        )}

        {/* Results */}
        {loading && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text3)" }}>
            <div style={{ fontSize: 40, marginBottom: 12, animation: "spin 1s linear infinite" }}>🚗</div>
            <div>Finding pools near you...</div>
          </div>
        )}

        {!loading && searched && pools.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text3)" }}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>🚗</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>No pools found</div>
            <div style={{ fontSize: 13 }}>Try a different date or expand your search area</div>
          </div>
        )}

        {!loading && pools.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 16, fontWeight: 600 }}>
              {pools.length} pool{pools.length > 1 ? "s" : ""} found
              {pickup?.lat && " · sorted by route match"}
            </div>

            {pools.map(pool => {
              const match  = pool.matchScore?.routeMatch;
              const score  = pool.matchScore?.score || 0;
              const st     = reqStatus[String(pool._id)];
              const drv    = pool.driverId;
              const p      = pool.preferences || {};
              const seatsLeft = pool.availableSeats || 0;
              const isFull = seatsLeft <= 0;

              const matchColor = !match ? "var(--text3)" : match >= 80 ? "var(--green)" : match >= 60 ? "var(--accent)" : "#f97316";
              const borderColor = !match ? "var(--border)" : match >= 80 ? "rgba(34,197,94,0.35)" : match >= 60 ? "rgba(245,197,24,0.3)" : "var(--border)";

              return (
                <div key={pool._id} style={{ background: "var(--surface)", border: `1.5px solid ${borderColor}`, borderRadius: "var(--r-lg)", padding: 20, marginBottom: 14, transition: "border-color 0.2s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>

                    {/* Driver */}
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--accent-dim)", border: "2px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                        {drv?.userId?.gender === "FEMALE" ? "👩" : "👨"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{drv?.userId?.name?.split(" ")[0] || "Driver"}</div>
                        <div style={{ fontSize: 12, color: "var(--text3)" }}>⭐ {drv?.rating || 5.0} · {drv?.vehicle?.make} {drv?.vehicle?.model}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>🚗 {drv?.vehicle?.plateNumber} · {pool.cabType}</div>
                      </div>
                    </div>

                    {/* Match % */}
                    <div style={{ textAlign: "center", minWidth: 70 }}>
                      {match != null ? (
                        <>
                          <div style={{ fontSize: 24, fontWeight: 800, color: matchColor, lineHeight: 1 }}>{match}%</div>
                          <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 4 }}>route match</div>
                          <div style={{ height: 5, width: 64, background: "var(--border)", borderRadius: 3, margin: "0 auto" }}>
                            <div style={{ width: `${match}%`, height: "100%", background: matchColor, borderRadius: 3 }} />
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: "var(--text3)", textAlign: "center" }}>No route<br/>filter</div>
                      )}
                    </div>
                  </div>

                  {/* Route */}
                  <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>
                      📍 <span style={{ fontWeight: 600 }}>{pool.pickup?.address?.split(",")[0]}</span>
                      <span style={{ fontSize: 11, color: "var(--text3)" }}> {pool.pickup?.address?.split(",").slice(1, 3).join(",")}</span>
                    </div>
                    <div style={{ fontSize: 13 }}>
                      🏁 <span style={{ fontWeight: 600 }}>{pool.drop?.address?.split(",")[0]}</span>
                      <span style={{ fontSize: 11, color: "var(--text3)" }}> {pool.drop?.address?.split(",").slice(1, 3).join(",")}</span>
                    </div>
                  </div>

                  {/* Key info row */}
                  <div style={{ display: "flex", gap: 16, fontSize: 13, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ color: "var(--text2)" }}>🕐 <strong>{fmtTime(pool.departureTime)}</strong></span>
                    <span style={{ color: isFull ? "var(--red)" : seatsLeft <= 1 ? "#f97316" : "var(--text2)" }}>
                      🪑 {isFull ? "Full" : `${seatsLeft} seat${seatsLeft > 1 ? "s" : ""} left`}
                    </span>
                    <span style={{ color: "var(--text2)" }}>📏 {pool.distanceKm} km · {pool.durationMin} min</span>
                    <span style={{ fontWeight: 800, color: "var(--accent)", fontSize: 16 }}>₹{pool.fareEstimate}<span style={{ fontSize: 11, fontWeight: 400 }}>/seat</span></span>
                    {pool.genderPreference !== "ANY" && (
                      <span style={{ fontSize: 11, color: "var(--accent)", background: "var(--accent-dim)", borderRadius: 8, padding: "2px 8px", fontWeight: 600 }}>
                        {pool.genderPreference === "FEMALE_ONLY" ? "👩 Women only" : "👨 Men only"}
                      </span>
                    )}
                  </div>

                  {/* Preferences */}
                  <div style={{ display: "flex", gap: 12, padding: "8px 12px", background: "var(--bg2)", borderRadius: 8, marginBottom: 14, alignItems: "center" }}>
                    <Pref on={p.smoking} icon="🚬" label="Smoking" />
                    <Pref on={p.pets}    icon="🐶" label="Pets" />
                    <Pref on={p.music}   icon="🎵" label="Music" />
                    <Pref on={p.ac}      icon="❄️"  label="AC" />
                    <Pref on={p.luggage} icon="🧳" label="Luggage" />
                    <Pref on={p.chatty}  icon="💬" label="Chatty" />
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text3)" }}>
                      {[p.smoking?"Smoking":null,p.pets?"Pets":null,p.music?"Music":null,!p.ac?"No AC":null].filter(Boolean).join(" · ") || "No restrictions"}
                    </span>
                  </div>

                  {/* Action area */}
                  {isFull ? (
                    <div style={{ textAlign: "center", padding: "10px", color: "var(--red)", fontWeight: 600, fontSize: 13 }}>🚫 Pool is full</div>
                  ) : st === "APPROVED" ? (
                    <button onClick={() => nav(`/ride/track/${pool._id}`)}
                      style={{ width: "100%", padding: "11px", background: "var(--green)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                      ✅ Approved · Track Ride →
                    </button>
                  ) : st === "REJECTED" ? (
                    <div style={{ textAlign: "center", padding: "10px", color: "var(--red)", fontSize: 13 }}>❌ Driver declined your request</div>
                  ) : st === "PENDING" ? (
                    <div style={{ textAlign: "center", padding: "12px", color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>
                      ⏳ Request sent — waiting for driver approval...
                    </div>
                  ) : (
                    <div>
                      <textarea value={reqMsg} onChange={e => setReqMsg(e.target.value)}
                        placeholder={`Message to driver (optional) · e.g. "I have 1 small bag"`}
                        rows={2}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, marginBottom: 8, resize: "none", fontSize: 13, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text)" }}
                      />
                      <button onClick={() => sendRequest(pool._id)} disabled={!!requesting}
                        style={{ width: "100%", padding: "12px", background: requesting ? "rgba(245,197,24,0.4)" : "var(--accent)", border: "none", borderRadius: 10, color: "#000", fontWeight: 800, fontSize: 14, cursor: requesting ? "not-allowed" : "pointer" }}>
                        {requesting === pool._id ? "⏳ Sending..." : `📨 Request to Join · ₹${pool.fareEstimate}/seat`}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </RideLayout>
  );
}
