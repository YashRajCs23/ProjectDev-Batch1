// src/pages/driver/DriverDashboard.jsx
// DEFINITIVE FIX: Polling every 5s as primary mechanism + socket as enhancement
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import api from "../../utils/api";
import RideLayout from "../../components/common/RideLayout";

const KEY = "42275beb38a64d1486b88a378b90a008";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const carIcon = new L.DivIcon({
  html: `<div style="background:#f5c518;border:3px solid #111;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 3px 12px rgba(245,197,24,0.5)">🚗</div>`,
  className: "", iconSize: [34, 34], iconAnchor: [17, 17],
});

function MapController({ flyRef }) {
  const map = useMap();
  useEffect(() => { flyRef.current = (lat, lng, z = 14) => map.flyTo([lat, lng], z, { duration: 0.8 }); }, [map]);
  return null;
}

export default function DriverDashboard() {
  const { user, driverProfile, driverLoading, driverLoaded, loadDriver } = useAuth();
  const { socket, connected } = useSocket();
  const nav = useNavigate();

  const [driver, setDriver]           = useState(null);
  const [isOnline, setIsOnline]       = useState(false);
  const [pending, setPending]         = useState([]);
  const [currentRide, setCurrentRide] = useState(null);
  const [myLoc, setMyLoc]             = useState(null);
  const [toggling, setToggling]       = useState(false);
  const [toast, setToast]             = useState(null);
  const [lastPoll, setLastPoll]       = useState(null);
  const [otpData, setOtpData]           = useState(null); // { otp }
  const [otpInput, setOtpInput]         = useState('');

  const flyRef    = useRef(null);
  const watchId   = useRef(null);
  const pollTimer = useRef(null);
  const isOnlineRef = useRef(false);

  // ── Load driver profile ───────────────────────────────────
  useEffect(() => {
    if (!driverLoaded) return;
    if (!driverProfile) { nav("/driver/setup"); return; }
    setDriver(driverProfile);
    const online = driverProfile.isOnline || false;
    setIsOnline(online);
    isOnlineRef.current = online;
    if (driverProfile.currentRideId) loadCurrentRide(driverProfile.currentRideId);
    startGPS();
    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
      clearInterval(pollTimer.current);
    };
  }, [driverLoaded, driverProfile]);

  // ── POLLING: fetch pending rides every 5 seconds ──────────
  useEffect(() => {
    if (!isOnline) {
      clearInterval(pollTimer.current);
      return;
    }

    const poll = async () => {
      try {
        const { data } = await api.get("/drivers/pending-rides");
        if (data.success && data.rides?.length > 0) {
          setPending(prev => {
            const prevIds = new Set(prev.map(r => String(r.rideId)));
            const newRides = data.rides.filter(r => !prevIds.has(String(r.rideId)));
            if (newRides.length > 0) {
              showToast(`🔔 ${newRides.length} new ride request${newRides.length > 1 ? "s" : ""}!`);
              return [...newRides, ...prev].slice(0, 20);
            }
            // Also remove rides that are no longer SEARCHING
            const currentIds = new Set(data.rides.map(r => String(r.rideId)));
            return prev.filter(r => currentIds.has(String(r.rideId)));
          });
        } else if (data.success) {
          // No rides available — clear stale ones
          setPending(prev => {
            if (data.rides?.length === 0) return [];
            return prev;
          });
        }
        setLastPoll(new Date());
      } catch {} // Silently fail — will retry next interval
    };

    // Poll immediately then every 5 seconds
    poll();
    pollTimer.current = setInterval(poll, 5000);

    return () => clearInterval(pollTimer.current);
  }, [isOnline]);

  // ── Socket: enhancement on top of polling ────────────────
  useEffect(() => {
    if (!socket) return;

    const onNewRide = (data) => {
      if (data.isTest) { showToast("🧪 Socket working!"); return; }
      // Socket gives instant notification, polling confirms
      setPending(prev => {
        if (prev.find(r => String(r.rideId) === String(data.rideId))) return prev;
        return [{ ...data, ts: Date.now() }, ...prev].slice(0, 20);
      });
      showToast(`🔔 New ride — ${data.cabType} · ₹${data.fare}`);
    };

    socket.on("newRideAvailable", onNewRide);

    if (isOnlineRef.current && socket.connected) {
      socket.emit("goOnline");
    }

    return () => socket.off("newRideAvailable", onNewRide);
  }, [socket]);

  // Emit goOnline whenever we go online
  useEffect(() => {
    isOnlineRef.current = isOnline;
    if (isOnline && socket?.connected) {
      socket.emit("goOnline");
    }
  }, [isOnline, socket]);

  const startGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const loc = [pos.coords.latitude, pos.coords.longitude];
      setMyLoc(loc);
      setTimeout(() => flyRef.current?.(loc[0], loc[1], 14), 500);
      api.post("/drivers/location", { lat: loc[0], lng: loc[1] }).catch(() => {});
    }, () => setTimeout(() => flyRef.current?.(28.6139, 77.2090, 12), 500));
    watchId.current = navigator.geolocation.watchPosition(
      pos => setMyLoc([pos.coords.latitude, pos.coords.longitude]),
      null, { enableHighAccuracy: true, maximumAge: 5000 }
    );
  };

  const locateMe = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(
      p => { const l = [p.coords.latitude, p.coords.longitude]; setMyLoc(l); flyRef.current?.(l[0], l[1], 15); },
      () => alert("Allow location in browser settings.")
    );
  }, []);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 5000); };

  const loadCurrentRide = async id => {
    try {
      const { data } = await api.get(`/rides/${id}`);
      const r = data.ride;
      // Only show ride if it's actually active
      if (r && ["ACCEPTED","ARRIVING","ONGOING"].includes(r.status)) {
        setCurrentRide(r);
      } else {
        setCurrentRide(null);
        // Clear from driver DB too
        if (r?.status === "CANCELLED" || r?.status === "COMPLETED") {
          api.post("/drivers/toggle-online").catch(() => {}).then(() => loadDriver());
        }
      }
    } catch {}
  };

  const toggleOnline = async () => {
    setToggling(true);
    try {
      const { data } = await api.post("/drivers/toggle-online");
      const on = data.isOnline;
      setIsOnline(on);
      isOnlineRef.current = on;
      if (on) { socket?.emit("goOnline"); showToast("🟢 Online — polling for rides every 5s"); }
      else    { socket?.emit("goOffline"); setPending([]); showToast("🔴 Offline"); }
      await loadDriver();
    } catch (e) { alert(e.response?.data?.message || "Failed."); }
    finally { setToggling(false); }
  };

  const acceptRide = async rideId => {
    try {
      const { data } = await api.post(`/rides/${rideId}/accept`);
      setCurrentRide(data.ride);
      setPending([]);
      clearInterval(pollTimer.current); // Stop polling once on a ride
      socket?.emit("joinRide", { rideId: String(rideId) });
      showToast("✅ Ride accepted!");
    } catch (e) { alert(e.response?.data?.message || "Cannot accept — ride may have been taken."); }
  };

  const updateStatus = async status => {
    if (!currentRide) return;
    try {
      await api.put(`/rides/${currentRide._id}/status`, { status });
      setCurrentRide(r => ({ ...r, status }));
      if (status === "COMPLETED") {
        setCurrentRide(null);
        await loadDriver();
        showToast("🏁 Ride completed!");
        // Resume polling
        setIsOnline(true);
      }
    } catch (e) { alert(e.response?.data?.message); }
  };

  const generateOtp = async () => {
    if (!currentRide) return;
    try {
      const { data } = await api.post(`/rides/${currentRide._id}/generate-otp`);
      setOtpData({ otp: data.otp });
      showToast("🔐 OTP: " + data.otp + " — ask rider to share it with you");
    } catch (e) { alert(e.response?.data?.message || "Failed"); }
  };

  const verifyOtp = async () => {
    if (!currentRide || !otpInput) return;
    try {
      await api.post(`/rides/${currentRide._id}/verify-otp`, { otp: otpInput });
      setCurrentRide(r => ({ ...r, status: "ONGOING" }));
      setOtpData(null); setOtpInput("");
      showToast("✅ OTP verified! Ride started.");
    } catch (e) { alert(e.response?.data?.message || "Wrong OTP. Try again."); }
  };


  if (!driverLoaded || driverLoading) {
    return (
      <RideLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 64px)", flexDirection: "column", gap: 16, color: "var(--text3)" }}>
          <div style={{ fontSize: 40, animation: "spin 1s linear infinite" }}>🚗</div>
          <div>Loading driver profile...</div>
        </div>
      </RideLayout>
    );
  }

  return (
    <RideLayout>
      <div style={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>

        <div style={{ width: 370, background: "var(--surface)", borderRight: "1px solid var(--border)", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "18px 16px 32px" }}>

            {/* Driver card */}
            <div style={{ background: "var(--surface2)", borderRadius: "var(--r-lg)", padding: 18, marginBottom: 16, border: `1.5px solid ${isOnline ? "var(--green)" : "var(--border)"}`, transition: "border-color 0.3s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 50, height: 50, borderRadius: "50%", background: "var(--accent-dim)", border: `2px solid ${isOnline ? "var(--green)" : "var(--accent)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                  {user?.gender === "FEMALE" ? "👩" : "👨"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{user?.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>⭐ {driver?.rating || 5.0} · {driver?.totalRides || 0} rides</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{driver?.vehicle?.make} {driver?.vehicle?.model} · {driver?.vehicle?.plateNumber}</div>
                  <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>
                    {isOnline ? "🟢 Online" : "🔴 Offline"}
                    {lastPoll && isOnline && ` · Polled ${Math.round((Date.now() - lastPoll) / 1000)}s ago`}
                  </div>
                </div>
              </div>
              <button onClick={toggleOnline} disabled={toggling}
                style={{ width: "100%", padding: "12px", borderRadius: "var(--r)", border: "none", background: isOnline ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)", color: isOnline ? "var(--red)" : "var(--green)", fontWeight: 800, fontSize: 14, cursor: toggling ? "not-allowed" : "pointer" }}>
                {toggling ? "Switching..." : isOnline ? "🔴 Go Offline" : "🟢 Go Online"}
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { l: "Total Rides", v: driver?.totalRides || 0, c: "var(--accent)" },
                { l: "Earnings", v: `₹${driver?.totalEarnings || 0}`, c: "var(--green)" },
                { l: "Rating", v: `⭐ ${driver?.rating || 5.0}`, c: "var(--accent)" },
                { l: "Mode", v: driver?.rideMode || "HYBRID", c: "var(--blue)" },
              ].map(s => (
                <div key={s.l} style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 12px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Active ride */}
            {currentRide && ["ACCEPTED","ARRIVING","ONGOING"].includes(currentRide.status) && (
              <div style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 16, marginBottom: 16, border: "1px solid rgba(245,197,24,0.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--accent)" }}>Active Ride</div>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 700 }}>{currentRide.status}</span>
                </div>
                <div style={{ fontSize: 13, marginBottom: 3 }}>📍 {currentRide.pickup?.address?.substring(0, 50)}</div>
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>🏁 {currentRide.drop?.address?.substring(0, 50)}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, padding: "8px 12px", background: "var(--bg2)", borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text3)" }}>{currentRide.cabType} · {currentRide.rideType}</span>
                  <span style={{ fontWeight: 800, color: "var(--accent)", fontSize: 18 }}>₹{currentRide.fareEstimate}</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {currentRide.status === "ACCEPTED" && <Chip c="var(--blue)"  fn={() => updateStatus("ARRIVING")}>🚗 Arriving</Chip>}
                  {currentRide.status === "ARRIVING"  && <Chip c="var(--green)" fn={generateOtp}>🔐 Get OTP</Chip>}
                  {currentRide.status === "ONGOING"   && <Chip c="var(--green)" fn={() => updateStatus("COMPLETED")}>🏁 Complete</Chip>}
                  <Chip c="var(--accent)" fn={() => nav(`/chat/${currentRide._id}`)}>💬 Chat</Chip>
                  <Chip c="var(--red)"    fn={() => updateStatus("CANCELLED")}>✕</Chip>
                </div>
                {/* OTP Verification Panel — shown after driver clicks Get OTP */}
                {currentRide.status === "ARRIVING" && otpData && (
                  <div style={{ marginTop: 12, padding: "14px", background: "rgba(245,197,24,0.08)", border: "1px solid rgba(245,197,24,0.3)", borderRadius: 10 }}>
                    <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 8 }}>
                      📱 Ask rider for their <strong style={{ color: "var(--accent)" }}>4-digit OTP</strong>:
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={otpInput}
                        onChange={e => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="• • • •"
                        maxLength={4}
                        style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 22, textAlign: "center", letterSpacing: 10, fontWeight: 800 }}
                      />
                      <button onClick={verifyOtp} disabled={otpInput.length !== 4}
                        style={{ padding: "10px 18px", background: otpInput.length === 4 ? "var(--green)" : "var(--border)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 800, fontSize: 16, cursor: otpInput.length === 4 ? "pointer" : "not-allowed" }}>
                        ✓
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pending requests */}
            {isOnline && !currentRide && (
              <>
                {pending.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "28px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>🟢</div>
                    <div style={{ fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>Online — Waiting for rides</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>Checking every 5 seconds for {driver?.vehicle?.cabType} requests</div>
                    {lastPoll && (
                      <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 8, padding: "4px 10px", background: "var(--bg2)", borderRadius: 6, display: "inline-block" }}>
                        Last checked: {lastPoll.toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                      🔔 {pending.length} Ride Request{pending.length > 1 ? "s" : ""}
                    </div>
                    {pending.map((req, i) => (
                      <div key={req.rideId || i} style={{ background: "var(--surface2)", borderRadius: 10, padding: 14, marginBottom: 10, border: "1px solid rgba(34,197,94,0.35)", animation: "fadeSlide 0.25s ease" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{req.rideType} · {req.cabType}</span>
                          <span style={{ fontWeight: 800, color: "var(--accent)", fontSize: 20 }}>₹{req.fare}</span>
                        </div>
                        {req.pickup?.address && <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 3 }}>📍 {String(req.pickup.address).substring(0, 55)}</div>}
                        {req.distanceKm && <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10 }}>{req.distanceKm} km</div>}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => acceptRide(req.rideId)}
                            style={{ flex: 1, padding: "11px", background: "var(--green)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                            ✅ Accept
                          </button>
                          <button onClick={() => setPending(p => p.filter((_, j) => j !== i))}
                            style={{ padding: "11px 18px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "var(--red)", cursor: "pointer", fontSize: 18 }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}

            {!isOnline && !currentRide && (
              <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text3)" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔴</div>
                <div>Go online to receive rides</div>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: "100%", width: "100%" }}>
            <TileLayer url={`https://maps.geoapify.com/v1/tile/osm-bright-smooth/{z}/{x}/{y}.png?apiKey=${KEY}`} attribution='© Geoapify' />
            <MapController flyRef={flyRef} />
            {myLoc && <Marker position={myLoc} icon={carIcon}><Popup>🚗 You</Popup></Marker>}
            {currentRide?.pickup?.coordinates && (
              <Marker position={[currentRide.pickup.coordinates.lat, currentRide.pickup.coordinates.lng]}>
                <Popup>🟢 Pickup</Popup>
              </Marker>
            )}
          </MapContainer>

          <button onClick={locateMe} title="My location"
            style={{ position: "absolute", bottom: 90, right: 14, width: 42, height: 42, zIndex: 1000, borderRadius: 10, background: "rgba(12,12,15,0.92)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
            📍
          </button>

          <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(12,12,15,0.9)", backdropFilter: "blur(12px)", borderRadius: 10, padding: "8px 14px", border: `1px solid ${isOnline ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.25)"}`, zIndex: 1000, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: isOnline ? "var(--green)" : "var(--red)", animation: isOnline ? "blink 2s infinite" : "none" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: isOnline ? "var(--green)" : "var(--red)" }}>
              {isOnline ? "Online · Polling" : "Offline"}
            </span>
          </div>
        </div>

        {toast && (
          <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "12px 24px", borderRadius: 12, fontWeight: 600, fontSize: 14, zIndex: 9999, boxShadow: "var(--shadow)", animation: "slideDown 0.3s ease", maxWidth: 420, textAlign: "center" }}>
            {toast}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeSlide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
        @keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </RideLayout>
  );
}

const Chip = ({ children, fn, c }) => (
  <button onClick={fn} style={{ padding: "7px 12px", background: `${c}18`, border: `1px solid ${c}44`, borderRadius: 8, color: c, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
    {children}
  </button>
);
