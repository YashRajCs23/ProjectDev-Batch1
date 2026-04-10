// src/pages/driver/DriverSetupPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";

export default function DriverSetupPage() {
  const { loadDriver } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    make: "", model: "", year: new Date().getFullYear(), color: "", plateNumber: "", cabType: "SEDAN",
    licenseNumber: "", rideMode: "HYBRID", tripType: "INTRACITY", genderPreference: "ANY",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    setLoading(true);
    try {
      await api.post("/drivers/register", {
        vehicle: { make: form.make, model: form.model, year: parseInt(form.year), color: form.color, plateNumber: form.plateNumber, cabType: form.cabType },
        licenseNumber: form.licenseNumber,
        rideMode: form.rideMode,
        tripType: form.tripType,
        genderPreference: form.genderPreference,
      });
      await loadDriver();
      nav("/driver");
    } catch (e) { setErr(e.response?.data?.message || "Setup failed."); }
    finally { setLoading(false); }
  };

  const F = ({ label, k, type = "text", children }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>{label}</label>
      {children || <input type={type} value={form[k]} onChange={set(k)} style={{ width: "100%", padding: "11px 14px" }} />}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ fontFamily: "var(--font-head)", fontSize: 36, color: "var(--accent)", textAlign: "center", marginBottom: 28, letterSpacing: 2 }}>DRIVER SETUP</div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "36px 32px" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Setup Your Driver Profile</h2>
          <p style={{ color: "var(--text2)", fontSize: 13, marginBottom: 24 }}>You'll need admin approval before you can start driving.</p>

          {err && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{err}</div>}

          <form onSubmit={submit}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)", marginBottom: 12 }}>🚗 Vehicle Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <F label="Make" k="make"><input value={form.make} onChange={set("make")} placeholder="e.g. Maruti" style={{ width: "100%", padding: "11px 14px" }} /></F>
              <F label="Model" k="model"><input value={form.model} onChange={set("model")} placeholder="e.g. Swift" style={{ width: "100%", padding: "11px 14px" }} /></F>
              <F label="Year" k="year"><input type="number" value={form.year} onChange={set("year")} style={{ width: "100%", padding: "11px 14px" }} /></F>
              <F label="Color" k="color"><input value={form.color} onChange={set("color")} placeholder="White" style={{ width: "100%", padding: "11px 14px" }} /></F>
            </div>
            <F label="Plate Number" k="plateNumber"><input value={form.plateNumber} onChange={set("plateNumber")} placeholder="DL01AB1234" style={{ width: "100%", padding: "11px 14px" }} /></F>
            <F label="Cab Type" k="cabType">
              <select value={form.cabType} onChange={set("cabType")} style={{ width: "100%", padding: "11px 14px" }}>
                <option value="MINI">🚗 Mini</option>
                <option value="SEDAN">🚙 Sedan</option>
                <option value="SUV">🚐 SUV</option>
                <option value="PREMIUM">🏎️ Premium</option>
              </select>
            </F>

            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)", margin: "20px 0 12px" }}>📄 Documents</div>
            <F label="License Number" k="licenseNumber"><input value={form.licenseNumber} onChange={set("licenseNumber")} placeholder="DL-2020-0012345" style={{ width: "100%", padding: "11px 14px" }} /></F>

            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)", margin: "20px 0 12px" }}>⚙️ Preferences</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>Ride Mode</label>
                <select value={form.rideMode} onChange={set("rideMode")} style={{ width: "100%", padding: "11px 10px" }}>
                  <option value="PRIVATE_ONLY">Private Only</option>
                  <option value="SHARED_ONLY">Shared Only</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>Trip Type</label>
                <select value={form.tripType} onChange={set("tripType")} style={{ width: "100%", padding: "11px 10px" }}>
                  <option value="INTRACITY">Intracity</option>
                  <option value="INTERCITY">Intercity</option>
                  <option value="BOTH">Both</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>Passengers</label>
                <select value={form.genderPreference} onChange={set("genderPreference")} style={{ width: "100%", padding: "11px 10px" }}>
                  <option value="ANY">Any</option>
                  <option value="MALE_ONLY">Male Only</option>
                  <option value="FEMALE_ONLY">Female Only</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "13px", background: loading ? "rgba(245,197,24,0.4)" : "var(--accent)", border: "none", borderRadius: "var(--r)", color: "#000", fontSize: 15, fontWeight: 800 }}>
              {loading ? "Submitting..." : "Submit for Approval →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
