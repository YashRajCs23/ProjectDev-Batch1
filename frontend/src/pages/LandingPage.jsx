// src/pages/LandingPage.jsx
import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const CAB_TYPES = [
  { icon: "🚗", label: "Mini", price: "₹10/km", desc: "Budget friendly" },
  { icon: "🚙", label: "Sedan", price: "₹14/km", desc: "Comfortable rides" },
  { icon: "🚐", label: "SUV", price: "₹18/km", desc: "Spacious & safe" },
  { icon: "🏎️", label: "Premium", price: "₹25/km", desc: "Luxury experience" },
];

const FEATURES = [
  { icon: "🗺️", title: "Live Map Tracking", desc: "Watch your driver approach in real-time on an interactive map" },
  { icon: "👥", title: "Share & Save", desc: "Split the fare with co-passengers going the same way. Up to 45% off" },
  { icon: "🔒", title: "Safe Rides", desc: "Gender preferences, profile privacy, and one-tap SOS emergency" },
  { icon: "💳", title: "Easy Payments", desc: "Pay online via Razorpay or use cash — your choice every time" },
  { icon: "⭐", title: "Verified Drivers", desc: "Admin-approved drivers with ratings, vehicle details & history" },
  { icon: "💬", title: "In-Ride Chat", desc: "Message your driver directly without sharing phone numbers" },
];

export default function LandingPage() {
  const heroRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const hero = heroRef.current;
      if (hero) {
        hero.style.backgroundPositionY = `${window.scrollY * 0.4}px`;
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh", fontFamily: "var(--font)" }}>
      {/* ── Navbar ── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(12,12,15,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)", padding: "0 40px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "var(--font-head)", fontSize: 26, color: "var(--accent)", letterSpacing: 2 }}>RIDEBOOK</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link to="/login" style={{ padding: "8px 20px", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text2)", fontSize: 14, fontWeight: 500 }}>Sign In</Link>
          <Link to="/register" style={{ padding: "8px 20px", background: "var(--accent)", border: "none", borderRadius: 8, color: "#000", fontSize: 14, fontWeight: 700 }}>Get Started</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section ref={heroRef} style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "100px 24px 60px", position: "relative", overflow: "hidden" }}>
        {/* Background glow */}
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,197,24,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundImage: "radial-gradient(circle at 20% 80%, rgba(245,197,24,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,107,53,0.04) 0%, transparent 50%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 760, position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-block", padding: "6px 16px", background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.25)", borderRadius: 20, fontSize: 13, color: "var(--accent)", fontWeight: 600, marginBottom: 28, letterSpacing: 0.5 }}>
            🚗 Uber-style rides across India
          </div>
          <h1 style={{ fontFamily: "var(--font-head)", fontSize: "clamp(52px, 8vw, 96px)", lineHeight: 0.95, letterSpacing: -1, marginBottom: 24, color: "var(--text)" }}>
            YOUR CITY,<br />
            <span style={{ color: "var(--accent)" }}>YOUR RIDE</span>
          </h1>
          <p style={{ fontSize: "clamp(15px, 2vw, 18px)", color: "var(--text2)", maxWidth: 520, margin: "0 auto 40px", lineHeight: 1.7 }}>
            Book private rides, share cabs with co-passengers, and track your driver live — all in one app with INR pricing.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/register" style={{ padding: "15px 36px", background: "var(--accent)", border: "none", borderRadius: 12, color: "#000", fontSize: 16, fontWeight: 800, letterSpacing: 0.5, display: "inline-block" }}>
              Book a Ride →
            </Link>
            <Link to="/register?role=DRIVER" style={{ padding: "15px 36px", background: "transparent", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)", fontSize: 16, fontWeight: 600, display: "inline-block" }}>
              Drive & Earn
            </Link>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 48, justifyContent: "center", marginTop: 64, flexWrap: "wrap" }}>
            {[["4 Cab Types", "Mini to Premium"], ["Share & Save", "Up to 45% off"], ["Live Tracking", "Real-time GPS"], ["INR Pricing", "No surprises"]].map(([v, l]) => (
              <div key={v} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-head)", fontSize: 22, color: "var(--accent)", letterSpacing: 1 }}>{v}</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cab types ── */}
      <section style={{ padding: "80px 40px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontFamily: "var(--font-head)", fontSize: 44, letterSpacing: 1, marginBottom: 8 }}>CHOOSE YOUR RIDE</h2>
          <p style={{ color: "var(--text2)" }}>From budget to luxury — pick what suits your journey</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {CAB_TYPES.map((c, i) => (
            <div key={c.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, textAlign: "center", transition: "border-color 0.2s, transform 0.2s", cursor: "default", animationDelay: `${i * 0.1}s` }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.transform = "translateY(-4px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "none"; }}
            >
              <div style={{ fontSize: 44, marginBottom: 14 }}>{c.icon}</div>
              <div style={{ fontFamily: "var(--font-head)", fontSize: 22, color: "var(--text)", letterSpacing: 0.5, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent)", marginBottom: 8 }}>{c.price}</div>
              <div style={{ fontSize: 13, color: "var(--text3)" }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "60px 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontFamily: "var(--font-head)", fontSize: 44, letterSpacing: 1, marginBottom: 8 }}>EVERYTHING YOU NEED</h2>
          <p style={{ color: "var(--text2)" }}>Built for safety, comfort, and affordability</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px 22px", transition: "border-color 0.2s" }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(245,197,24,0.4)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Shared ride explainer ── */}
      <section style={{ padding: "60px 40px 80px", background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", letterSpacing: 2, marginBottom: 12 }}>SHARE CAB FEATURE</div>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 40, lineHeight: 1, marginBottom: 16 }}>SHARE YOUR RIDE,<br />SPLIT THE COST</h2>
            <p style={{ color: "var(--text2)", lineHeight: 1.7, marginBottom: 24 }}>
              Match with co-passengers heading the same way. Our smart algorithm calculates route overlap so you know exactly what % of the journey you share.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[["90% match", "Best route overlap", "var(--green)"], ["75% match", "Good route overlap", "var(--accent)"], ["50% match", "Partial overlap", "var(--accent2)"]].map(([pct, desc, color]) => (
                <div key={pct} style={{ padding: "10px 14px", background: "var(--surface2)", borderRadius: 10, border: `1px solid ${color}44` }}>
                  <div style={{ fontWeight: 800, color, fontSize: 16 }}>{pct}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {["Set your pickup & drop", "See matching shared rides with % overlap", "Choose a ride — pay up to 45% less", "Chat with driver & co-passengers"].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent-dim)", border: "1px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "var(--accent)", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ paddingTop: 3, fontSize: 14, color: "var(--text2)" }}>{step}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "100px 40px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-head)", fontSize: 56, letterSpacing: 1, marginBottom: 16 }}>READY TO RIDE?</h2>
        <p style={{ color: "var(--text2)", marginBottom: 36, fontSize: 16 }}>Join now — it's free to sign up.</p>
        <Link to="/register" style={{ padding: "16px 48px", background: "var(--accent)", borderRadius: 12, color: "#000", fontSize: 18, fontWeight: 800, letterSpacing: 0.5, display: "inline-block" }}>
          Create Free Account →
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "var(--font-head)", fontSize: 20, color: "var(--accent)", letterSpacing: 2 }}>RIDEBOOK</div>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>© 2025 RideBook. Built for India 🇮🇳</div>
        <div style={{ display: "flex", gap: 20 }}>
          <Link to="/login" style={{ fontSize: 13, color: "var(--text2)" }}>Sign In</Link>
          <Link to="/register" style={{ fontSize: 13, color: "var(--text2)" }}>Register</Link>
        </div>
      </footer>
    </div>
  );
}
