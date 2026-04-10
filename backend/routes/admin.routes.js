// routes/admin.routes.js
import express from "express";
import { protect, requireRole } from "../middleware/auth.middleware.js";
import {
  getDashboard, getAllUsers, getAllDrivers, approveDriver, blockUser, unblockUser,
  getAllComplaints, resolveComplaint, getAllRides,
} from "../controllers/admin.controller.js";

const router = express.Router();
const admin = [protect, requireRole("ADMIN")];

router.get("/dashboard", ...admin, getDashboard);
router.get("/users", ...admin, getAllUsers);
router.get("/drivers", ...admin, getAllDrivers);
router.put("/drivers/:id/approve", ...admin, approveDriver);
router.put("/block", ...admin, blockUser);
router.put("/unblock", ...admin, unblockUser);
router.get("/complaints", ...admin, getAllComplaints);
router.put("/complaints/:id", ...admin, resolveComplaint);
router.get("/rides", ...admin, getAllRides);

export default router;