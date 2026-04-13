// src/pages/rider/RideTrackingPage.jsx — Full featured tracking page
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { searchIndiaPlaces } from "../../utils/search";
import api from "../../utils/api";
import RideLayout from "../../components/common/RideLayout";

const KEY = "42275beb38a64d1486b88a378b90a008";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const mkPin = (bg, lbl) => new L.DivIcon({
  html: `<div style="width:28px;height:36px;position:relative"><div style="width:28px;height:28px;background:${bg};border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 10px rgba(0,0,0,0.35)"></div><div style="position:absolute;top:5px;left:0;width:28px;text-align:center;font-size:11px">${lbl}</div></div>`,
  className: "", iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -36],
});
const carIcon = new L.DivIcon({
  html: `<div style="background:#f5c518;border:3px solid #000;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 3px 12px rgba(245,197,24,0.6)">🚗</div>`,
  className: "", iconSize: [38, 38], iconAnchor: [19, 19],
});
const G_PIN = mkPin("#16a34a", "🟢");
const R_PIN = mkPin("#dc2626", "🔴");

const STATUS = {
  SEARCHING: { label: "Finding your driver...", color: "var(--accent)", icon: "🔍", pulse: true },
  ACCEPTED:  { label: "Driver accepted! On the way", color: "var(--blue)", icon: "✅", pulse: false },
  ARRIVING:  { label: "Driver is arriving nearby", color: "var(--accent2)", icon: "🚗", pulse: true },
  ONGOING:   { label: "Ride in progress", color: "var(--green)", icon: "🛣️", pulse: false },
  COMPLETED: { label: "Ride completed! 🎉", color: "var(--green)", icon: "🏁", pulse: false },
  CANCELLED: { label: "Ride cancelled", color: "var(--red)", icon: "❌", pulse: false },
};

function MapController({ flyRef }) {
  const map = useMap();
  useEffect(() => { flyRef.current = (lat, lng, z = 15) => map.flyTo([lat, lng], z, { duration: 0.8 }); }, [map]);
  return null;
}

// Haversine distance in km
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function RideTrackingPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const nav = useNavigate();
  const flyRef = useRef(null);

  const [ride, setRide]           = useState(null);
  const [driverLoc, setDriverLoc] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [otpDisplay, setOtpDisplay] = useState(null); // OTP shown to rider
  const [rating, setRating]       = useState(0);
  const [review, setReview]       = useState("");
  const [ratingDone, setRatingDone] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showDestChange, setShowDestChange] = useState(false);
  const [newDestQuery, setNewDestQuery] = useState("");
  const [destResults, setDestResults]   = useState([]);
  const [newDest, setNewDest]           = useState(null);
  const [destChanging, setDestChanging] = useState(false);
  const [showPayment, setShowPayment]   = useState(false);
  const [paying, setPaying]             = useState(false);
  const [fareUpdate, setFareUpdate]     = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadRide();
    pollRef.current = setInterval(loadRide, 8000);

    if (socket) {
      socket.emit("joinRide", { rideId: id });

      socket.on("driverLocationUpdate", ({ lat, lng }) => {
        setDriverLoc({ lat, lng });
        flyRef.current?.(lat, lng, 15);
      });
      socket.on("rideStatusUpdate", ({ status }) => {
        setRide(r => r ? { ...r, status } : r);
        if (status === "COMPLETED" || status === "ONGOING") loadRide();
      });
      socket.on("rideAccepted", (data) => {
        setRide(r => r ? { ...r, status: "ACCEPTED", driverInfo: data.driver } : r);
      });
      socket.on("rideCancelled", () => {
        setRide(r => r ? { ...r, status: "CANCELLED" } : r);
      });
      socket.on("startOtpGenerated", ({ otp }) => {
        setOtpDisplay(otp); // Show OTP to rider when driver arrives
      });
      socket.on("destinationChanged", (data) => {
        setFareUpdate(data);
        setRide(r => r ? { ...r, drop: { address: data.newDrop.address, coordinates: { lat: data.newDrop.lat, lng: data.newDrop.lng } }, fareEstimate: data.newFare } : r);
      });
    }

    return () => {
      clearInterval(pollRef.current);
      socket?.off("driverLocationUpdate");
      socket?.off("rideStatusUpdate");
      socket?.off("rideAccepted");
      socket?.off("rideCancelled");
      socket?.off("startOtpGenerated");
      socket?.off("destinationChanged");
    };
  }, [id, socket]);

  const loadRide = async () => {
    try {
      const { data } = await api.get(`/rides/${id}`);
      setRide(data.ride);
      if (data.ride?.driverId?.currentLocation) {
        const loc = data.ride.driverId.currentLocation;
        if (loc.lat && loc.lng) setDriverLoc(loc);
      }
    } catch {}
    setLoading(false);
  };

  const cancelRide = async () => {
    try {
      await api.post(`/rides/${id}/cancel`, { reason: cancelReason });
      setRide(r => ({ ...r, status: "CANCELLED" }));
      setShowCancel(false);
    } catch (e) { alert(e.response?.data?.message); }
  };

  const submitRating = async () => {
    if (!rating) return;
    try {
      await api.post("/ratings", { rideId: id, toDriverId: ride?.driverId?._id, ratedRole: "DRIVER", rating, review });
      setRatingDone(true);
    } catch {}
  };

  const handlePayNow = async () => {
    if (ride?.paymentMethod === "CASH") {
      setPaying(true);
      try {
        await api.post("/payment/cash", { rideId: id });
        setRide(r => ({ ...r, isPaid: true }));
        alert("✅ Cash payment recorded!");
      } catch (e) { alert(e.response?.data?.message); }
      setPaying(false);
      setShowPayment(false);
      return;
    }
    // Razorpay
    setPaying(true);
    try {
      const { data } = await api.post("/payment/order", { rideId: id });
      const opts = {
        key: data.keyId, amount: data.amount, currency: "INR",
        name: "RideBook", description: `Ride: ${ride?.pickup?.address?.substring(0,20)} → ${ride?.drop?.address?.substring(0,20)}`,
        order_id: data.orderId,
        handler: async (resp) => {
          await api.post("/payment/verify", { ...resp, rideId: id });
          setRide(r => ({ ...r, isPaid: true }));
          setShowPayment(false);
          alert("✅ Payment successful!");
        },
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#f5c518" },
      };
      if (window.Razorpay) { const rzp = new window.Razorpay(opts); rzp.open(); }
      else alert("Razorpay not loaded. Use Cash option.");
    } catch (e) { alert(e.response?.data?.message || "Payment failed"); }
    setPaying(false);
  };

  // Search new destination
  useEffect(() => {
    if (newDestQuery.length < 2) { setDestResults([]); return; }
    const t = setTimeout(async () => {
      const res = await searchIndiaPlaces(newDestQuery);
      setDestResults(res);
    }, 350);
    return () => clearTimeout(t);
  }, [newDestQuery]);

  const applyDestChange = async () => {
    if (!newDest) return;
    setDestChanging(true);
    try {
      const { data } = await api.put(`/rides/${id}/change-destination`, {
        dropAddress: newDest.address, dropLat: newDest.lat, dropLng: newDest.lng,
      });
      setShowDestChange(false);
      setNewDestQuery(""); setDestResults([]); setNewDest(null);
      setFareUpdate({ newFare: data.newFare, oldFare: ride?.fareEstimate, newDrop: newDest });
      setRide(r => ({ ...r, drop: { address: newDest.address, coordinates: { lat: newDest.lat, lng: newDest.lng } }, fareEstimate: data.newFare }));
    } catch (e) { alert(e.response?.data?.message || "Could not change destination."); }
    setDestChanging(false);
  };

  // ETA calculation from driver location
  const getEta = () => {
    if (!driverLoc || !ride?.pickup?.coordinates) return null;
    const dist = haversine(driverLoc.lat, driverLoc.lng, ride.pickup.coordinates.lat, ride.pickup.coordinates.lng);
    const mins = Math.max(1, Math.ceil(dist / 0.4 * 0.5)); // ~30 km/h city speed
    return { dist: dist.toFixed(1), mins };
  };

  if (loading) return <RideLayout><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", color: "var(--text3)", fontSize: 16 }}>Loading ride...</div></RideLayout>;

  const status = ride?.status || "SEARCHING";
  const cfg = STATUS[status] || STATUS.SEARCHING;
  const poly = ride?.routeCoordinates?.map(c => [c.lat, c.lng]) || [];
  const pickupC = ride?.pickup?.coordinates;
  const dropC   = ride?.drop?.coordinates;
  const driver  = ride?.driverId;
  const eta     = getEta();
  const driverName = driver?.userId?.name || driver?.name || "Driver";
  const mapCenter = driverLoc ? [driverLoc.lat, driverLoc.lng] : pickupC ? [pickupC.lat, pickupC.lng] : [28.6139, 77.2090];

  return (
    <RideLayout>
      <div style={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>

        {/* ── Left info panel ── */}
        <div style={{ width: 320, background: "var(--surface)", borderRight: "1px solid var(--border)", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "18px 16px 28px" }}>

            {/* Status card */}
            <div style={{ background: "var(--surface2)", borderRadius: "var(--r-lg)", padding: 20, marginBottom: 16, border: `1px solid ${cfg.color}44`, textAlign: "center" }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>{cfg.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: cfg.color, marginBottom: 4 }}>{cfg.label}</div>
              {cfg.pulse && (
                <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, animation: `bounce 1.4s ${i*0.2}s infinite` }} />)}
                </div>
              )}
            </div>

            {/* OTP display — shown when driver is ARRIVING */}
            {otpDisplay && status === "ARRIVING" && (
              <div style={{ background: "rgba(245,197,24,0.1)", border: "2px solid var(--accent)", borderRadius: "var(--r)", padding: 16, marginBottom: 16, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>🔐 Share this OTP with driver to start ride</div>
                <div style={{ fontSize: 40, fontWeight: 800, color: "var(--accent)", letterSpacing: 8, fontFamily: "var(--font-head)" }}>{otpDisplay}</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>Valid for this ride only</div>
              </div>
            )}

            {/* Driver ETA when arriving */}
            {eta && ["ACCEPTED", "ARRIVING"].includes(status) && (
              <div style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 14, marginBottom: 16, border: "1px solid var(--border)", display: "flex", justifyContent: "space-around" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent)" }}>{eta.mins} min</div>
                  <div style={{ fontSize: 10, color: "var(--text3)" }}>ETA</div>
                </div>
                <div style={{ width: 1, background: "var(--border)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{eta.dist} km</div>
                  <div style={{ fontSize: 10, color: "var(--text3)" }}>Away</div>
                </div>
              </div>
            )}

            {/* Ride info */}
            <div style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 14, marginBottom: 16 }}>
              <InfoRow label="Pickup" value={ride?.pickup?.address} />
              <InfoRow label="Drop" value={ride?.drop?.address} />
              <InfoRow label="Type" value={`${ride?.rideType} · ${ride?.cabType}`} />
              <InfoRow label="Distance" value={`${ride?.distanceKm} km`} />
              <InfoRow label="ETA" value={`${ride?.durationMin} min`} />
              <InfoRow label="Fare" value={`₹${ride?.fareEstimate}`} accent />
              {ride?.isPaid && <div style={{ textAlign: "center", color: "var(--green)", fontSize: 12, marginTop: 6, fontWeight: 600 }}>✅ Paid</div>}
            </div>

            {/* Fare update notification */}
            {fareUpdate && (
              <div style={{ background: "rgba(245,197,24,0.1)", border: "1px solid var(--accent)", borderRadius: "var(--r)", padding: 12, marginBottom: 16, fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>📍 Destination changed</div>
                <div style={{ color: "var(--text2)" }}>{fareUpdate.newDrop?.address}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--text3)", textDecoration: "line-through" }}>₹{fareUpdate.oldFare}</span>
                  <span style={{ color: "var(--accent)", fontWeight: 800 }}>₹{fareUpdate.newFare}</span>
                </div>
                <button onClick={() => setFareUpdate(null)} style={{ marginTop: 8, fontSize: 11, color: "var(--text3)", background: "none", border: "none", cursor: "pointer" }}>Dismiss</button>
              </div>
            )}

            {/* Driver info */}
            {driver && status !== "SEARCHING" && (
              <div style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 16, marginBottom: 16, border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Your Driver</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--accent-dim)", border: "2px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    {driver?.userId?.gender === "FEMALE" ? "👩" : "👨"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{driverName}</div>
                    <div style={{ fontSize: 12, color: "var(--text3)" }}>⭐ {driver?.rating || "—"} · {driver?.vehicle?.make} {driver?.vehicle?.model}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>🚗 {driver?.vehicle?.plateNumber}</div>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => nav(`/chat/${id}`)}
                    style={{ flex: 1, padding: "10px", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: 10, color: "var(--accent)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    💬 Chat
                  </button>
                  <button onClick={() => {/* WebRTC call */}}
                    style={{ flex: 1, padding: "10px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, color: "var(--green)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                    title="Call Driver (opens phone)">
                    <a href={`tel:${driver?.userId?.phone || ""}`} style={{ color: "inherit", textDecoration: "none" }}>📞 Call</a>
                  </button>
                </div>
              </div>
            )}

            {/* Mid-ride actions */}
            {status === "ONGOING" && (
              <div style={{ marginBottom: 16 }}>
                <button onClick={() => setShowDestChange(true)}
                  style={{ width: "100%", padding: "11px", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 10, color: "var(--blue)", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 8 }}>
                  📍 Change Destination
                </button>
              </div>
            )}

            {/* Pay Now */}
            {status === "COMPLETED" && !ride?.isPaid && (
              <button onClick={() => setShowPayment(true)}
                style={{ width: "100%", padding: "14px", background: "var(--accent)", border: "none", borderRadius: 12, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer", marginBottom: 12 }}>
                💳 Pay ₹{ride?.fareEstimate} Now
              </button>
            )}

            {/* Rating */}
            {status === "COMPLETED" && !ratingDone && (
              <div style={{ background: "var(--surface2)", borderRadius: "var(--r)", padding: 16, marginBottom: 16, border: "1px solid rgba(34,197,94,0.2)" }}>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>Rate Your Driver</div>
                <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setRating(s)}
                      style={{ fontSize: 30, background: "none", border: "none", cursor: "pointer", opacity: s <= rating ? 1 : 0.25, transition: "opacity 0.1s" }}>⭐</button>
                  ))}
                </div>
                <textarea value={review} onChange={e => setReview(e.target.value)}
                  placeholder="Write a review..." rows={2}
                  style={{ width: "100%", padding: "9px", borderRadius: 8, marginBottom: 10, resize: "none", fontSize: 13 }} />
                <button onClick={submitRating} disabled={!rating}
                  style={{ width: "100%", padding: "10px", background: rating ? "var(--green)" : "var(--border)", border: "none", borderRadius: 8, color: rating ? "#fff" : "var(--text3)", fontWeight: 700, cursor: rating ? "pointer" : "not-allowed" }}>
                  Submit Rating
                </button>
              </div>
            )}

            {ratingDone && <div style={{ textAlign: "center", color: "var(--green)", fontWeight: 700, padding: "8px 0", marginBottom: 12 }}>✅ Thanks for your feedback!</div>}

            {/* Cancel */}
            {["SEARCHING", "ACCEPTED", "ARRIVING"].includes(status) && (
              <button onClick={() => setShowCancel(true)}
                style={{ width: "100%", padding: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "var(--red)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
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

          {/* Driver distance overlay on map */}
          {eta && driverLoc && ["ACCEPTED","ARRIVING"].includes(status) && (
            <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(12,12,15,0.92)", backdropFilter: "blur(14px)", borderRadius: 12, padding: "12px 16px", border: "1px solid rgba(245,197,24,0.2)", zIndex: 1000, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5 }}>Driver</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>{eta.mins} min</div>
              <div style={{ fontSize: 11, color: "var(--text2)" }}>{eta.dist} km away</div>
            </div>
          )}
        </div>

        {/* ── Cancel Modal ── */}
        {showCancel && (
          <Modal onClose={() => setShowCancel(false)}>
            <h3 style={{ marginBottom: 16 }}>Cancel Ride?</h3>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="Reason (optional)..." rows={3}
              style={{ width: "100%", padding: "10px", borderRadius: 8, marginBottom: 16, resize: "none" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowCancel(false)} style={{ flex: 1, padding: "11px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text2)", cursor: "pointer" }}>Keep</button>
              <button onClick={cancelRide} style={{ flex: 1, padding: "11px", background: "var(--red)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Cancel Ride</button>
            </div>
          </Modal>
        )}

        {/* ── Change Destination Modal ── */}
        {showDestChange && (
          <Modal onClose={() => setShowDestChange(false)}>
            <h3 style={{ marginBottom: 4 }}>Change Destination</h3>
            <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 16 }}>New fare will be recalculated.</p>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <input value={newDestQuery} onChange={e => { setNewDestQuery(e.target.value); setNewDest(null); }}
                placeholder="Search new destination..." autoFocus
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14 }} />
              {destResults.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, zIndex: 10, maxHeight: 180, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                  {destResults.map((r, i) => (
                    <div key={i} onMouseDown={() => { setNewDest(r); setNewDestQuery(r.address); setDestResults([]); }}
                      style={{ padding: "9px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                      onMouseLeave={e => e.currentTarget.style.background = ""}>
                      📍 {r.address.split(",")[0]}<br />
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>{r.address.split(",").slice(1,3).join(",")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {newDest && <div style={{ padding: "10px 12px", background: "var(--accent-dim)", borderRadius: 8, fontSize: 13, color: "var(--accent)", marginBottom: 12 }}>✓ {newDest.address}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowDestChange(false)} style={{ flex: 1, padding: "11px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text2)", cursor: "pointer" }}>Cancel</button>
              <button onClick={applyDestChange} disabled={!newDest || destChanging}
                style={{ flex: 1, padding: "11px", background: newDest ? "var(--accent)" : "var(--border)", border: "none", borderRadius: 8, color: newDest ? "#000" : "var(--text3)", fontWeight: 700, cursor: newDest ? "pointer" : "not-allowed" }}>
                {destChanging ? "Updating..." : "Confirm"}
              </button>
            </div>
          </Modal>
        )}

        {/* ── Pay Modal ── */}
        {showPayment && (
          <Modal onClose={() => setShowPayment(false)}>
            <h3 style={{ marginBottom: 4 }}>Pay for Ride</h3>
            <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 20 }}>Amount due: <strong style={{ color: "var(--accent)", fontSize: 20 }}>₹{ride?.fareEstimate}</strong></p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handlePayNow} disabled={paying}
                style={{ flex: 1, padding: "13px", background: "var(--accent)", border: "none", borderRadius: 10, color: "#000", fontWeight: 800, fontSize: 15, cursor: paying ? "not-allowed" : "pointer" }}>
                {paying ? "Processing..." : ride?.paymentMethod === "CASH" ? "💵 Confirm Cash" : "💳 Pay Online"}
              </button>
            </div>
          </Modal>
        )}
      </div>

      <style>{`
        @keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
      `}</style>
    </RideLayout>
  );
}

const InfoRow = ({ label, value, accent }) => (
  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
    <span style={{ color: "var(--text3)", fontSize: 12, flexShrink: 0 }}>{label}</span>
    <span style={{ fontWeight: accent ? 800 : 500, fontSize: accent ? 17 : 13, color: accent ? "var(--accent)" : "var(--text)", textAlign: "right" }}>{value}</span>
  </div>
);

const Modal = ({ children, onClose }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={e => e.target === e.currentTarget && onClose()}>
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 28, maxWidth: 380, width: "90%", maxHeight: "80vh", overflowY: "auto" }}>
      {children}
    </div>
  </div>
);
