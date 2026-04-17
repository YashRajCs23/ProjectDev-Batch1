// routes/ride.routes.js
import express from "express";
import {
  estimateFare, createRide, acceptRide, updateRideStatus, cancelRide,
  getSharedRides, joinSharedRide, getRideById, getMyRides, getDriverRides, geocodeProxy,
  generateStartOtp, verifyStartOtp, changeDestination,
  createPool, requestToJoin, respondToJoinRequest, searchPools,
} from "../controllers/ride.controller.js";
import { protect, requireRole } from "../middleware/auth.middleware.js";

const r = express.Router();

// Static routes first
r.get("/estimate",        protect, estimateFare);
r.get("/my-rides",        protect, getMyRides);
r.get("/driver-rides",    protect, requireRole("DRIVER"), getDriverRides);
r.get("/shared",          protect, getSharedRides);
r.get("/search-pools",    protect, searchPools);
r.get("/geocode",         geocodeProxy);

r.get("/test-notify", protect, (req, res) => {
  req.io?.emit("newRideAvailable", { rideId: "test-" + Date.now(), cabType: "SEDAN", rideType: "PRIVATE", pickup: { address: "Test", lat: 28.63, lng: 77.21 }, fare: 250, distanceKm: "12", genderPreference: "ANY", isTest: true });
  res.json({ success: true, message: "Test sent" });
});

// Pool routes
r.post("/pool",           protect, requireRole("DRIVER"), createPool);

// Dynamic routes
r.post("/",               protect, createRide);
r.get("/:id",             protect, getRideById);
r.post("/:id/accept",     protect, requireRole("DRIVER"), acceptRide);
r.put("/:id/status",      protect, requireRole("DRIVER"), updateRideStatus);
r.post("/:id/cancel",     protect, cancelRide);
r.post("/:id/join-shared",         protect, joinSharedRide);
r.post("/:id/request-join",        protect, requestToJoin);
r.post("/:id/respond-join",        protect, requireRole("DRIVER"), respondToJoinRequest);
r.post("/:id/generate-otp",        protect, requireRole("DRIVER"), generateStartOtp);
r.post("/:id/verify-otp",          protect, requireRole("DRIVER"), verifyStartOtp);
r.put("/:id/change-destination",   protect, changeDestination);

export default r;
