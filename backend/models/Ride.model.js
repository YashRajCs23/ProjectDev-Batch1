// models/Ride.model.js
import mongoose from "mongoose";

const CoordSchema = new mongoose.Schema({ lat: Number, lng: Number }, { _id: false });

const RideSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },

    // ── Ride type ─────────────────────────────────────────
    rideType:  { type: String, enum: ["PRIVATE", "SHARED"], required: true },
    cabType:   { type: String, enum: ["MINI", "SEDAN", "SUV", "PREMIUM"], required: true },
    tripType:  { type: String, enum: ["INTRACITY", "INTERCITY"], default: "INTRACITY" },

    // ── Route ─────────────────────────────────────────────
    pickup: {
      address: { type: String, required: true },
      coordinates: CoordSchema,
    },
    drop: {
      address: { type: String, required: true },
      coordinates: CoordSchema,
    },
    routeCoordinates: [CoordSchema],   // Full polyline from routing API
    distanceKm: { type: Number, default: 0 },
    durationMin: { type: Number, default: 0 },

    // ── Fare ──────────────────────────────────────────────
    fareEstimate: { type: Number, default: 0 },   // INR
    surgeMultiplier: { type: Number, default: 1.0 },

    // ── Passengers (shared rides can have multiple) ───────
    riders: [
      {
        riderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        pickup:  { address: String, coordinates: CoordSchema },
        drop:    { address: String, coordinates: CoordSchema },
        fare:    Number,
        routeMatchPct: Number,
        status: { type: String, enum: ["PENDING", "ACCEPTED", "ONBOARD", "DROPPED"], default: "PENDING" },
      },
    ],
    maxRiders: { type: Number, default: 1 }, // 1=private, 3=shared

    // ── Gender preference ─────────────────────────────────
    genderPreference: {
      type: String,
      enum: ["MALE_ONLY", "FEMALE_ONLY", "ANY"],
      default: "ANY",
    },

    // ── Status ───────────────────────────────────────────
    status: {
      type: String,
      enum: ["SEARCHING", "ACCEPTED", "ARRIVING", "ONGOING", "COMPLETED", "CANCELLED"],
      default: "SEARCHING",
    },

    // ── Scheduled departure ───────────────────────────────
    departureTime: { type: Date, default: Date.now },

    // ── Payment ───────────────────────────────────────────
    paymentMethod: { type: String, enum: ["RAZORPAY", "CASH"], default: "CASH" },
    isPaid: { type: Boolean, default: false },

    // ── Cancellation ─────────────────────────────────────
    cancelledBy: { type: String, enum: ["RIDER", "DRIVER", "ADMIN"], default: null },
    cancelReason: { type: String, default: "" },
    cancellationFee: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Ride", RideSchema);
