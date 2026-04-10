// src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

// ── Sidebar ──────────────────────────────────────────────────
const Sidebar = () => {
  const { logout } = useAuth();
  const nav = useNavigate();
  const links = [
    { to: "/admin", label: "📊 Dashboard", exact: true },
    { to: "/admin/drivers", label: "🚗 Drivers" },
    { to: "/admin/users", label: "👤 Users" },
    { to: "/admin/rides", label: "🛣️ Rides" },
    { to: "/admin/complaints", label: "⚠️ Complaints" },
  ];
  return (
    <aside style={{ width: 220, background: "var(--surface)", borderRight: "1px solid var(--border)", height: "100vh", display: "flex", flexDirection: "column", padding: "28px 0", position: "fixed", top: 0, left: 0, zIndex: 100 }}>
      <div style={{ padding: "0 24px 28px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontFamily: "var(--font-head)", fontSize: 24, color: "var(--accent)", letterSpacing: 1 }}>RIDEBOOK</div>
        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>Admin Panel</div>
      </div>
      <nav style={{ flex: 1, padding: "16px 0" }}>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.exact}
            style={({ isActive }) => ({ display: "block", padding: "10px 24px", fontSize: 14, color: isActive ? "var(--accent)" : "var(--text2)", background: isActive ? "var(--accent-dim)" : "transparent", borderLeft: `3px solid ${isActive ? "var(--accent)" : "transparent"}`, textDecoration: "none", fontWeight: isActive ? 600 : 400 })}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding: "0 16px" }}>
        <button onClick={() => { logout(); nav("/login"); }}
          style={{ width: "100%", padding: "10px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text2)", cursor: "pointer", fontSize: 13 }}>
          Sign Out
        </button>
      </div>
    </aside>
  );
};

// ── Main wrapper ──────────────────────────────────────────────
export default function AdminDashboard() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, padding: "36px 40px", background: "var(--bg)", minHeight: "100vh" }}>
        <Routes>
          <Route index element={<AdminHome />} />
          <Route path="drivers" element={<AdminDrivers />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="rides" element={<AdminRides />} />
          <Route path="complaints" element={<AdminComplaints />} />
        </Routes>
      </main>
    </div>
  );
}

// ── Dashboard Home ────────────────────────────────────────────
function AdminHome() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/admin/dashboard").then(({ data }) => setStats(data.stats)); }, []);
  const cards = stats ? [
    { label: "Total Riders", value: stats.totalUsers, color: "var(--blue)" },
    { label: "Total Drivers", value: stats.totalDrivers, color: "var(--accent)" },
    { label: "Total Rides", value: stats.totalRides, color: "var(--green)" },
    { label: "Pending Approvals", value: stats.pendingApprovals, color: "var(--accent2)" },
    { label: "Open Complaints", value: stats.openComplaints, color: "var(--red)" },
    { label: "Total Revenue", value: `₹${stats.totalRevenue?.toFixed(0)}`, color: "var(--green)" },
  ] : [];

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-head)", fontSize: 36, color: "var(--text)", letterSpacing: 1, marginBottom: 28 }}>ADMIN DASHBOARD</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "24px" }}>
            <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--font-head)", color: c.color }}>{c.value ?? "—"}</div>
            <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Drivers Management ────────────────────────────────────────
function AdminDrivers() {
  const [drivers, setDrivers] = useState([]);
  useEffect(() => { api.get("/admin/drivers").then(({ data }) => setDrivers(data.drivers || [])); }, []);

  const approve = async (id) => {
    await api.put(`/admin/drivers/${id}/approve`);
    setDrivers((ds) => ds.map((d) => d._id === id ? { ...d, isApproved: true } : d));
  };
  const block = async (id, isDriver = true) => {
    await api.put("/admin/block", { targetId: id, targetType: isDriver ? "driver" : "user" });
    setDrivers((ds) => ds.map((d) => d._id === id ? { ...d, isBlocked: true } : d));
  };
  const unblock = async (id) => {
    await api.put("/admin/unblock", { targetId: id, targetType: "driver" });
    setDrivers((ds) => ds.map((d) => d._id === id ? { ...d, isBlocked: false } : d));
  };

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-head)", fontSize: 28, marginBottom: 24 }}>ALL DRIVERS ({drivers.length})</h2>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
              {["Driver", "Vehicle", "Mode", "Status", "Rating", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", fontSize: 12, fontWeight: 600, color: "var(--text2)", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d._id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{d.userId?.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>{d.userId?.email}</div>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13 }}>
                  {d.vehicle?.make} {d.vehicle?.model}<br />
                  <span style={{ color: "var(--text3)", fontSize: 12 }}>{d.vehicle?.plateNumber} · {d.vehicle?.cabType}</span>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 12 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 20, background: "var(--surface2)", border: "1px solid var(--border)" }}>{d.rideMode}</span>
                  <br /><span style={{ color: "var(--text3)" }}>{d.tripType}</span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {d.isBlocked && <Badge color="var(--red)">Blocked</Badge>}
                    {!d.isApproved && !d.isBlocked && <Badge color="var(--accent)">Pending</Badge>}
                    {d.isApproved && !d.isBlocked && <Badge color="var(--green)">Approved</Badge>}
                    {d.isOnline && <Badge color="var(--green)">Online</Badge>}
                  </div>
                </td>
                <td style={{ padding: "12px 16px" }}>⭐ {d.rating}</td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {!d.isApproved && !d.isBlocked && (
                      <ActionBtn color="var(--green)" onClick={() => approve(d._id)}>Approve</ActionBtn>
                    )}
                    {!d.isBlocked ? (
                      <ActionBtn color="var(--red)" onClick={() => block(d._id)}>Block</ActionBtn>
                    ) : (
                      <ActionBtn color="var(--blue)" onClick={() => unblock(d._id)}>Unblock</ActionBtn>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Users Management ──────────────────────────────────────────
function AdminUsers() {
  const [users, setUsers] = useState([]);
  useEffect(() => { api.get("/admin/users").then(({ data }) => setUsers(data.users || [])); }, []);

  const block = async (id) => {
    await api.put("/admin/block", { targetId: id, targetType: "user" });
    setUsers((u) => u.map((x) => x._id === id ? { ...x, isBlocked: true } : x));
  };
  const unblock = async (id) => {
    await api.put("/admin/unblock", { targetId: id, targetType: "user" });
    setUsers((u) => u.map((x) => x._id === id ? { ...x, isBlocked: false } : x));
  };

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-head)", fontSize: 28, marginBottom: 24 }}>ALL RIDERS ({users.length})</h2>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
              {["Name", "Email", "Gender", "Rating", "Status", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", fontSize: 12, fontWeight: 600, color: "var(--text2)", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", fontWeight: 500 }}>{u.name}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text2)" }}>{u.email}</td>
                <td style={{ padding: "12px 16px", fontSize: 13 }}>{u.gender}</td>
                <td style={{ padding: "12px 16px" }}>⭐ {u.rating}</td>
                <td style={{ padding: "12px 16px" }}>
                  {u.isBlocked ? <Badge color="var(--red)">Blocked</Badge> : <Badge color="var(--green)">Active</Badge>}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {!u.isBlocked ? (
                    <ActionBtn color="var(--red)" onClick={() => block(u._id)}>Block</ActionBtn>
                  ) : (
                    <ActionBtn color="var(--blue)" onClick={() => unblock(u._id)}>Unblock</ActionBtn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Rides Monitor ─────────────────────────────────────────────
function AdminRides() {
  const [rides, setRides] = useState([]);
  const [filter, setFilter] = useState("ALL");
  useEffect(() => { api.get("/admin/rides").then(({ data }) => setRides(data.rides || [])); }, []);

  const filtered = filter === "ALL" ? rides : rides.filter((r) => r.status === filter);

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-head)", fontSize: 28, marginBottom: 16 }}>ALL RIDES</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {["ALL", "SEARCHING", "ONGOING", "COMPLETED", "CANCELLED"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${filter === s ? "var(--accent)" : "var(--border)"}`, background: filter === s ? "var(--accent-dim)" : "var(--surface)", color: filter === s ? "var(--accent)" : "var(--text2)", fontSize: 12, cursor: "pointer" }}>
            {s}
          </button>
        ))}
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
              {["Route", "Type", "Fare", "Driver", "Status", "Date"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", fontSize: 12, fontWeight: 600, color: "var(--text2)", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map((r) => (
              <tr key={r._id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", fontSize: 13 }}>
                  <div>{r.pickup?.address?.substring(0, 25)}...</div>
                  <div style={{ color: "var(--text3)" }}>→ {r.drop?.address?.substring(0, 25)}...</div>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 12 }}>{r.rideType}<br />{r.cabType}</td>
                <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--accent)" }}>₹{r.fareEstimate}</td>
                <td style={{ padding: "12px 16px", fontSize: 13 }}>{r.driverId?.userId?.name || "Unassigned"}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, background: "var(--surface2)", color: r.status === "COMPLETED" ? "var(--green)" : r.status === "CANCELLED" ? "var(--red)" : "var(--accent)", fontWeight: 600 }}>
                    {r.status}
                  </span>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text3)" }}>
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Complaints ────────────────────────────────────────────────
function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [note, setNote] = useState({});
  useEffect(() => { api.get("/admin/complaints").then(({ data }) => setComplaints(data.complaints || [])); }, []);

  const resolve = async (id, status) => {
    await api.put(`/admin/complaints/${id}`, { status, adminNote: note[id] || "" });
    setComplaints((cs) => cs.map((c) => c._id === id ? { ...c, status } : c));
  };

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-head)", fontSize: 28, marginBottom: 24 }}>COMPLAINTS ({complaints.filter((c) => c.status === "OPEN").length} open)</h2>
      {complaints.length === 0 && <p style={{ color: "var(--text3)" }}>No complaints filed.</p>}
      {complaints.map((c) => (
        <div key={c._id} style={{ background: "var(--surface)", border: `1px solid ${c.status === "OPEN" ? "var(--red)" : "var(--border)"}44`, borderRadius: "var(--r-lg)", padding: 20, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{c.subject}</div>
              <div style={{ fontSize: 13, color: "var(--text3)" }}>
                Filed by: {c.filedBy?.name} · Against: {c.againstUserId?.name} ({c.againstRole})
              </div>
            </div>
            <Badge color={c.status === "OPEN" ? "var(--red)" : c.status === "RESOLVED" ? "var(--green)" : "var(--text3)"}>{c.status}</Badge>
          </div>
          <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 12 }}>{c.description}</p>
          {c.status === "OPEN" && (
            <div style={{ display: "flex", gap: 8 }}>
              <input value={note[c._id] || ""} onChange={(e) => setNote((n) => ({ ...n, [c._id]: e.target.value }))}
                placeholder="Admin note..." style={{ flex: 1, padding: "8px 12px" }} />
              <ActionBtn color="var(--green)" onClick={() => resolve(c._id, "RESOLVED")}>Resolve</ActionBtn>
              <ActionBtn color="var(--text3)" onClick={() => resolve(c._id, "DISMISSED")}>Dismiss</ActionBtn>
            </div>
          )}
          {c.adminNote && <div style={{ marginTop: 8, fontSize: 13, color: "var(--blue)", padding: "6px 10px", background: "rgba(59,130,246,0.08)", borderRadius: 6 }}>Note: {c.adminNote}</div>}
        </div>
      ))}
    </div>
  );
}

const Badge = ({ children, color }) => (
  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: `${color}22`, color, fontWeight: 700, border: `1px solid ${color}44`, whiteSpace: "nowrap" }}>
    {children}
  </span>
);

const ActionBtn = ({ children, onClick, color }) => (
  <button onClick={onClick}
    style={{ padding: "6px 12px", background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 8, color, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
    {children}
  </button>
);
