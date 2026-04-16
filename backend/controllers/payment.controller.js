// controllers/payment.controller.js
import crypto from "crypto";
import { Payment } from "../models/index.models.js";
import Ride from "../models/Ride.model.js";

// ── Cash payment — always works ───────────────────────────
export const confirmCashPayment = async (req, res) => {
  try {
    const { rideId } = req.body;
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found." });
    const existing = await Payment.findOne({ rideId, status: "COMPLETED" });
    if (existing) return res.json({ success: true, message: "Already paid." });
    await Payment.create({
      rideId, riderId: req.user._id, driverId: ride.driverId,
      amount: ride.fareEstimate, method: "CASH", status: "COMPLETED",
    });
    ride.isPaid = true;
    await ride.save();
    res.json({ success: true, message: "Cash payment recorded. ✅" });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Razorpay order — only if properly configured ──────────
export const createOrder = async (req, res) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID || "";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
    const configured = keyId.startsWith("rzp_") && keySecret.length > 10
      && !keyId.includes("your_key") && !keyId.includes("your_");

    if (!configured) {
      // Return 200 with a flag — not an error, just not configured yet
      return res.json({
        success: false,
        razorpayNotConfigured: true,
        message: "Razorpay keys not set in .env. Use Cash payment.",
      });
    }

    let Razorpay;
    try {
      const mod = await import("razorpay");
      Razorpay = mod.default;
    } catch {
      return res.json({
        success: false,
        razorpayNotConfigured: true,
        message: "Razorpay package not installed. Run: cd backend && npm install razorpay",
      });
    }

    const { rideId } = req.body;
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found." });

    const amount = Math.round((ride.fareEstimate || 100) * 100);
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await rzp.orders.create({ amount, currency: "INR", receipt: `ride_${rideId}` });

    await Payment.create({
      rideId, riderId: req.user._id, driverId: ride.driverId,
      amount: amount / 100, method: "RAZORPAY",
      status: "PENDING", razorpayOrderId: order.id,
    });

    res.json({ success: true, orderId: order.id, amount: order.amount, currency: "INR", keyId });
  } catch (e) {
    console.error("createOrder error:", e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── Verify Razorpay signature ─────────────────────────────
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, rideId } = req.body;
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if (expected !== razorpay_signature)
      return res.status(400).json({ success: false, message: "Invalid payment signature." });
    await Payment.findOneAndUpdate({ razorpayOrderId: razorpay_order_id }, { status: "COMPLETED", razorpayPaymentId: razorpay_payment_id });
    await Ride.findByIdAndUpdate(rideId, { isPaid: true });
    res.json({ success: true, message: "Payment verified ✅" });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ riderId: req.user._id })
      .populate("rideId", "pickup drop rideType cabType fareEstimate").sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
