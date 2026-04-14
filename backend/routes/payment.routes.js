import express from "express";
import { createOrder, verifyPayment, confirmCashPayment, getMyPayments } from "../controllers/payment.controller.js";
import { protect } from "../middleware/auth.middleware.js";
const r = express.Router();
r.post("/order", protect, createOrder);
r.post("/verify", protect, verifyPayment);
r.post("/cash", protect, confirmCashPayment);
r.get("/my", protect, getMyPayments);
export default r;