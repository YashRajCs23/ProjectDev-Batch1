// routes/ride.routes.js
import express from "express";
import {
  estimateFare, createRide, acceptRide, updateRideStatus, cancelRide,
  getSharedRides, joinSharedRide, getRideById, getMyRides, getDriverRides, geocodeProxy
} from "../controllers/ride.controller.js";
import { protect, requireRole } from "../middleware/auth.middleware.js";

const r = express.Router();

// ── Static routes MUST come before /:id ──────────────────
r.get("/estimate",     protect, estimateFare);
r.get("/my-rides",     protect, getMyRides);
r.get("/driver-rides", protect, requireRole("DRIVER"), getDriverRides);
r.get("/shared",       protect, getSharedRides);
r.get("/geocode",      geocodeProxy);

// Test socket broadcast - BEFORE /:id route!
r.get("/test-notify", protect, (req, res) => {
  req.io?.emit("newRideAvailable", {
    rideId: "test-" + Date.now(),
    cabType: "SEDAN",
    rideType: "PRIVATE",
    pickup: { address: "Test Pickup — Connaught Place, New Delhi", lat: 28.6315, lng: 77.2167 },
    fare: 250,
    distanceKm: "12.5",
    genderPreference: "ANY",
    isTest: true,
  });
  res.json({ success: true, message: "Test notification sent to all connected sockets" });
});

// ── Dynamic routes ────────────────────────────────────────
r.post("/",   protect, createRide);
r.get("/:id", protect, getRideById);

r.post("/:id/accept",     protect, requireRole("DRIVER"), acceptRide);
r.put("/:id/status",      protect, requireRole("DRIVER"), updateRideStatus);
r.post("/:id/cancel",     protect, cancelRide);
r.post("/:id/join-shared", protect, joinSharedRide);

export default r;
