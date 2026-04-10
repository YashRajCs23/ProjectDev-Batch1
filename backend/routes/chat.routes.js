// routes/chat.routes.js
import express from "express";
import { getChatHistory } from "../controllers/admin.controller.js";
import { protect } from "../middleware/auth.middleware.js";
const router = express.Router();
router.get("/:rideId", protect, getChatHistory);
export default router;
