// src/pages/RegisterPage.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const Field = ({ label, type = "text", value, onChange, placeholder, children }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>{label}</label>
    {children || (
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "11px 14px" }} />
    )}
  </div>
);

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", gender: "MALE", role: "RIDER" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const { saveAuth } = useAuth();
  const nav = useNavigate();

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (form.password.length < 6) return setErr("Password must be at least 6 characters.");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", form);
      saveAuth(data.token, data.user);
      nav("/");
    } catch (e) { setErr(e.response?.data?.message || "Registration failed."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "var(--font-head)", fontSize: 44, color: "var(--accent)", letterSpacing: 2 }}>RIDEBOOK</div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "36px 32px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Create Account</h2>
          <p style={{ color: "var(--text2)", fontSize: 13, marginBottom: 24 }}>Join thousands of daily commuters</p>

          {err && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{err}</div>}

          <form onSubmit={submit}>
            <Field label="Full Name" value={form.name} onChange={set("name")} placeholder="Priya Sharma" />
            <Field label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
            <Field label="Phone" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
            <Field label="Password" type="password" value={form.password} onChange={set("password")} placeholder="Min 6 characters" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>Gender</label>
                <select value={form.gender} onChange={(e) => set("gender")(e.target.value)}
                  style={{ width: "100%", padding: "11px 14px" }}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>I want to</label>
                <select value={form.role} onChange={(e) => set("role")(e.target.value)}
                  style={{ width: "100%", padding: "11px 14px" }}>
                  <option value="RIDER">Book Rides</option>
                  <option value="DRIVER">Drive & Earn</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "13px", background: loading ? "rgba(245,197,24,0.4)" : "var(--accent)", border: "none", borderRadius: "var(--r)", color: "#000", fontSize: 15, fontWeight: 700 }}>
              {loading ? "Creating account..." : "Create Account →"}
            </button>
          </form>

          {form.role === "DRIVER" && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 10, fontSize: 13, color: "var(--blue)" }}>
              ℹ️ After registration, go to <strong>Driver Setup</strong> to add your vehicle details.
            </div>
          )}

          <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, marginTop: 20 }}>
            Already have an account?{" "}<Link to="/login" style={{ color: "var(--accent)" }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
