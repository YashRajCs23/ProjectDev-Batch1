import express from "express";
import { fileComplaint } from "../controllers/admin.controller.js";
import { protect } from "../middleware/auth.middleware.js";
const router = express.Router();
router.post("/complaint", protect, fileComplaint);
export default router;
