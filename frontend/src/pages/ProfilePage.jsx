// src/pages/ProfilePage.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import RideLayout from "../components/common/RideLayout";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [nameVisibility, setNameVisibility] = useState(user?.nameVisibility || "FULL");
  const [isProfileBlurred, setIsProfileBlurred] = useState(user?.isProfileBlurred ?? true);
  const [phone, setPhone] = useState(user?.phone || "");
  const [contacts, setContacts] = useState(user?.trustedContacts || []);
  const [nc, setNc] = useState({ name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await api.put("/auth/profile", { nameVisibility, isProfileBlurred, phone, trustedContacts: contacts });
      await refreshUser();
      setMsg("✅ Saved!");
    } catch { setMsg("❌ Failed to save."); }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const addContact = () => {
    if (!nc.name) return;
    setContacts((c) => [...c, { ...nc }]);
    setNc({ name: "", phone: "", email: "" });
  };

  return (
    <RideLayout>
      <div style={{ padding: "32px 40px", maxWidth: 680 }}>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: 32, color: "var(--accent)", letterSpacing: 1, marginBottom: 28 }}>PROFILE & PRIVACY</h1>

        {/* User card */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 24, marginBottom: 20, display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent-dim)", border: "2px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, filter: isProfileBlurred ? "blur(4px)" : "none", transition: "filter 0.3s" }}>
            {user?.gender === "FEMALE" ? "👩" : "👨"}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{user?.name}</div>
            <div style={{ color: "var(--text3)", fontSize: 13 }}>{user?.email} · {user?.gender} · {user?.role}</div>
            <div style={{ color: "var(--accent)", fontSize: 12, marginTop: 4 }}>⭐ {user?.rating}</div>
          </div>
        </div>

        {/* Name visibility */}
        <Card title="🔒 Name Visibility">
          <div style={{ display: "flex", gap: 10 }}>
            {[["FULL", "Full Name"], ["FIRST_NAME", "First Only"], ["INITIALS", "Initials"]].map(([v, l]) => (
              <button key={v} onClick={() => setNameVisibility(v)}
                style={{ flex: 1, padding: "11px", borderRadius: 10, border: `1px solid ${nameVisibility === v ? "var(--accent)" : "var(--border)"}`, background: nameVisibility === v ? "var(--accent-dim)" : "var(--surface2)", color: nameVisibility === v ? "var(--accent)" : "var(--text2)", fontWeight: 600, fontSize: 13 }}>
                {l}
              </button>
            ))}
          </div>
        </Card>

        {/* Profile blur */}
        <Card title="🖼 Profile Picture">
          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "12px 16px", background: "var(--surface2)", borderRadius: 10, border: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Blur profile until ride confirmed</div>
              <div style={{ fontSize: 12, color: "var(--text3)" }}>Privacy until booking is accepted</div>
            </div>
            <div onClick={() => setIsProfileBlurred((b) => !b)}
              style={{ width: 46, height: 24, borderRadius: 12, background: isProfileBlurred ? "var(--accent)" : "var(--border)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 3, left: isProfileBlurred ? 24 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </div>
          </label>
        </Card>

        {/* Phone */}
        <Card title="📱 Phone Number">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210"
            style={{ width: "100%", padding: "11px 14px" }} />
        </Card>

        {/* Trusted contacts */}
        <Card title="🆘 Trusted Contacts (SOS)">
          {contacts.map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--surface2)", borderRadius: 8, marginBottom: 8, border: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "var(--text3)" }}>{c.phone} · {c.email}</div>
              </div>
              <button onClick={() => setContacts((cs) => cs.filter((_, j) => j !== i))}
                style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
            {["name", "phone", "email"].map((k) => (
              <input key={k} placeholder={k} value={nc[k]} onChange={(e) => setNc((n) => ({ ...n, [k]: e.target.value }))}
                style={{ padding: "9px 12px" }} />
            ))}
            <button onClick={addContact}
              style={{ padding: "9px 14px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--text)", cursor: "pointer" }}>
              +
            </button>
          </div>
        </Card>

        {msg && <div style={{ padding: "10px 14px", background: msg.startsWith("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.startsWith("✅") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 10, fontSize: 13, marginBottom: 16, color: msg.startsWith("✅") ? "var(--green)" : "var(--red)" }}>{msg}</div>}

        <button onClick={save} disabled={saving}
          style={{ width: "100%", padding: "13px", background: saving ? "rgba(245,197,24,0.4)" : "var(--accent)", border: "none", borderRadius: "var(--r)", color: "#000", fontSize: 15, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </RideLayout>
  );
}

const Card = ({ title, children }) => (
  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20, marginBottom: 16 }}>
    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text2)", marginBottom: 14 }}>{title}</div>
    {children}
  </div>
);
