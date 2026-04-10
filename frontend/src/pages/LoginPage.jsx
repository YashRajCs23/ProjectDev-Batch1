// src/pages/LoginPage.jsx — OTP as default, cleaner UI
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

export default function LoginPage() {
  const [mode, setMode] = useState("otp"); // otp is default
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const { saveAuth } = useAuth();
  const nav = useNavigate();

  const reset = () => { setErr(""); setMsg(""); setStep(1); setOtp(""); };

  const sendOTP = async (e) => {
    e.preventDefault(); setErr(""); setMsg("");
    if (!email) return setErr("Enter your email address.");
    setLoading(true);
    try {
      await api.post("/auth/request-otp", { email });
      setMsg("OTP sent! Check the backend console (for testing).");
      setStep(2);
    } catch (e) { setErr(e.response?.data?.message || "Failed to send OTP."); }
    finally { setLoading(false); }
  };

  const verifyOTP = async (e) => {
    e.preventDefault(); setErr("");
    if (otp.length !== 6) return setErr("Enter the 6-digit OTP.");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-otp", { email, otp });
      saveAuth(data.token, data.user);
      nav("/");
    } catch (e) { setErr(e.response?.data?.message || "Invalid OTP."); }
    finally { setLoading(false); }
  };

  const loginPassword = async (e) => {
    e.preventDefault(); setErr("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      saveAuth(data.token, data.user);
      nav("/");
    } catch (e) { setErr(e.response?.data?.message || "Login failed."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", position: "relative", overflow: "hidden" }}>
      {/* Background decoration */}
      <div style={{ position: "absolute", top: "-20%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,197,24,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", left: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,53,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Left — branding */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", padding: "60px 60px", display: window.innerWidth < 900 ? "none" : "flex" }}>
        <Link to="/home" style={{ fontFamily: "var(--font-head)", fontSize: 42, color: "var(--accent)", letterSpacing: 3, marginBottom: 24, display: "block" }}>RIDEBOOK</Link>
        <h2 style={{ fontFamily: "var(--font-head)", fontSize: 52, lineHeight: 1, color: "var(--text)", marginBottom: 20, letterSpacing: -1 }}>
          YOUR CITY,<br />YOUR RIDE
        </h2>
        <p style={{ color: "var(--text2)", fontSize: 16, lineHeight: 1.7, maxWidth: 400, marginBottom: 40 }}>
          Book private or shared rides, track your driver live, and pay your way — all at transparent INR prices.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {["🚗 Private rides from ₹30", "👥 Share cabs, save 45%", "📍 Live GPS tracking", "🔒 Safe & verified drivers"].map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--text2)" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right — form */}
      <div style={{ width: "100%", maxWidth: 460, background: "var(--surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 40px" }}>
        <Link to="/home" style={{ fontFamily: "var(--font-head)", fontSize: 28, color: "var(--accent)", letterSpacing: 2, marginBottom: 36, display: "block" }}>RIDEBOOK</Link>

        <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, alignSelf: "flex-start" }}>Welcome back</h3>
        <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 24, alignSelf: "flex-start" }}>Sign in to your account</p>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, width: "100%", background: "var(--bg2)", borderRadius: 10, padding: 4 }}>
          {[["otp", "📱 OTP Login"], ["password", "🔑 Password"]].map(([m, l]) => (
            <button key={m} onClick={() => { setMode(m); reset(); }}
              style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: mode === m ? "var(--surface2)" : "transparent", color: mode === m ? "var(--accent)" : "var(--text3)", fontWeight: mode === m ? 700 : 400, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}>
              {l}
            </button>
          ))}
        </div>

        {err && <div style={{ width: "100%", padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "var(--red)", fontSize: 13, marginBottom: 14 }}>{err}</div>}
        {msg && <div style={{ width: "100%", padding: "10px 14px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, color: "var(--green)", fontSize: 13, marginBottom: 14 }}>✅ {msg}</div>}

        <div style={{ width: "100%" }}>
          {mode === "otp" ? (
            step === 1 ? (
              <form onSubmit={sendOTP}>
                <F label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
                <Btn loading={loading}>Send OTP →</Btn>
                <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--bg2)", borderRadius: 8, fontSize: 12, color: "var(--text3)" }}>
                  💡 OTP will be logged in the backend console for testing
                </div>
              </form>
            ) : (
              <form onSubmit={verifyOTP}>
                <div style={{ padding: "10px 14px", background: "var(--bg2)", borderRadius: 8, fontSize: 13, color: "var(--text2)", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>📧 {email}</span>
                  <button type="button" onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12 }}>Change</button>
                </div>
                <F label="Enter 6-Digit OTP" type="text" value={otp} onChange={v => setOtp(v.replace(/\D/g, "").slice(0, 6))} placeholder="• • • • • •" style={{ letterSpacing: 10, textAlign: "center", fontSize: 22, fontWeight: 700 }} maxLength={6} />
                <Btn loading={loading}>Verify & Sign In →</Btn>
                <button type="button" onClick={sendOTP} disabled={loading}
                  style={{ width: "100%", marginTop: 10, padding: "10px", background: "none", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text2)", fontSize: 13, cursor: "pointer" }}>
                  Resend OTP
                </button>
              </form>
            )
          ) : (
            <form onSubmit={loginPassword}>
              <F label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
              <F label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
              <Btn loading={loading}>Sign In →</Btn>
            </form>
          )}
        </div>

        <p style={{ marginTop: 24, fontSize: 13, color: "var(--text3)", textAlign: "center" }}>
          Don't have an account?{" "}<Link to="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>Create one free →</Link>
        </p>
      </div>
    </div>
  );
}

const F = ({ label, type, value, onChange, placeholder, style, maxLength }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      maxLength={maxLength}
      style={{ width: "100%", padding: "12px 14px", borderRadius: 10, ...style }} />
  </div>
);

const Btn = ({ children, loading }) => (
  <button type="submit" disabled={loading}
    style={{ width: "100%", padding: "13px", background: loading ? "rgba(245,197,24,0.4)" : "var(--accent)", border: "none", borderRadius: 10, color: "#000", fontSize: 15, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", marginTop: 4 }}>
    {loading ? "Please wait..." : children}
  </button>
);
