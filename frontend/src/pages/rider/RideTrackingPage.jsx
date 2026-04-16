// src/pages/rider/RideTrackingPage.jsx — Fixed: auto-refresh, calling, cancel display, payments
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { searchIndiaPlaces } from "../../utils/search";
import api from "../../utils/api";
import RideLayout from "../../components/common/RideLayout";
import CallOverlay from "../../components/common/CallOverlay";

const KEY = "42275beb38a64d1486b88a378b90a008";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const mkPin = (bg, lbl) => new L.DivIcon({
  html: `<div style="width:28px;height:36px;position:relative"><div style="width:28px;height:28px;background:${bg};border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 10px rgba(0,0,0,0.35)"></div><div style="position:absolute;top:5px;left:0;width:28px;text-align:center;font-size:11px">${lbl}</div></div>`,
  className: "", iconSize: [28, 36], iconAnchor: [14, 36],
});
const carIcon = new L.DivIcon({
  html: `<div style="background:#f5c518;border:3px solid #000;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 3px 12px rgba(245,197,24,0.6)">🚗</div>`,
  className: "", iconSize: [38, 38], iconAnchor: [19, 19],
});
const G_PIN = mkPin("#16a34a", "🟢");
const R_PIN = mkPin("#dc2626", "🔴");

const STATUS_CFG = {
  SEARCHING: { label: "Finding your driver...",     color: "var(--accent)", icon: "🔍",  pulse: true  },
  ACCEPTED:  { label: "Driver accepted! On the way", color: "var(--blue)",   icon: "✅",  pulse: false },
  ARRIVING:  { label: "Driver is arriving",          color: "#f97316",       icon: "🚗",  pulse: true  },
  ONGOING:   { label: "Ride in progress",            color: "var(--green)",  icon: "🛣️",  pulse: false },
  COMPLETED: { label: "Ride completed! 🎉",          color: "var(--green)",  icon: "🏁",  pulse: false },
  CANCELLED: { label: "Ride was cancelled",          color: "var(--red)",    icon: "❌",  pulse: false },
};

function MapController({ flyRef }) {
  const map = useMap();
  useEffect(() => { flyRef.current = (lat, lng, z = 15) => map.flyTo([lat, lng], z, { duration: 0.8 }); }, [map]);
  return null;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, d2r = Math.PI / 180;
  const dLat = (lat2 - lat1) * d2r, dLng = (lng2 - lng1) * d2r;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function RideTrackingPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const nav = useNavigate();
  const flyRef = useRef(null);

  const [ride, setRide]             = useState(null);
  const [driverLoc, setDriverLoc]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [otpDisplay, setOtpDisplay] = useState(null);
  const [rating, setRating]         = useState(0);
  const [review, setReview]         = useState("");
  const [ratingDone, setRatingDone] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showDestChange, setShowDestChange] = useState(false);
  const [destQuery, setDestQuery]   = useState("");
  const [destResults, setDestResults] = useState([]);
  const [newDest, setNewDest]       = useState(null);
  const [destChanging, setDestChanging] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paying, setPaying]         = useState(false);
  const [fareUpdate, setFareUpdate] = useState(null);

  const pollRef  = useRef(null);
  const rideRef  = useRef(null);
  rideRef.current = ride;

  // ── Load ride ────────────────────────────────────────────
  const loadRide = useCallback(async () => {
    try {
      const { data } = await api.get(`/rides/${id}`);
      setRide(data.ride);
      if (data.ride?.driverId?.currentLocation?.lat) {
        setDriverLoc(data.ride.driverId.currentLocation);
      }
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadRide();
    // Poll every 4 seconds for status updates
    pollRef.current = setInterval(loadRide, 4000);
    return () => clearInterval(pollRef.current);
  }, [loadRide]);

  // ── Socket events ────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    socket.emit("joinRide", { rideId: id });

    const onDriverLoc = ({ lat, lng }) => {
      setDriverLoc({ lat, lng });
    };

    const onStatusUpdate = ({ status }) => {
      setRide(r => r ? { ...r, status } : r);
      if (["COMPLETED","ONGOING","ACCEPTED","ARRIVING"].includes(status)) loadRide();
    };

    const onAccepted = (data) => {
      setRide(r => r ? { ...r, status: "ACCEPTED" } : r);
      loadRide();
    };

    const onCancelled = () => {
      setRide(r => r ? { ...r, status: "CANCELLED" } : r);
    };

    const onOtp = ({ otp }) => setOtpDisplay(otp);

    const onDestChanged = (data) => {
      setFareUpdate(data);
      setRide(r => r ? {
        ...r,
        drop: { address: data.newDrop.address, coordinates: { lat: data.newDrop.lat, lng: data.newDrop.lng } },
        fareEstimate: data.newFare,
      } : r);
    };

    socket.on("driverLocationUpdate", onDriverLoc);
    socket.on("rideStatusUpdate",     onStatusUpdate);
    socket.on("rideAccepted",         onAccepted);
    socket.on("rideCancelled",        onCancelled);
    socket.on("startOtpGenerated",    onOtp);
    socket.on("destinationChanged",   onDestChanged);

    return () => {
      socket.off("driverLocationUpdate", onDriverLoc);
      socket.off("rideStatusUpdate",     onStatusUpdate);
      socket.off("rideAccepted",         onAccepted);
      socket.off("rideCancelled",        onCancelled);
      socket.off("startOtpGenerated",    onOtp);
      socket.off("destinationChanged",   onDestChanged);
    };
  }, [socket, id, loadRide]);

  // ── Destination search ───────────────────────────────────
  useEffect(() => {
    if (destQuery.length < 2) { setDestResults([]); return; }
    const t = setTimeout(async () => {
      const res = await searchIndiaPlaces(destQuery);
      setDestResults(res);
    }, 350);
    return () => clearTimeout(t);
  }, [destQuery]);

  // ── Actions ──────────────────────────────────────────────
  const cancelRide = async () => {
    try {
      await api.post(`/rides/${id}/cancel`, { reason: cancelReason });
      setRide(r => ({ ...r, status: "CANCELLED" }));
      setShowCancel(false);
    } catch (e) { alert(e.response?.data?.message || "Cancel failed."); }
  };

  const submitRating = async () => {
    if (!rating) return;
    try {
      await api.post("/ratings", { rideId: id, toDriverId: ride?.driverId?._id, ratedRole: "DRIVER", rating, review });
      setRatingDone(true);
    } catch {}
  };

  const handleCashPay = async () => {
    setPaying(true);
    try {
      await api.post("/payment/cash", { rideId: id });
      setRide(r => ({ ...r, isPaid: true }));
      setShowPayment(false);
      alert("✅ Cash payment confirmed!");
    } catch (e) { alert(e.response?.data?.message || "Payment failed."); }
    setPaying(false);
  };

  const handleOnlinePay = async () => {
    setPaying(true);
    try {
      const { data } = await api.post("/payment/order", { rideId: id });

      if (!data.success || data.razorpayNotConfigured) {
        alert("⚠️ Online payment not set up yet.\n\nUse Cash payment instead, or add Razorpay test keys to backend .env:\n  RAZORPAY_KEY_ID=rzp_test_xxx\n  RAZORPAY_KEY_SECRET=xxx\n\nGet free test keys at dashboard.razorpay.com");
        setPaying(false);
        return;
      }

      if (!window.Razorpay) {
        alert("Razorpay script not loaded. Please refresh and try again.");
        setPaying(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: "INR",
        name: "RideBook",
        description: `₹${ride?.fareEstimate} ride`,
        order_id: data.orderId,
        // Enable all payment methods including UPI, Cards, Net Banking, Wallets
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
        },
        handler: async (resp) => {
          await api.post("/payment/verify", { ...resp, rideId: id });
          setRide(r => ({ ...r, isPaid: true }));
          setShowPayment(false);
          alert("✅ Payment successful!");
        },
        prefill: { name: user?.name, email: user?.email || "", contact: user?.phone || "" },
        theme: { color: "#f5c518" },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch (e) {
      alert("Payment error: " + (e.response?.data?.message || e.message));
    }
    setPaying(false);
  };

  const applyDestChange = async () => {
    if (!newDest) return;
    setDestChanging(true);
    try {
      const { data } = await api.put(`/rides/${id}/change-destination`, {
        dropAddress: newDest.address, dropLat: newDest.lat, dropLng: newDest.lng,
      });
      setShowDestChange(false);
      setDestQuery(""); setDestResults([]); setNewDest(null);
      setFareUpdate({ newFare: data.newFare, oldFare: ride?.fareEstimate, newDrop: newDest });
      setRide(r => ({ ...r, drop: { address: newDest.address, coordinates: { lat: newDest.lat, lng: newDest.lng } }, fareEstimate: data.newFare }));
    } catch (e) { alert(e.response?.data?.message || "Could not change destination."); }
    setDestChanging(false);
  };

  if (loading) return (
    <RideLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", color: "var(--text3)", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 40 }}>🚗</div>
        <div>Loading ride...</div>
      </div>
    </RideLayout>
  );

  const status  = ride?.status || "SEARCHING";
  const cfg     = STATUS_CFG[status] || STATUS_CFG.SEARCHING;
  const poly    = ride?.routeCoordinates?.map(c => [c.lat, c.lng]) || [];
  const pickupC = ride?.pickup?.coordinates;
  const dropC   = ride?.drop?.coordinates;
  const driver  = ride?.driverId;
  const driverName = driver?.userId?.name || "Driver";
  const mapCenter = driverLoc ? [driverLoc.lat, driverLoc.lng] : pickupC ? [pickupC.lat, pickupC.lng] : [28.6139, 77.2090];

  const eta = (driverLoc && pickupC && ["ACCEPTED","ARRIVING"].includes(status))
    ? (() => { const d = haversine(driverLoc.lat, driverLoc.lng, pickupC.lat, pickupC.lng); return { dist: d.toFixed(1), mins: Math.max(1, Math.ceil(d / 0.5)) }; })()
    : null;

  const activeStatuses = ["SEARCHING","ACCEPTED","ARRIVING","ONGOING"];
  const canCancel = activeStatuses.includes(status);

  return (
    <RideLayout>
      <div style={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>

        {/* ── Left panel ── */}
        <div style={{ width: 320, background: "var(--surface)", borderRight: "1px solid var(--border)", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "16px 14px 28px" }}>

            {/* Status */}
            <div style={{ background: "var(--surface2)", borderRadius: "var(--r-lg)", padding: 18, marginBottom: 14, border: `1px solid ${cfg.color}44`, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>{cfg.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: cfg.color, marginBottom: cfg.pulse ? 10 : 0 }}>{cfg.label}</div>
              {cfg.pulse && (
                <div style={{ display: "flex", justifyContent: "center", gap: 5 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, animation: `bounce 1.4s ${i*0.2}s infinite` }} />)}
                </div>
              )}
            </div>

            {/* OTP display */}
            {otpDisplay && status === "ARRIVING" && (
              <div style={{ background: "rgba(245,197,24,0.1)", border: "2px solid var(--accent)", borderRadius: "var(--r)", padding: 14, marginBottom: 14, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 6 }}>🔐 Share this OTP with driver to start:</div>
                <div style={{ fontSize: 44, fontWeight: 800, color: "var(--accent)", letterSpacing: 10, fontFamily: "monospace" }}>{otpDisplay}</div>
              </div>
            )}

            {/* ETA */}
            {eta && (
              <div style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 12, marginBottom: 14, border: "1px solid var(--border)", display: "flex", justifyContent: "space-around" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)" }}>{eta.mins} min</div>
                  <div style={{ fontSize: 10, color: "var(--text3)" }}>ETA</div>
                </div>
                <div style={{ width: 1, background: "var(--border)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{eta.dist} km</div>
                  <div style={{ fontSize: 10, color: "var(--text3)" }}>Away</div>
                </div>
              </div>
            )}

            {/* Ride info */}
            <div style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 13, marginBottom: 14 }}>
              <Row label="Pickup"   value={ride?.pickup?.address} />
              <Row label="Drop"     value={ride?.drop?.address} />
              <Row label="Type"     value={`${ride?.rideType} · ${ride?.cabType}`} />
              <Row label="Distance" value={`${ride?.distanceKm} km`} />
              <Row label="ETA"      value={`${ride?.durationMin} min`} />
              <Row label="Fare"     value={`₹${ride?.fareEstimate}`} accent />
              {ride?.isPaid && <div style={{ textAlign: "center", color: "var(--green)", fontSize: 12, marginTop: 6, fontWeight: 700 }}>✅ Paid</div>}
            </div>

            {/* Fare update alert */}
            {fareUpdate && (
              <div style={{ background: "rgba(245,197,24,0.1)", border: "1px solid var(--accent)", borderRadius: "var(--r)", padding: 12, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>📍 Destination updated</div>
                <div style={{ color: "var(--text2)", fontSize: 12, marginBottom: 6 }}>{fareUpdate.newDrop?.address}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--text3)", textDecoration: "line-through" }}>₹{fareUpdate.oldFare}</span>
                  <span style={{ color: "var(--accent)", fontWeight: 800 }}>₹{fareUpdate.newFare}</span>
                </div>
                <button onClick={() => setFareUpdate(null)} style={{ marginTop: 6, fontSize: 11, color: "var(--text3)", background: "none", border: "none", cursor: "pointer" }}>✕ Dismiss</button>
              </div>
            )}

            {/* Driver card */}
            {driver && !["SEARCHING","CANCELLED"].includes(status) && (
              <div style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 14, marginBottom: 14, border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 700, fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Your Driver</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent-dim)", border: "2px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                    {driver?.userId?.gender === "FEMALE" ? "👩" : "👨"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{driverName}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>⭐ {driver?.rating || "—"} · {driver?.vehicle?.make} {driver?.vehicle?.model}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>🚗 {driver?.vehicle?.plateNumber}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => nav(`/chat/${id}`)}
                    style={{ flex: 1, padding: "9px", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: 10, color: "var(--accent)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    💬 Chat
                  </button>
                  {/* In-app voice call */}
                  <CallOverlay rideId={id} myName={user?.name} myRole="RIDER" />
                </div>
              </div>
            )}

            {/* Mid-ride actions */}
            {status === "ONGOING" && (
              <button onClick={() => setShowDestChange(true)}
                style={{ width: "100%", padding: "10px", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 10, color: "var(--blue)", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 10 }}>
                📍 Change Destination
              </button>
            )}

            {/* Pay Now */}
            {status === "COMPLETED" && !ride?.isPaid && (
              <button onClick={() => setShowPayment(true)}
                style={{ width: "100%", padding: "13px", background: "var(--accent)", border: "none", borderRadius: 12, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer", marginBottom: 12 }}>
                💳 Pay ₹{ride?.fareEstimate} Now
              </button>
            )}

            {/* Rating */}
            {status === "COMPLETED" && !ratingDone && (
              <div style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 14, marginBottom: 14, border: "1px solid rgba(34,197,94,0.2)" }}>
                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>⭐ Rate Your Driver</div>
                <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 10 }}>
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setRating(s)}
                      style={{ fontSize: 28, background: "none", border: "none", cursor: "pointer", opacity: s <= rating ? 1 : 0.25, transition: "opacity 0.1s" }}>⭐</button>
                  ))}
                </div>
                <textarea value={review} onChange={e => setReview(e.target.value)} placeholder="Write a review (optional)..." rows={2}
                  style={{ width: "100%", padding: "8px", borderRadius: 8, marginBottom: 10, resize: "none", fontSize: 13 }} />
                <button onClick={submitRating} disabled={!rating}
                  style={{ width: "100%", padding: "10px", background: rating ? "var(--green)" : "var(--border)", border: "none", borderRadius: 8, color: rating ? "#fff" : "var(--text3)", fontWeight: 700, cursor: rating ? "pointer" : "not-allowed" }}>
                  Submit Rating
                </button>
              </div>
            )}
            {ratingDone && <div style={{ textAlign: "center", color: "var(--green)", fontWeight: 700, padding: "8px 0", marginBottom: 10 }}>✅ Thanks for rating!</div>}

            {/* Cancel */}
            {canCancel && (
              <button onClick={() => setShowCancel(true)}
                style={{ width: "100%", padding: "10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, color: "var(--red)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                Cancel Ride
              </button>
            )}
          </div>
        </div>

        {/* ── Map ── */}
        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer center={mapCenter} zoom={14} style={{ height: "100%", width: "100%" }}>
            <TileLayer url={`https://maps.geoapify.com/v1/tile/osm-bright-smooth/{z}/{x}/{y}.png?apiKey=${KEY}`} attribution='© Geoapify' />
            <MapController flyRef={flyRef} />
            {pickupC && <Marker position={[pickupC.lat, pickupC.lng]} icon={G_PIN}><Popup>🟢 Pickup</Popup></Marker>}
            {dropC   && <Marker position={[dropC.lat, dropC.lng]}     icon={R_PIN}><Popup>🔴 Drop</Popup></Marker>}
            {driverLoc && <Marker position={[driverLoc.lat, driverLoc.lng]} icon={carIcon}><Popup>🚗 {driverName}</Popup></Marker>}
            {poly.length > 1 && <Polyline positions={poly} color="#f5c518" weight={5} opacity={0.85} />}
          </MapContainer>

          {eta && (
            <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(12,12,15,0.92)", backdropFilter: "blur(14px)", borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(245,197,24,0.2)", zIndex: 1000, textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5 }}>Driver ETA</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>{eta.mins} min</div>
              <div style={{ fontSize: 11, color: "var(--text2)" }}>{eta.dist} km</div>
            </div>
          )}
        </div>

        {/* ── Modals ── */}
        {showCancel && (
          <Modal onClose={() => setShowCancel(false)}>
            <h3 style={{ marginBottom: 12 }}>Cancel Ride?</h3>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="Reason (optional)..." rows={3}
              style={{ width: "100%", padding: "10px", borderRadius: 8, marginBottom: 14, resize: "none" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowCancel(false)} style={{ flex: 1, padding: "11px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text2)", cursor: "pointer" }}>Keep Ride</button>
              <button onClick={cancelRide} style={{ flex: 1, padding: "11px", background: "var(--red)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 800, cursor: "pointer" }}>Yes, Cancel</button>
            </div>
          </Modal>
        )}

        {showDestChange && (
          <Modal onClose={() => setShowDestChange(false)}>
            <h3 style={{ marginBottom: 4 }}>Change Destination</h3>
            <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 14 }}>Fare will be recalculated.</p>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <input value={destQuery} onChange={e => { setDestQuery(e.target.value); setNewDest(null); }}
                placeholder="Search new destination..." autoFocus
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14 }} />
              {destResults.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 10, maxHeight: 180, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                  {destResults.map((r, i) => (
                    <div key={i} onMouseDown={() => { setNewDest(r); setDestQuery(r.address); setDestResults([]); }}
                      style={{ padding: "9px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                      onMouseLeave={e => e.currentTarget.style.background = ""}>
                      📍 {r.address.split(",")[0]}<br/>
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>{r.address.split(",").slice(1,3).join(",")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {newDest && <div style={{ padding: "9px 12px", background: "var(--accent-dim)", borderRadius: 8, fontSize: 13, color: "var(--accent)", marginBottom: 12 }}>✓ {newDest.address}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowDestChange(false)} style={{ flex: 1, padding: "11px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text2)", cursor: "pointer" }}>Cancel</button>
              <button onClick={applyDestChange} disabled={!newDest || destChanging}
                style={{ flex: 1, padding: "11px", background: newDest ? "var(--accent)" : "var(--border)", border: "none", borderRadius: 8, color: newDest ? "#000" : "var(--text3)", fontWeight: 700, cursor: newDest ? "pointer" : "not-allowed" }}>
                {destChanging ? "Updating..." : "Confirm"}
              </button>
            </div>
          </Modal>
        )}

        {showPayment && (
          <Modal onClose={() => !paying && setShowPayment(false)}>
            <h3 style={{ marginBottom: 4 }}>Pay for Your Ride</h3>
            <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 20 }}>
              Amount: <strong style={{ color: "var(--accent)", fontSize: 22 }}>₹{ride?.fareEstimate}</strong>
            </p>

            <button onClick={handleCashPay} disabled={paying}
              style={{ width: "100%", padding: "13px", background: "var(--surface2)", border: "1px solid var(--green)", borderRadius: 10, color: "var(--green)", fontWeight: 700, fontSize: 15, cursor: paying ? "not-allowed" : "pointer", marginBottom: 10 }}>
              💵 Pay Cash — ₹{ride?.fareEstimate}
              <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2 }}>Pay directly to driver</div>
            </button>

            <button onClick={handleOnlinePay} disabled={paying}
              style={{ width: "100%", padding: "13px", background: paying ? "rgba(245,197,24,0.4)" : "var(--accent)", border: "none", borderRadius: 10, color: "#000", fontWeight: 700, fontSize: 15, cursor: paying ? "not-allowed" : "pointer", marginBottom: 10 }}>
              {paying ? "⏳ Processing..." : `💳 Pay Online — ₹${ride?.fareEstimate}`}
              <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2 }}>Requires Razorpay setup</div>
            </button>
          </Modal>
        )}
      </div>

      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>
    </RideLayout>
  );
}

const Row = ({ label, value, accent }) => (
  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, gap: 8 }}>
    <span style={{ color: "var(--text3)", fontSize: 12, flexShrink: 0 }}>{label}</span>
    <span style={{ fontWeight: accent ? 800 : 500, fontSize: accent ? 16 : 13, color: accent ? "var(--accent)" : "var(--text)", textAlign: "right", wordBreak: "break-word" }}>{value}</span>
  </div>
);

const Modal = ({ children, onClose }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={e => e.target === e.currentTarget && onClose()}>
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 26, maxWidth: 380, width: "90%", maxHeight: "85vh", overflowY: "auto" }}>
      {children}
    </div>
  </div>
);
