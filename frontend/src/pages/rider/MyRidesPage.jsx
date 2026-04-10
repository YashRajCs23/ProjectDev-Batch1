// src/pages/rider/MyRidesPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import RideLayout from "../../components/common/RideLayout";

const STATUS_COLORS = {
  SEARCHING: "var(--accent)", ACCEPTED: "var(--blue)", ARRIVING: "var(--accent2)",
  ONGOING: "var(--green)", COMPLETED: "var(--text3)", CANCELLED: "var(--red)",
};

export default function MyRidesPage() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    api.get("/rides/my-rides").then(({ data }) => {
      setRides(data.rides || []);
      setLoading(false);
    });
  }, []);

  return (
    <RideLayout>
      <div style={{ padding: "32px 40px", maxWidth: 800 }}>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: 32, color: "var(--accent)", letterSpacing: 1, marginBottom: 4 }}>MY RIDES</h1>
        <p style={{ color: "var(--text2)", marginBottom: 28 }}>Your ride history</p>

        {loading ? <p style={{ color: "var(--text3)" }}>Loading...</p>
          : rides.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🚗</div>
              <p style={{ color: "var(--text3)", marginBottom: 16 }}>No rides yet.</p>
              <button onClick={() => nav("/ride")} style={{ padding: "11px 24px", background: "var(--accent)", border: "none", borderRadius: "var(--r)", color: "#000", fontWeight: 700, cursor: "pointer" }}>
                Book Your First Ride
              </button>
            </div>
          ) : rides.map((ride) => {
            const myRider = ride.riders?.find((r) => r.riderId);
            return (
              <div key={ride._id} onClick={() => ["SEARCHING","ACCEPTED","ARRIVING","ONGOING"].includes(ride.status) ? nav(`/ride/track/${ride._id}`) : null}
                style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20, marginBottom: 14, cursor: ["SEARCHING","ACCEPTED","ARRIVING","ONGOING"].includes(ride.status) ? "pointer" : "default" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                      {ride.pickup?.address?.substring(0, 35)}... → {ride.drop?.address?.substring(0, 35)}...
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text2)" }}>
                      {new Date(ride.createdAt).toLocaleString()} · {ride.rideType} · {ride.cabType}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ display: "block", fontWeight: 800, fontSize: 18, color: "var(--accent)" }}>₹{myRider?.fare || ride.fareEstimate}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: `${STATUS_COLORS[ride.status]}22`, color: STATUS_COLORS[ride.status], fontWeight: 600 }}>
                      {ride.status}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text3)" }}>
                  <span>📏 {ride.distanceKm} km</span>
                  <span>⏱ {ride.durationMin} min</span>
                  <span>💳 {ride.paymentMethod}</span>
                  {ride.isPaid && <span style={{ color: "var(--green)" }}>✅ Paid</span>}
                </div>
                {["SEARCHING","ACCEPTED","ARRIVING","ONGOING"].includes(ride.status) && (
                  <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(245,197,24,0.08)", borderRadius: 8, fontSize: 13, color: "var(--accent)" }}>
                    → Track this ride
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </RideLayout>
  );
}
