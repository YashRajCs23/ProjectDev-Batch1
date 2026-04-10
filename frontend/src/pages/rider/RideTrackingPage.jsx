// src/pages/rider/RideTrackingPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";
import RideLayout from "../../components/common/RideLayout";

const GEOAPIFY_KEY = "42275beb38a64d1486b88a378b90a008";

const STATUS_CONFIG = {
  SEARCHING:  { label: "Finding your driver...", color: "var(--accent)", icon: "🔍", pulse: true },
  ACCEPTED:   { label: "Driver accepted! On the way", color: "var(--blue)", icon: "✅", pulse: false },
  ARRIVING:   { label: "Driver is arriving", color: "var(--accent2)", icon: "🚗", pulse: true },
  ONGOING:    { label: "Ride in progress", color: "var(--green)", icon: "🛣️", pulse: false },
  COMPLETED:  { label: "Ride completed!", color: "var(--green)", icon: "🏁", pulse: false },
  CANCELLED:  { label: "Ride cancelled", color: "var(--red)", icon: "❌", pulse: false },
};

const driverIcon = new L.DivIcon({
  html: `<div style="background:#f5c518;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid #000;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🚗</div>`,
  className: "", iconSize: [36, 36], iconAnchor: [18, 18],
});

function FlyTo({ coords }) {
  const map = useMap();
  useEffect(() => { if (coords) map.flyTo(coords, 15, { duration: 1 }); }, [coords]);
  return null;
}

export default function RideTrackingPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const nav = useNavigate();

  const [ride, setRide] = useState(null);
  const [driverLoc, setDriverLoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const timerRef = useRef(null);

  useEffect(() => {
    loadRide();
    if (socket) {
      socket.emit("joinRide", { rideId: id });
      socket.on("driverLocationUpdate", ({ lat, lng }) => {
        setDriverLoc({ lat, lng });
      });
      socket.on("rideStatusUpdate", ({ status }) => {
        setRide((r) => r ? { ...r, status } : r);
        if (status === "COMPLETED") loadRide();
      });
      socket.on("rideAccepted", (data) => {
        setRide((r) => r ? { ...r, status: "ACCEPTED", driverInfo: data.driver } : r);
      });
      socket.on("rideCancelled", () => {
        setRide((r) => r ? { ...r, status: "CANCELLED" } : r);
      });
    }
    // Poll ride status every 10s
    timerRef.current = setInterval(loadRide, 10000);
    return () => {
      clearInterval(timerRef.current);
      socket?.off("driverLocationUpdate");
      socket?.off("rideStatusUpdate");
      socket?.off("rideAccepted");
      socket?.off("rideCancelled");
      socket?.emit("leaveRide", { rideId: id });
    };
  }, [id, socket]);

  const loadRide = async () => {
    try {
      const { data } = await api.get(`/rides/${id}`);
      setRide(data.ride);
      if (data.ride?.driverId?.currentLocation) {
        setDriverLoc(data.ride.driverId.currentLocation);
      }
    } catch {}
    setLoading(false);
  };

  const cancelRide = async () => {
    try {
      await api.post(`/rides/${id}/cancel`, { reason: cancelReason });
      setRide((r) => ({ ...r, status: "CANCELLED" }));
      setShowCancel(false);
    } catch (e) { alert(e.response?.data?.message); }
  };

  const submitRating = async () => {
    if (!rating) return;
    try {
      await api.post("/ratings", {
        rideId: id,
        toDriverId: ride?.driverId?._id,
        ratedRole: "DRIVER",
        rating, review,
      });
      setRatingSubmitted(true);
    } catch {}
  };

  const handlePayment = async () => {
    if (ride?.paymentMethod === "CASH") {
      await api.post("/payment/cash", { rideId: id });
      alert("✅ Cash payment recorded!");
      return;
    }
    // Razorpay
    const { data: orderData } = await api.post("/payment/order", { rideId: id });
    const options = {
      key: orderData.keyId,
      amount: orderData.amount,
      currency: "INR",
      name: "RideBook",
      description: "Ride Payment",
      order_id: orderData.orderId,
      handler: async (response) => {
        await api.post("/payment/verify", { ...response, rideId: id });
        alert("✅ Payment successful!");
      },
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  if (loading) return (
    <RideLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", color: "var(--text3)" }}>
        Loading ride details...
      </div>
    </RideLayout>
  );

  const status = ride?.status || "SEARCHING";
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.SEARCHING;
  const polyline = ride?.routeCoordinates?.map((c) => [c.lat, c.lng]) || [];
  const pickupCoords = ride?.pickup?.coordinates;
  const dropCoords = ride?.drop?.coordinates;
  const mapCenter = driverLoc
    ? [driverLoc.lat, driverLoc.lng]
    : pickupCoords ? [pickupCoords.lat, pickupCoords.lng] : [28.6139, 77.2090];

  return (
    <RideLayout>
      <div style={{ display: "flex", height: "calc(100vh - 64px)" }}>
        {/* ── Status Panel ── */}
        <div style={{ width: 360, background: "var(--surface)", borderRight: "1px solid var(--border)", overflowY: "auto", padding: 24, flexShrink: 0 }}>

          {/* Status badge */}
          <div style={{ background: "var(--surface2)", borderRadius: "var(--r-lg)", padding: "20px", marginBottom: 20, border: `1px solid ${cfg.color}33` }}>
            <div style={{ fontSize: 40, textAlign: "center", marginBottom: 10 }}>{cfg.icon}</div>
            <div style={{ textAlign: "center", fontWeight: 700, fontSize: 16, color: cfg.color }}>{cfg.label}</div>
            {cfg.pulse && (
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, animation: `bounce 1.4s ${i * 0.2}s infinite` }} />
                ))}
              </div>
            )}
          </div>

          {/* Ride info */}
          <div style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 16, marginBottom: 16 }}>
            <InfoRow label="Pickup" value={ride?.pickup?.address} />
            <InfoRow label="Drop" value={ride?.drop?.address} />
            <InfoRow label="Type" value={`${ride?.rideType} · ${ride?.cabType}`} />
            <InfoRow label="Distance" value={`${ride?.distanceKm} km`} />
            <InfoRow label="ETA" value={`${ride?.durationMin} min`} />
            <InfoRow label="Fare" value={`₹${ride?.fareEstimate}`} accent />
          </div>

          {/* Driver info (shown after acceptance) */}
          {ride?.driverId && status !== "SEARCHING" && (
            <div style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 16, marginBottom: 16, border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Your Driver</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                  {ride.driverId.userId?.gender === "FEMALE" ? "👩" : "👨"}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{ride.driverId.userId?.name || "Driver"}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>
                    ⭐ {ride.driverId.rating} · {ride.driverId.vehicle?.make} {ride.driverId.vehicle?.model}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>
                    🚗 {ride.driverId.vehicle?.plateNumber}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => nav(`/chat/${id}`)}
                  style={{ flex: 1, padding: "9px", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: 8, color: "var(--accent)", fontWeight: 600, fontSize: 13 }}>
                  💬 Chat
                </button>
              </div>
            </div>
          )}

          {/* Shared ride co-passengers */}
          {ride?.rideType === "SHARED" && ride?.riders?.length > 1 && (
            <div style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Co-passengers ({ride.riders.length - 1})</div>
              {ride.riders.filter((r) => String(r.riderId) !== String(user?.id)).map((r, i) => (
                <div key={i} style={{ fontSize: 13, color: "var(--text2)", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  👤 Passenger {i + 1} · {r.routeMatchPct}% route match
                </div>
              ))}
            </div>
          )}

          {/* Rating (after completion) */}
          {status === "COMPLETED" && !ratingSubmitted && (
            <div style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 16, marginBottom: 16, border: "1px solid var(--green)33" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Rate Your Driver</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, justifyContent: "center" }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setRating(s)}
                    style={{ fontSize: 28, background: "none", border: "none", cursor: "pointer", opacity: s <= rating ? 1 : 0.3 }}>
                    ⭐
                  </button>
                ))}
              </div>
              <textarea value={review} onChange={(e) => setReview(e.target.value)}
                placeholder="Write a review (optional)..."
                rows={2}
                style={{ width: "100%", padding: "10px", marginBottom: 10, borderRadius: 8, resize: "none" }} />
              <button onClick={submitRating}
                style={{ width: "100%", padding: "10px", background: "var(--green)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700 }}>
                Submit Rating
              </button>
            </div>
          )}

          {ratingSubmitted && (
            <div style={{ textAlign: "center", padding: "12px", color: "var(--green)", fontSize: 14, fontWeight: 600 }}>
              ✅ Thanks for your rating!
            </div>
          )}

          {/* Payment button */}
          {status === "COMPLETED" && !ride?.isPaid && (
            <button onClick={handlePayment}
              style={{ width: "100%", padding: "13px", background: "var(--accent)", border: "none", borderRadius: "var(--r)", color: "#000", fontWeight: 800, fontSize: 15, marginBottom: 12 }}>
              💳 Pay ₹{ride?.fareEstimate}
            </button>
          )}

          {/* Cancel button */}
          {["SEARCHING", "ACCEPTED", "ARRIVING"].includes(status) && (
            <button onClick={() => setShowCancel(true)}
              style={{ width: "100%", padding: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--r)", color: "var(--red)", fontWeight: 600, fontSize: 13 }}>
              Cancel Ride
            </button>
          )}

          {/* Cancel dialog */}
          {showCancel && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 28, maxWidth: 340, width: "90%" }}>
                <h3 style={{ marginBottom: 16 }}>Cancel Ride?</h3>
                <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason (optional)..." rows={3}
                  style={{ width: "100%", padding: "10px", borderRadius: 8, marginBottom: 16, resize: "none" }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowCancel(false)}
                    style={{ flex: 1, padding: "10px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text2)" }}>
                    Keep Ride
                  </button>
                  <button onClick={cancelRide}
                    style={{ flex: 1, padding: "10px", background: "var(--red)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700 }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Map ── */}
        <div style={{ flex: 1 }}>
          <MapContainer center={mapCenter} zoom={14} style={{ height: "100%", width: "100%" }}>
            <TileLayer url={`https://maps.geoapify.com/v1/tile/carto/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`} attribution="© Geoapify" />
            <FlyTo coords={mapCenter} />
            {pickupCoords && (
              <Marker position={[pickupCoords.lat, pickupCoords.lng]}>
                <Popup>🟢 Pickup</Popup>
              </Marker>
            )}
            {dropCoords && (
              <Marker position={[dropCoords.lat, dropCoords.lng]}>
                <Popup>🔴 Drop</Popup>
              </Marker>
            )}
            {driverLoc && (
              <Marker position={[driverLoc.lat, driverLoc.lng]} icon={driverIcon}>
                <Popup>🚗 Your Driver</Popup>
              </Marker>
            )}
            {polyline.length > 1 && <Polyline positions={polyline} color="#f5c518" weight={4} opacity={0.8} />}
          </MapContainer>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </RideLayout>
  );
}

const InfoRow = ({ label, value, accent }) => (
  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
    <span style={{ color: "var(--text2)", fontSize: 13 }}>{label}</span>
    <span style={{ fontWeight: accent ? 800 : 500, fontSize: accent ? 16 : 13, color: accent ? "var(--accent)" : "var(--text)" }}>{value}</span>
  </div>
);
