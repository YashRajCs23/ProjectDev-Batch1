// src/components/common/SOSButton.jsx
import React, { useState } from "react";
import api from "../../utils/api";

export default function SOSButton() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const trigger = async () => {
    setLoading(true);
    try {
      const loc = await new Promise((res) => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => res({ lat: 28.6139, lng: 77.2090 })
          );
        } else res({ lat: 28.6139, lng: 77.2090 });
      });
      await api.post("/emergency/alert", { location: { ...loc, address: "Current GPS Location" } });
      setSent(true);
      setTimeout(() => { setSent(false); setShow(false); }, 3000);
    } catch { alert("SOS failed. Try again."); }
    setLoading(false);
  };

  return (
    <>
      <button onClick={() => setShow(true)} title="SOS Emergency"
        style={{ position: "fixed", bottom: 28, right: 28, width: 54, height: 54, borderRadius: "50%", background: "var(--red)", border: "none", color: "#fff", fontSize: 12, fontWeight: 800, fontFamily: "var(--font-head)", cursor: "pointer", letterSpacing: 0.5, zIndex: 9999, animation: "sosPulse 2s infinite", boxShadow: "0 0 0 4px rgba(239,68,68,0.25)" }}>
        SOS
      </button>

      {show && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--red)", borderRadius: "var(--r-lg)", padding: 32, maxWidth: 360, width: "90%", textAlign: "center" }}>
            {sent ? (
              <>
                <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
                <h3 style={{ color: "var(--green)", marginBottom: 8 }}>Alert Sent!</h3>
                <p style={{ color: "var(--text2)", fontSize: 14 }}>Your trusted contacts and emergency services have been notified.</p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 52, marginBottom: 12 }}>🚨</div>
                <h3 style={{ color: "var(--red)", fontSize: 20, marginBottom: 8 }}>Send SOS Alert?</h3>
                <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 24 }}>This will share your GPS location with emergency contacts. Only use in genuine emergencies.</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShow(false)}
                    style={{ flex: 1, padding: "12px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text2)", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={trigger} disabled={loading}
                    style={{ flex: 1, padding: "12px", background: "var(--red)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, cursor: loading ? "not-allowed" : "pointer" }}>
                    {loading ? "Sending..." : "🚨 SEND SOS"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes sosPulse { 0%,100%{box-shadow:0 0 0 4px rgba(239,68,68,0.25),0 4px 20px rgba(239,68,68,0.3)} 50%{box-shadow:0 0 0 10px rgba(239,68,68,0.05),0 4px 30px rgba(239,68,68,0.5)} }`}</style>
    </>
  );
}
