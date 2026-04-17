// src/pages/driver/JoinRequestsPage.jsx — Driver manages join requests
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "../../context/SocketContext";
import api from "../../utils/api";
import RideLayout from "../../components/common/RideLayout";

export default function JoinRequestsPage() {
  const { rideId } = useParams();
  const { socket } = useSocket();
  const nav = useNavigate();

  const [ride, setRide]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [responding, setResponding] = useState(null);

  useEffect(() => {
    loadRide();
    if (socket) {
      socket.emit("joinRide", { rideId });
      socket.on("joinRequestReceived", () => loadRide());
    }
    return () => socket?.off("joinRequestReceived");
  }, [rideId, socket]);

  const loadRide = async () => {
    try { const { data } = await api.get(`/rides/${rideId}`); setRide(data.ride); }
    catch {} finally { setLoading(false); }
  };

  const respond = async (requestId, action) => {
    setResponding(requestId);
    try {
      await api.post(`/rides/${rideId}/respond-join`, { requestId, action });
      await loadRide();
    } catch (e) { alert(e.response?.data?.message || "Failed."); }
    setResponding(null);
  };

  if (loading) return <RideLayout><div style={{ textAlign: "center", padding: "80px 0", color: "var(--text3)" }}>Loading...</div></RideLayout>;

  const pending  = (ride?.joinRequests || []).filter(r => r.status === "PENDING");
  const approved = (ride?.joinRequests || []).filter(r => r.status === "APPROVED");
  const rejected = (ride?.joinRequests || []).filter(r => r.status === "REJECTED");

  return (
    <RideLayout>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <button onClick={() => nav(-1)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 20 }}>←</button>
          <h1 style={{ fontFamily: "var(--font-head)", fontSize: 24, color: "var(--accent)", letterSpacing: 1 }}>JOIN REQUESTS</h1>
        </div>

        {/* Pool summary */}
        {ride && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 13, marginBottom: 4 }}>📍 {ride.pickup?.address?.split(",")[0]} → 🏁 {ride.drop?.address?.split(",")[0]}</div>
            <div style={{ fontSize: 12, color: "var(--text3)", display: "flex", gap: 16 }}>
              <span>🕐 {new Date(ride.departureTime).toLocaleString("en-IN", { weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit" })}</span>
              <span>🪑 {ride.availableSeats} seats left of {ride.maxRiders}</span>
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>₹{ride.fareEstimate}/seat</span>
            </div>
          </div>
        )}

        {/* Pending requests */}
        {pending.length > 0 && (
          <>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              🔔 {pending.length} Pending Request{pending.length > 1 ? "s" : ""}
            </div>
            {pending.map(req => (
              <div key={req._id} style={{ background: "var(--surface)", border: "1px solid rgba(245,197,24,0.3)", borderRadius: 12, padding: 16, marginBottom: 12, animation: "fadeIn 0.3s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>👤 {req.riderName}</div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: req.routeMatchPct >= 80 ? "var(--green)" : "var(--accent)", lineHeight: 1 }}>{req.routeMatchPct}%</div>
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>match</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>📍 {req.pickupAddress?.split(",")[0]}</div>
                <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: req.message ? 8 : 12 }}>🏁 {req.dropAddress?.split(",")[0]}</div>
                {req.message && (
                  <div style={{ fontSize: 12, color: "var(--text3)", background: "var(--bg2)", borderRadius: 8, padding: "6px 10px", marginBottom: 12, fontStyle: "italic" }}>
                    "{req.message}"
                  </div>
                )}
                <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700, marginBottom: 10 }}>₹{req.fare} fare share</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => respond(req._id, "APPROVED")} disabled={responding === req._id || ride.availableSeats <= 0}
                    style={{ flex: 1, padding: "10px", background: "var(--green)", border: "none", borderRadius: 9, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                    {responding === req._id ? "..." : "✅ Accept"}
                  </button>
                  <button onClick={() => respond(req._id, "REJECTED")} disabled={responding === req._id}
                    style={{ flex: 1, padding: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, color: "var(--red)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    ✕ Decline
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {pending.length === 0 && approved.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text3)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>No pending requests</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Riders will appear here when they request to join your pool</div>
          </div>
        )}

        {/* Approved passengers */}
        {approved.length > 0 && (
          <>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--green)", textTransform: "uppercase", letterSpacing: 1, marginTop: 24, marginBottom: 12 }}>
              ✅ {approved.length} Approved Passenger{approved.length > 1 ? "s" : ""}
            </div>
            {approved.map(req => (
              <div key={req._id} style={{ background: "var(--surface)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, padding: 14, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>👤 {req.riderName}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>📍 {req.pickupAddress?.split(",")[0]}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: "var(--green)" }}>{req.routeMatchPct}% match</div>
                  <div style={{ fontSize: 12, color: "var(--accent)" }}>₹{req.fare}</div>
                </div>
              </div>
            ))}
          </>
        )}

        <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}`}</style>
      </div>
    </RideLayout>
  );
}
