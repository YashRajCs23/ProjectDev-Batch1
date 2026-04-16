// src/pages/RegisterPage.jsx — Added emergency contact field
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const inp = { width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text)" };
const sel = { ...inp, cursor: "pointer" };

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);

export default function RegisterPage() {
  const { saveAuth } = useAuth();
  const nav = useNavigate();

  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [password,  setPassword]  = useState("");
  const [gender,    setGender]    = useState("MALE");
  const [role,      setRole]      = useState("RIDER");
  // Emergency contact
  const [ecName,    setEcName]    = useState("");
  const [ecPhone,   setEcPhone]   = useState("");
  const [ecRel,     setEcRel]     = useState("Parent");

  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (password.length < 6) return setErr("Password must be at least 6 characters.");
    if (!phone.trim()) return setErr("Phone number is required for SOS alerts.");
    if (!ecPhone.trim()) return setErr("Emergency contact phone is required for safety.");

    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", {
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        gender,
        role,
        trustedContacts: ecName ? [{ name: ecName.trim(), phone: ecPhone.trim(), relationship: ecRel }] : [],
      });
      saveAuth(data.token, data.user);
      nav("/");
    } catch (e) {
      setErr(e.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 480 }}>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "var(--font-head)", fontSize: 44, color: "var(--accent)", letterSpacing: 2 }}>RIDEBOOK</div>
          <div style={{ color: "var(--text3)", fontSize: 13, marginTop: 4 }}>Your City, Your Ride</div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "32px 28px" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Create Account</h2>
          <p style={{ color: "var(--text2)", fontSize: 13, marginBottom: 22 }}>Join thousands of daily commuters</p>

          {err && (
            <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "var(--red)", fontSize: 13, marginBottom: 16 }}>
              ⚠️ {err}
            </div>
          )}

          <form onSubmit={submit}>
            {/* Basic Info */}
            <Field label="Full Name">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Priya Sharma" required style={inp} />
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={inp} />
            </Field>
            <Field label="Phone Number">
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" required style={inp} />
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required style={inp} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
              <Field label="Gender">
                <select value={gender} onChange={e => setGender(e.target.value)} style={sel}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="I want to">
                <select value={role} onChange={e => setRole(e.target.value)} style={sel}>
                  <option value="RIDER">Book Rides</option>
                  <option value="DRIVER">Drive & Earn</option>
                </select>
              </Field>
            </div>

            {/* Emergency Contact */}
            <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "14px 14px 6px", marginBottom: 16, marginTop: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--red)", marginBottom: 10 }}>
                🆘 Emergency Contact <span style={{ fontWeight: 400, color: "var(--text3)", fontSize: 11 }}>· Required for SOS safety feature</span>
              </div>
              <Field label="Contact Name">
                <input value={ecName} onChange={e => setEcName(e.target.value)} placeholder="e.g. Ravi Sharma" required style={inp} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Phone">
                  <input value={ecPhone} onChange={e => setEcPhone(e.target.value)} placeholder="+91 98765 43210" required style={inp} />
                </Field>
                <Field label="Relationship">
                  <select value={ecRel} onChange={e => setEcRel(e.target.value)} style={sel}>
                    <option>Parent</option>
                    <option>Spouse</option>
                    <option>Sibling</option>
                    <option>Friend</option>
                    <option>Guardian</option>
                    <option>Other</option>
                  </select>
                </Field>
              </div>
            </div>

            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "13px", background: loading ? "rgba(245,197,24,0.4)" : "var(--accent)", border: "none", borderRadius: "var(--r)", color: "#000", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Creating account..." : "Create Account →"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "var(--text3)" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
