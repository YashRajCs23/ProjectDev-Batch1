// src/pages/driver/DriverDashboard.jsx — Fixed: ride requests, modern map, locate button
import React, { useEffect, useState, useRef } from "react";
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

const myIcon = new L.DivIcon({
  html: `<div style="background:#f5c518;border:3px solid #000;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 10px rgba(245,197,24,0.5)">🚗</div>`,
  className: "", iconSize: [30, 30], iconAnchor: [15, 15],
});

function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => { if (center?.[0]) map.flyTo(center, 14, { duration: 0.8 }); }, [center?.[0], center?.[1]]);
  return null;
}

export default function DriverDashboard() {
  const { user, driverProfile, loadDriver } = useAuth();
  const { socket } = useSocket();
  const nav = useNavigate();

  const [driver, setDriver] = useState(driverProfile);
  const [isOnline, setIsOnline] = useState(driverProfile?.isOnline || false);
  const [pendingRides, setPendingRides] = useState([]);
  const [currentRide, setCurrentRide] = useState(null);
  const [myLoc, setMyLoc] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [notification, setNotification] = useState(null);
  const watchId = useRef(null);

  useEffect(() => {
    if (!driverProfile) { nav("/driver/setup"); return; }
    setDriver(driverProfile);
    setIsOnline(driverProfile.isOnline || false);
    if (driverProfile.currentRideId) loadCurrentRide(driverProfile.currentRideId);
    startGPS();
    return () => { if (watchId.current) navigator.geolocation.clearWatch(watchId.current); };
  }, [driverProfile]);

  const startGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const loc = [pos.coords.latitude, pos.coords.longitude];
      setMyLoc(loc);
      api.post("/drivers/location", { lat: loc[0], lng: loc[1] }).catch(() => {});
    });
    watchId.current = navigator.geolocation.watchPosition((pos) => {
      const loc = [pos.coords.latitude, pos.coords.longitude];
      setMyLoc(loc);
    }, null, { enableHighAccuracy: true });
  };

  // Socket listeners — depend on socket being ready
  useEffect(() => {
    if (!socket) return;

    const onNewRide = (data) => {
      console.log("📨 New ride request received:", data);
      // Show notification
      setNotification(`New ${data.rideType || "PRIVATE"} ride request — ₹${data.fare}`);
      setTimeout(() => setNotification(null), 5000);

      setPendingRides((prev) => {
        const exists = prev.find((r) => String(r.rideId) === String(data.rideId));
        if (exists) return prev;
        return [data, ...prev].slice(0, 15);
      });
    };

    const onRideUnavailable = ({ rideId }) => {
      setPendingRides((prev) => prev.filter((r) => String(r.rideId) !== String(rideId)));
    };

    socket.on("newRideAvailable", onNewRide);
    socket.on("rideUnavailable", onRideUnavailable);

    // Rejoin online room if already online
    if (isOnline) socket.emit("goOnline");

    return () => {
      socket.off("newRideAvailable", onNewRide);
      socket.off("rideUnavailable", onRideUnavailable);
    };
  }, [socket]);

  const loadCurrentRide = async (rideId) => {
    try {
      const { data } = await api.get(`/rides/${rideId}`);
      setCurrentRide(data.ride);
    } catch {}
  };

  const toggleOnline = async () => {
    setToggling(true);
    try {
      const { data } = await api.post("/drivers/toggle-online");
      const nowOnline = data.isOnline;
      setIsOnline(nowOnline);
      if (nowOnline) {
        socket?.emit("goOnline");
      } else {
        socket?.emit("goOffline");
        setPendingRides([]);
      }
      await loadDriver();
    } catch (e) { alert(e.response?.data?.message || "Failed to toggle status."); }
    finally { setToggling(false); }
  };

  const acceptRide = async (rideId) => {
    try {
      const { data } = await api.post(`/rides/${rideId}/accept`);
      setCurrentRide(data.ride);
      setPendingRides([]);
      socket?.emit("joinRide", { rideId });
    } catch (e) { alert(e.response?.data?.message || "Could not accept ride."); }
  };

  const updateStatus = async (status) => {
    if (!currentRide) return;
    try {
      await api.put(`/rides/${currentRide._id}/status`, { status });
      setCurrentRide((r) => ({ ...r, status }));
      if (status === "COMPLETED") {
        setCurrentRide(null);
        await loadDriver();
        setDriver(driverProfile);
      }
    } catch (e) { alert(e.response?.data?.message); }
  };

  const dismissRide = (rideId) => {
    setPendingRides((p) => p.filter((r) => String(r.rideId) !== String(rideId)));
  };

  const mapCenter = myLoc || [28.6139, 77.2090];

  return (
    <RideLayout>
      <div style={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>

        {/* ── Left panel ── */}
        <div style={{ width: 370, background: "var(--surface)", borderRight: "1px solid var(--border)", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "20px 18px 28px" }}>

            {/* Driver card */}
            <div style={{ background: "var(--surface2)", borderRadius: "var(--r-lg)", padding: "18px", marginBottom: 16, border: `1px solid ${isOnline ? "var(--green)" : "var(--border)"}`, transition: "border-color 0.3s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 50, height: 50, borderRadius: "50%", background: "var(--accent-dim)", border: `2px solid ${isOnline ? "var(--green)" : "var(--accent)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                  {user?.gender === "FEMALE" ? "👩" : "👨"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{user?.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>⭐ {driver?.rating || 5.0} · {driver?.totalRides || 0} rides</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{driver?.vehicle?.make} {driver?.vehicle?.model} · {driver?.vehicle?.plateNumber}</div>
                </div>
              </div>

              <button onClick={toggleOnline} disabled={toggling}
                style={{ width: "100%", padding: "12px", borderRadius: "var(--r)", border: "none", background: isOnline ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)", color: isOnline ? "var(--red)" : "var(--green)", fontWeight: 800, fontSize: 14, cursor: toggling ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                {toggling ? "Switching..." : isOnline ? "🔴 Go Offline" : "🟢 Go Online"}
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Total Rides", value: driver?.totalRides || 0, color: "var(--accent)" },
                { label: "Total Earnings", value: `₹${driver?.totalEarnings || 0}`, color: "var(--green)" },
                { label: "Rating", value: `⭐ ${driver?.rating || 5.0}`, color: "var(--accent)" },
                { label: "Mode", value: driver?.rideMode || "HYBRID", color: "var(--blue)" },
              ].map(s => (
                <div key={s.label} style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 12px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Active ride */}
            {currentRide && (
              <div style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 16, marginBottom: 16, border: "1px solid rgba(245,197,24,0.3)" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--accent)", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                  Active Ride
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "var(--accent-dim)", color: "var(--accent)" }}>{currentRide.status}</span>
                </div>
                <div style={{ fontSize: 13, marginBottom: 3 }}>📍 {currentRide.pickup?.address?.substring(0, 45)}...</div>
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>🏁 {currentRide.drop?.address?.substring(0, 45)}...</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, padding: "8px 12px", background: "var(--bg2)", borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text3)" }}>{currentRide.cabType} · {currentRide.rideType}</span>
                  <span style={{ fontWeight: 800, color: "var(--accent)", fontSize: 16 }}>₹{currentRide.fareEstimate}</span>
                </div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {currentRide.status === "ACCEPTED" && (
                    <Chip color="var(--blue)" onClick={() => updateStatus("ARRIVING")}>🚗 I'm Arriving</Chip>
                  )}
                  {currentRide.status === "ARRIVING" && (
                    <Chip color="var(--green)" onClick={() => updateStatus("ONGOING")}>▶️ Start Ride</Chip>
                  )}
                  {currentRide.status === "ONGOING" && (
                    <Chip color="var(--green)" onClick={() => updateStatus("COMPLETED")}>🏁 Complete Ride</Chip>
                  )}
                  <Chip color="var(--accent)" onClick={() => nav(`/chat/${currentRide._id}`)}>💬 Chat</Chip>
                  <Chip color="var(--red)" onClick={() => updateStatus("CANCELLED")}>✕ Cancel</Chip>
                </div>
              </div>
            )}

            {/* Pending ride requests */}
            {isOnline && !currentRide && (
              <div>
                {pendingRides.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>🟢</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>You're online</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Waiting for ride requests...</div>
                    <div style={{ fontSize: 11, marginTop: 16, color: "var(--text3)", padding: "8px 12px", background: "var(--bg2)", borderRadius: 8 }}>
                      Requests appear here when riders book a {driver?.vehicle?.cabType || "ride"} near you
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                      🔔 {pendingRides.length} Ride Request{pendingRides.length > 1 ? "s" : ""}
                    </div>
                    {pendingRides.map((req, i) => (
                      <div key={i} style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 14, marginBottom: 10, border: "1px solid rgba(34,197,94,0.3)", animation: "slideIn 0.3s ease" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{req.rideType || "PRIVATE"} · {req.cabType}</span>
                          <span style={{ fontWeight: 800, color: "var(--accent)", fontSize: 16 }}>₹{req.fare}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 3 }}>
                          📍 {req.pickup?.address?.substring(0, 45)}...
                        </div>
                        {req.distanceKm && (
                          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10 }}>
                            {req.distanceKm} km away
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => acceptRide(req.rideId)}
                            style={{ flex: 1, padding: "10px", background: "var(--green)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                            ✅ Accept
                          </button>
                          <button onClick={() => dismissRide(req.rideId)}
                            style={{ padding: "10px 14px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, color: "var(--red)", cursor: "pointer", fontSize: 14 }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {!isOnline && !currentRide && (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🔴</div>
                <div>Go online to receive ride requests</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Map ── */}
        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              url={`https://maps.geoapify.com/v1/tile/osm-bright-smooth/{z}/{x}/{y}.png?apiKey=${KEY}`}
              attribution='© <a href="https://www.geoapify.com/">Geoapify</a>'
            />
            <FlyTo center={mapCenter} />
            {myLoc && (
              <Marker position={myLoc} icon={myIcon}>
                <Popup>🚗 Your location</Popup>
              </Marker>
            )}
            {currentRide?.pickup?.coordinates && (
              <Marker position={[currentRide.pickup.coordinates.lat, currentRide.pickup.coordinates.lng]}>
                <Popup>🟢 Pickup: {currentRide.pickup.address}</Popup>
              </Marker>
            )}
            {currentRide?.drop?.coordinates && (
              <Marker position={[currentRide.drop.coordinates.lat, currentRide.drop.coordinates.lng]}>
                <Popup>🔴 Drop: {currentRide.drop.address}</Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Locate me button */}
          <div style={{ position: "absolute", bottom: 80, right: 12, zIndex: 1000 }}>
            <button onClick={() => { if (myLoc) {} else startGPS(); }} title="My Location"
              style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(12,12,15,0.9)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
              📍
            </button>
          </div>

          {/* Online status overlay */}
          <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(12,12,15,0.9)", backdropFilter: "blur(12px)", borderRadius: 10, padding: "8px 14px", border: `1px solid ${isOnline ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.3)"}`, zIndex: 1000, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: isOnline ? "var(--green)" : "var(--red)", animation: isOnline ? "pulse 2s infinite" : "none" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: isOnline ? "var(--green)" : "var(--red)" }}>{isOnline ? "Online" : "Offline"}</span>
            {myLoc && <span style={{ fontSize: 11, color: "var(--text3)" }}>· GPS active</span>}
          </div>
        </div>

        {/* Toast notification for new ride */}
        {notification && (
          <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: "var(--green)", color: "#fff", padding: "12px 24px", borderRadius: 12, fontWeight: 700, fontSize: 14, zIndex: 9999, boxShadow: "0 4px 24px rgba(34,197,94,0.4)", animation: "slideDown 0.3s ease" }}>
            🔔 {notification}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: none; } }
        @keyframes slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </RideLayout>
  );
}

const Chip = ({ children, onClick, color }) => (
  <button onClick={onClick}
    style={{ padding: "7px 12px", background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 8, color, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
    {children}
  </button>
);
