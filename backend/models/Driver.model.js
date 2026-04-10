// models/Driver.model.js
import mongoose from "mongoose";

const DriverSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    // ── Vehicle ──────────────────────────────────────────
    vehicle: {
      make:        { type: String, required: true },      // e.g. Maruti
      model:       { type: String, required: true },      // e.g. Swift
      year:        { type: Number },
      color:       { type: String },
      plateNumber: { type: String, required: true },
      cabType:     { type: String, enum: ["MINI", "SEDAN", "SUV", "PREMIUM"], required: true },
    },

    // ── License ──────────────────────────────────────────
    licenseNumber: { type: String, required: true },
    licenseDoc:    { type: String, default: "" },         // URL/base64

    // ── Mode ─────────────────────────────────────────────
    rideMode: {
      type: String,
      enum: ["PRIVATE_ONLY", "SHARED_ONLY", "HYBRID"],
      default: "HYBRID",
    },
    tripType: {
      type: String,
      enum: ["INTRACITY", "INTERCITY", "BOTH"],
      default: "INTRACITY",
    },

    // ── Gender preference ─────────────────────────────────
    genderPreference: {
      type: String,
      enum: ["MALE_ONLY", "FEMALE_ONLY", "ANY"],
      default: "ANY",
    },

    // ── Status ───────────────────────────────────────────
    isOnline:   { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: false },
    isBlocked:  { type: Boolean, default: false },

    // ── Location (last known) ─────────────────────────────
    currentLocation: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 },
      updatedAt: { type: Date },
    },

    // ── Rating ───────────────────────────────────────────
    rating: { type: Number, default: 5.0, min: 1, max: 5 },
    totalRatings: { type: Number, default: 0 },
    totalRides: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },

    // ── Current Ride ─────────────────────────────────────
    currentRideId: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Driver", DriverSchema);
