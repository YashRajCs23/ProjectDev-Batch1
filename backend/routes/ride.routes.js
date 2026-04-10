// routes/ride.routes.js
import express from "express";
import {
  estimateFare, createRide, acceptRide, updateRideStatus, cancelRide,
  getSharedRides, joinSharedRide, getRideById, getMyRides, getDriverRides, geocodeProxy
} from "../controllers/ride.controller.js";
import { protect, requireRole } from "../middleware/auth.middleware.js";
const r = express.Router();
r.get("/estimate", protect, estimateFare);
r.post("/", protect, createRide); // Any authenticated user can book a ride
r.get("/my-rides", protect, getMyRides);
r.get("/driver-rides", protect, requireRole("DRIVER"), getDriverRides);
r.get("/shared", protect, getSharedRides);
r.get("/geocode", geocodeProxy);
r.get("/:id", protect, getRideById);
r.post("/:id/accept", protect, requireRole("DRIVER"), acceptRide);
r.put("/:id/status", protect, requireRole("DRIVER"), updateRideStatus);
r.post("/:id/cancel", protect, cancelRide);
r.post("/:id/join-shared", protect, joinSharedRide);
export default r;
