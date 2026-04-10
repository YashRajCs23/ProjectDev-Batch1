// controllers/payment.controller.js
import Razorpay from "razorpay";
import crypto from "crypto";
import { Payment } from "../models/index.models.js";
import Ride from "../models/Ride.model.js";

const getRazorpay = () =>
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

// ── Create Razorpay order ──────────────────────────────────
export const createOrder = async (req, res) => {
  try {
    const { rideId } = req.body;
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found." });

    const riderEntry = ride.riders.find((r) => String(r.riderId) === String(req.user._id));
    const amount = (riderEntry?.fare || ride.fareEstimate) * 100; // paise

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `ride_${rideId}_${Date.now()}`,
    });

    const payment = await Payment.create({
      rideId,
      riderId: req.user._id,
      driverId: ride.driverId,
      amount: amount / 100,
      method: "RAZORPAY",
      razorpayOrderId: order.id,
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      paymentId: payment._id,
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Verify Razorpay payment signature ─────────────────────
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, rideId } = req.body;

    const expectedSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSig !== razorpay_signature)
      return res.status(400).json({ success: false, message: "Invalid payment signature." });

    // Mark payment as completed
    await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      { status: "COMPLETED", razorpayPaymentId: razorpay_payment_id }
    );

    // Mark ride as paid
    await Ride.findByIdAndUpdate(rideId, { isPaid: true });

    res.json({ success: true, message: "Payment verified ✅" });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Cash payment confirmation ─────────────────────────────
export const confirmCashPayment = async (req, res) => {
  try {
    const { rideId } = req.body;
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found." });

    await Payment.create({
      rideId,
      riderId: req.user._id,
      driverId: ride.driverId,
      amount: ride.fareEstimate,
      method: "CASH",
      status: "COMPLETED",
    });

    ride.isPaid = true;
    await ride.save();

    res.json({ success: true, message: "Cash payment recorded." });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ riderId: req.user._id })
      .populate("rideId", "pickup drop rideType cabType")
      .sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
