// routes/driver.routes.js
import express from "express";
import { registerDriver, getMyDriver, updateDriver, toggleOnline, updateLocation, getNearbyDrivers } from "../controllers/driver.controller.js";
import { protect, requireRole } from "../middleware/auth.middleware.js";
const r = express.Router();
r.post("/register", protect, registerDriver);
r.get("/me", protect, requireRole("DRIVER"), getMyDriver);
r.put("/me", protect, requireRole("DRIVER"), updateDriver);
r.post("/toggle-online", protect, requireRole("DRIVER"), toggleOnline);
r.post("/location", protect, requireRole("DRIVER"), updateLocation);
r.get("/nearby", protect, getNearbyDrivers);
export default r;
