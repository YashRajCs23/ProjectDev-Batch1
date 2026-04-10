// routes/rating.routes.js
import express from "express";
import { submitRating } from "../controllers/admin.controller.js";
import { protect } from "../middleware/auth.middleware.js";
const router = express.Router();
router.post("/", protect, submitRating);
export default router;
