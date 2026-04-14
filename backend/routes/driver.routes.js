import express from "express";
import { registerDriver, getMyDriver, updateDriver, toggleOnline, updateLocation, getNearbyDrivers } from "../controllers/driver.controller.js";
import { protect, requireRole } from "../middleware/auth.middleware.js";
import Driver from "../models/Driver.model.js";
import Ride from "../models/Ride.model.js";
import User from "../models/User.model.js";

const r = express.Router();

r.post("/register",       protect, registerDriver);
r.get("/me",              protect, requireRole("DRIVER"), getMyDriver);
r.put("/me",              protect, requireRole("DRIVER"), updateDriver);
r.post("/toggle-online",  protect, requireRole("DRIVER"), toggleOnline);
r.post("/location",       protect, requireRole("DRIVER"), updateLocation);
r.get("/nearby",          protect, getNearbyDrivers);

// ── Polling endpoint: driver fetches pending ride requests ─
r.get("/pending-rides", protect, requireRole("DRIVER"), async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver?.isApproved || !driver?.isOnline) {
      return res.json({ success: true, rides: [] });
    }

    const driverUser = await User.findById(req.user._id);

    // Find SEARCHING rides matching this driver's cab type
    const rides = await Ride.find({
      status: "SEARCHING",
      cabType: driver.vehicle?.cabType,
    }).sort({ createdAt: -1 }).limit(15).lean();

    // Filter by gender preference
    const compatible = rides.filter(ride => {
      if (ride.genderPreference === "ANY") return true;
      if (ride.genderPreference === "MALE_ONLY"   && driverUser?.gender === "MALE")   return true;
      if (ride.genderPreference === "FEMALE_ONLY" && driverUser?.gender === "FEMALE") return true;
      return false;
    });

    res.json({
      success: true,
      rides: compatible.map(r => ({
        rideId:          String(r._id),
        cabType:         r.cabType,
        rideType:        r.rideType,
        pickup:          r.pickup,
        fare:            r.fareEstimate,
        distanceKm:      r.distanceKm,
        genderPreference:r.genderPreference,
        createdAt:       r.createdAt,
      }))
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default r;