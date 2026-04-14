// src/pages/driver/DriverSetupPage.jsx
// FIX: FormField component moved OUTSIDE the main component
// (defining it inside caused re-mount on every keystroke → only 1 char typed)
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";

// ── Stable field wrapper — defined outside so it never re-mounts ──
const Field = ({ label, children }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>
      {label}
    </label>
    {children}
  </div>
);

const inputStyle = { width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text)" };
const selectStyle = { ...inputStyle, cursor: "pointer" };

export default function DriverSetupPage() {
  const { loadDriver } = useAuth();
  const nav = useNavigate();

  const [make,            setMake]           = useState("");
  const [model,           setModel]          = useState("");
  const [year,            setYear]           = useState(new Date().getFullYear());
  const [color,           setColor]          = useState("");
  const [plateNumber,     setPlateNumber]    = useState("");
  const [cabType,         setCabType]        = useState("SEDAN");
  const [licenseNumber,   setLicenseNumber]  = useState("");
  const [rideMode,        setRideMode]       = useState("HYBRID");
  const [tripType,        setTripType]       = useState("INTRACITY");
  const [genderPref,      setGenderPref]     = useState("ANY");
  const [loading,         setLoading]        = useState(false);
  const [err,             setErr]            = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    // Basic validation
    if (!make.trim()) return setErr("Vehicle make is required.");
    if (!model.trim()) return setErr("Vehicle model is required.");
    if (!plateNumber.trim()) return setErr("Plate number is required.");
    if (!licenseNumber.trim()) return setErr("License number is required.");

    setLoading(true);
    try {
      await api.post("/drivers/register", {
        vehicle: { make: make.trim(), model: model.trim(), year: parseInt(year), color: color.trim(), plateNumber: plateNumber.trim().toUpperCase(), cabType },
        licenseNumber: licenseNumber.trim(),
        rideMode,
        tripType,
        genderPreference: genderPref,
      });
      await loadDriver();
      nav("/driver");
    } catch (e) {
      setErr(e.response?.data?.message || "Setup failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ fontFamily: "var(--font-head)", fontSize: 36, color: "var(--accent)", textAlign: "center", marginBottom: 28, letterSpacing: 2 }}>
          DRIVER SETUP
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "36px 32px" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Setup Your Driver Profile</h2>
          <p style={{ color: "var(--text2)", fontSize: 13, marginBottom: 24 }}>
            You'll need admin approval before you can start driving.
          </p>

          {err && (
            <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "var(--red)", fontSize: 13, marginBottom: 16 }}>
              ⚠️ {err}
            </div>
          )}

          <form onSubmit={submit}>
            {/* Vehicle */}
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)", marginBottom: 12 }}>🚗 Vehicle Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Make (Brand)">
                <input value={make} onChange={e => setMake(e.target.value)} placeholder="e.g. Maruti" style={inputStyle} />
              </Field>
              <Field label="Model">
                <input value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. Swift Dzire" style={inputStyle} />
              </Field>
              <Field label="Year">
                <input type="number" value={year} onChange={e => setYear(e.target.value)} min="2000" max="2026" style={inputStyle} />
              </Field>
              <Field label="Color">
                <input value={color} onChange={e => setColor(e.target.value)} placeholder="e.g. White" style={inputStyle} />
              </Field>
            </div>

            <Field label="Plate Number">
              <input value={plateNumber} onChange={e => setPlateNumber(e.target.value)} placeholder="e.g. UP80AB1234" style={inputStyle} />
            </Field>

            <Field label="Cab Type">
              <select value={cabType} onChange={e => setCabType(e.target.value)} style={selectStyle}>
                <option value="MINI">🚗 Mini (Hatchback)</option>
                <option value="SEDAN">🚙 Sedan</option>
                <option value="SUV">🚐 SUV</option>
                <option value="PREMIUM">🏎️ Premium</option>
              </select>
            </Field>

            {/* Documents */}
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)", margin: "20px 0 12px" }}>📄 Documents</div>
            <Field label="Driving License Number">
              <input value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} placeholder="e.g. UP80-2020-0012345" style={inputStyle} />
            </Field>

            {/* Preferences */}
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)", margin: "20px 0 12px" }}>⚙️ Preferences</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
              <Field label="Ride Mode">
                <select value={rideMode} onChange={e => setRideMode(e.target.value)} style={selectStyle}>
                  <option value="PRIVATE_ONLY">Private Only</option>
                  <option value="SHARED_ONLY">Shared Only</option>
                  <option value="HYBRID">Both (Hybrid)</option>
                </select>
              </Field>
              <Field label="Trip Type">
                <select value={tripType} onChange={e => setTripType(e.target.value)} style={selectStyle}>
                  <option value="INTRACITY">Intracity</option>
                  <option value="INTERCITY">Intercity</option>
                  <option value="BOTH">Both</option>
                </select>
              </Field>
              <Field label="Passengers">
                <select value={genderPref} onChange={e => setGenderPref(e.target.value)} style={selectStyle}>
                  <option value="ANY">Any</option>
                  <option value="MALE_ONLY">Male Only</option>
                  <option value="FEMALE_ONLY">Female Only</option>
                </select>
              </Field>
            </div>

            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "14px", background: loading ? "rgba(245,197,24,0.4)" : "var(--accent)", border: "none", borderRadius: "var(--r)", color: "#000", fontSize: 15, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Submitting..." : "Submit for Approval →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
