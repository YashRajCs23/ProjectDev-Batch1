// src/pages/driver/DriverRidesPage.jsx
import React, { useEffect, useState } from "react";
import api from "../../utils/api";
import RideLayout from "../../components/common/RideLayout";

export default function DriverRidesPage() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/rides/driver-rides").then(({ data }) => {
      setRides(data.rides || []);
      setLoading(false);
    });
  }, []);

  const total = rides.filter((r) => r.status === "COMPLETED").reduce((s, r) => s + r.fareEstimate, 0);

  return (
    <RideLayout>
      <div style={{ padding: "32px 40px", maxWidth: 800 }}>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: 32, color: "var(--accent)", letterSpacing: 1, marginBottom: 4 }}>RIDE HISTORY</h1>
        <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "14px 20px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)" }}>{rides.length}</div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>Total Rides</div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "14px 20px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green)" }}>₹{total}</div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>Total Earned</div>
          </div>
        </div>

        {loading ? <p style={{ color: "var(--text3)" }}>Loading...</p>
          : rides.length === 0 ? <p style={{ color: "var(--text3)" }}>No rides yet.</p>
          : rides.map((ride) => (
            <div key={ride._id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{ride.pickup?.address?.substring(0, 40)}...</div>
                  <div style={{ fontSize: 13, color: "var(--text2)" }}>→ {ride.drop?.address?.substring(0, 40)}...</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, fontSize: 18, color: "var(--accent)" }}>₹{ride.fareEstimate}</div>
                  <div style={{ fontSize: 11, color: ride.status === "COMPLETED" ? "var(--green)" : "var(--red)" }}>{ride.status}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text3)", display: "flex", gap: 16 }}>
                <span>{new Date(ride.createdAt).toLocaleDateString()}</span>
                <span>{ride.rideType} · {ride.cabType}</span>
                <span>{ride.riders?.length} passenger{ride.riders?.length > 1 ? "s" : ""}</span>
                <span>{ride.distanceKm} km</span>
              </div>
            </div>
          ))}
      </div>
    </RideLayout>
  );
}
