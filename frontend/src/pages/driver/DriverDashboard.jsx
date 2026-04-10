// src/pages/driver/DriverDashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import api from "../../utils/api";
import RideLayout from "../../components/common/RideLayout";

const GEOAPIFY_KEY = "42275beb38a64d1486b88a378b90a008";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FlyTo({ coords }) {
  const map = useMap();
  useEffect(() => { if (coords) map.flyTo(coords, 14); }, [coords]);
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
  const [myLocation, setMyLocation] = useState(null);
  const [toggling, setToggling] = useState(false);
  const locationRef = useRef(null);

  useEffect(() => {
    if (!driverProfile) {
      nav("/driver/setup");
      return;
    }
    setDriver(driverProfile);
    setIsOnline(driverProfile.isOnline);

    if (driverProfile.currentRideId) {
      loadCurrentRide(driverProfile.currentRideId);
    }

    // Get GPS location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(loc);
        api.post("/drivers/location", loc).catch(() => {});
      });
      locationRef.current = navigator.geolocation.watchPosition((pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(loc);
        if (isOnline) {
          api.post("/drivers/location", loc).catch(() => {});
          if (currentRide?._id) {
            socket?.emit("driverLocation", { rideId: currentRide._id, ...loc });
          }
        }
      });
    }

    return () => {
      if (locationRef.current) navigator.geolocation.clearWatch(locationRef.current);
    };
  }, [driverProfile]);

  useEffect(() => {
    if (!socket) return;
    socket.on("newRideAvailable", (data) => {
      setPendingRides((prev) => {
        if (prev.find((r) => r.rideId === data.rideId)) return prev;
        return [data, ...prev].slice(0, 10);
      });
    });
    return () => socket.off("newRideAvailable");
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
      setIsOnline(data.isOnline);
      if (data.isOnline) socket?.emit("goOnline");
      else socket?.emit("goOffline");
      await loadDriver();
    } catch (e) { alert(e.response?.data?.message || "Failed"); }
    finally { setToggling(false); }
  };

  const acceptRide = async (rideId) => {
    try {
      const { data } = await api.post(`/rides/${rideId}/accept`);
      setCurrentRide(data.ride);
      setPendingRides([]);
      socket?.emit("joinRide", { rideId });
    } catch (e) { alert(e.response?.data?.message || "Could not accept ride"); }
  };

  const updateStatus = async (status) => {
    try {
      await api.put(`/rides/${currentRide._id}/status`, { status });
      setCurrentRide((r) => ({ ...r, status }));
      if (status === "COMPLETED") {
        setCurrentRide(null);
        await loadDriver();
      }
    } catch (e) { alert(e.response?.data?.message); }
  };

  const mapCenter = myLocation ? [myLocation.lat, myLocation.lng]
    : currentRide?.pickup?.coordinates ? [currentRide.pickup.coordinates.lat, currentRide.pickup.coordinates.lng]
    : [28.6139, 77.2090];

  return (
    <RideLayout>
      <div style={{ display: "flex", height: "calc(100vh - 64px)" }}>
        {/* ── Left panel ── */}
        <div style={{ width: 360, background: "var(--surface)", borderRight: "1px solid var(--border)", overflowY: "auto", padding: 24, flexShrink: 0 }}>

          {/* Driver info card */}
          <div style={{ background: "var(--surface2)", borderRadius: "var(--r-lg)", padding: 20, marginBottom: 20, border: `1px solid ${isOnline ? "var(--green)" : "var(--border)"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, border: "2px solid var(--accent)" }}>
                {user?.gender === "FEMALE" ? "👩" : "👨"}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.name}</div>
                <div style={{ fontSize: 13, color: "var(--text3)" }}>
                  ⭐ {driver?.rating || 5.0} · {driver?.totalRides || 0} rides
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)" }}>
                  {driver?.vehicle?.make} {driver?.vehicle?.model} · {driver?.vehicle?.plateNumber}
                </div>
              </div>
            </div>

            {/* Online toggle */}
            <button onClick={toggleOnline} disabled={toggling}
              style={{ width: "100%", padding: "12px", borderRadius: "var(--r)", border: "none", background: isOnline ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)", color: isOnline ? "var(--red)" : "var(--green)", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              {toggling ? "..." : isOnline ? "🔴 Go Offline" : "🟢 Go Online"}
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Total Rides", value: driver?.totalRides || 0 },
              { label: "Total Earnings", value: `₹${driver?.totalEarnings || 0}` },
              { label: "Rating", value: `⭐ ${driver?.rating || 5.0}` },
              { label: "Mode", value: driver?.rideMode || "—" },
            ].map((s) => (
              <div key={s.label} style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Current ride */}
          {currentRide && (
            <div style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 16, marginBottom: 16, border: "1px solid var(--accent)44" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)", marginBottom: 12 }}>Active Ride</div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>📍 {currentRide.pickup?.address}</div>
              <div style={{ fontSize: 13, marginBottom: 12, color: "var(--text2)" }}>🏁 {currentRide.drop?.address}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "var(--text3)" }}>Fare</span>
                <span style={{ fontWeight: 800, color: "var(--accent)" }}>₹{currentRide.fareEstimate}</span>
              </div>

              {/* Status action buttons */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {currentRide.status === "ACCEPTED" && (
                  <ActionBtn onClick={() => updateStatus("ARRIVING")} color="var(--blue)">🚗 Arriving</ActionBtn>
                )}
                {currentRide.status === "ARRIVING" && (
                  <ActionBtn onClick={() => updateStatus("ONGOING")} color="var(--green)">▶️ Start Ride</ActionBtn>
                )}
                {currentRide.status === "ONGOING" && (
                  <ActionBtn onClick={() => updateStatus("COMPLETED")} color="var(--green)">🏁 Complete</ActionBtn>
                )}
                <ActionBtn onClick={() => nav(`/chat/${currentRide._id}`)} color="var(--accent)">💬 Chat</ActionBtn>
                <ActionBtn onClick={() => nav(`/ride/track/${currentRide._id}`)} color="var(--text2)">🗺 Map</ActionBtn>
              </div>
            </div>
          )}

          {/* Pending ride requests */}
          {isOnline && !currentRide && pendingRides.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>NEW RIDE REQUESTS</div>
              {pendingRides.map((req, i) => (
                <div key={i} style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 14, marginBottom: 10, border: "1px solid var(--green)44", animation: "fadeIn 0.3s ease" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>📍 {req.pickup?.address?.substring(0, 40)}...</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--text3)" }}>{req.rideType} · {req.cabType}</span>
                    <span style={{ fontWeight: 800, color: "var(--accent)" }}>₹{req.fare}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => acceptRide(req.rideId)}
                      style={{ flex: 1, padding: "9px", background: "var(--green)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                      ✅ Accept
                    </button>
                    <button onClick={() => setPendingRides((p) => p.filter((_, j) => j !== i))}
                      style={{ padding: "9px 14px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "var(--red)", cursor: "pointer" }}>
                      ❌
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isOnline && !currentRide && pendingRides.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🟢</div>
              <div>You're online. Waiting for ride requests...</div>
            </div>
          )}

          {!isOnline && !currentRide && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔴</div>
              <div>Go online to receive ride requests</div>
            </div>
          )}
        </div>

        {/* ── Map ── */}
        <div style={{ flex: 1 }}>
          <MapContainer center={mapCenter} zoom={14} style={{ height: "100%", width: "100%" }}>
            <TileLayer url={`https://maps.geoapify.com/v1/tile/carto/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`} attribution="© Geoapify" />
            <FlyTo coords={mapCenter} />
            {myLocation && (
              <Marker position={[myLocation.lat, myLocation.lng]}>
                <Popup>📍 You are here</Popup>
              </Marker>
            )}
            {currentRide?.pickup?.coordinates && (
              <Marker position={[currentRide.pickup.coordinates.lat, currentRide.pickup.coordinates.lng]}>
                <Popup>🟢 Pickup</Popup>
              </Marker>
            )}
            {currentRide?.drop?.coordinates && (
              <Marker position={[currentRide.drop.coordinates.lat, currentRide.drop.coordinates.lng]}>
                <Popup>🔴 Drop</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }`}</style>
    </RideLayout>
  );
}

const ActionBtn = ({ children, onClick, color }) => (
  <button onClick={onClick}
    style={{ padding: "8px 12px", background: `${color}22`, border: `1px solid ${color}44`, borderRadius: 8, color, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
    {children}
  </button>
);
