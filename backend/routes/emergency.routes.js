import express from "express";
import { triggerSOS, getMyAlerts, resolveAlert } from "../controllers/admin.controller.js";
import { protect } from "../middleware/auth.middleware.js";
const router = express.Router();
router.post("/alert", protect, triggerSOS);
router.get("/my", protect, getMyAlerts);
router.put("/:id/resolve", protect, resolveAlert);
export default router;