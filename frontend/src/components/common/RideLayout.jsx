// src/components/common/RideLayout.jsx
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RideLayout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const riderLinks = [
    { to: "/ride", label: "🏠 Home" },
    { to: "/ride/my-rides", label: "🗂 My Rides" },
    { to: "/profile", label: "👤 Profile" },
  ];
  const driverLinks = [
    { to: "/driver", label: "🏠 Dashboard" },
    { to: "/driver/rides", label: "🗂 Ride History" },
    { to: "/driver/setup", label: "⚙️ Settings" },
    { to: "/profile", label: "👤 Profile" },
  ];

  const links = user?.role === "DRIVER" ? driverLinks : riderLinks;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Top nav */}
      <header style={{ height: 64, background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 24px", gap: 24, flexShrink: 0, zIndex: 50 }}>
        <div style={{ fontFamily: "var(--font-head)", fontSize: 24, color: "var(--accent)", letterSpacing: 2, marginRight: 8 }}>RIDEBOOK</div>
        <nav style={{ display: "flex", gap: 4, flex: 1 }}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/ride" || l.to === "/driver"}
              style={({ isActive }) => ({ padding: "7px 14px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? "var(--accent)" : "var(--text2)", background: isActive ? "var(--accent-dim)" : "transparent" })}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--text2)" }}>{user?.name?.split(" ")[0]}</span>
          <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, background: user?.role === "DRIVER" ? "rgba(34,197,94,0.15)" : "var(--accent-dim)", color: user?.role === "DRIVER" ? "var(--green)" : "var(--accent)", fontWeight: 700 }}>
            {user?.role}
          </span>
          <button onClick={() => { logout(); nav("/login"); }}
            style={{ padding: "7px 14px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text2)", fontSize: 12, cursor: "pointer" }}>
            Sign Out
          </button>
        </div>
      </header>
      <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
    </div>
  );
}
