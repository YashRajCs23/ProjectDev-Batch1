// models/Ride.model.js
import mongoose from "mongoose";

const rideSchema = new mongoose.Schema({
  rideType:  { type: String, enum: ["PRIVATE","SHARED"], default: "PRIVATE" },
  cabType:   { type: String, enum: ["MINI","SEDAN","SUV","PREMIUM"], default: "SEDAN" },
  tripType:  { type: String, enum: ["INTRACITY","INTERCITY","BOTH"], default: "INTRACITY" },

  pickup: {
    address: String,
    coordinates: { lat: Number, lng: Number },
  },
  drop: {
    address: String,
    coordinates: { lat: Number, lng: Number },
  },

  routeCoordinates: [{ lat: Number, lng: Number }],
  distanceKm:  { type: Number, default: 0 },
  durationMin: { type: Number, default: 0 },

  fareEstimate:    { type: Number, default: 0 },
  surgeMultiplier: { type: Number, default: 1.0 },

  // ── Shared ride seats & schedule ─────────────────────────
  maxRiders:    { type: Number, default: 1 },
  availableSeats: { type: Number, default: 1 },
  departureTime:  { type: Date, default: Date.now },

  // ── Ride Preferences (for shared rides) ──────────────────
  preferences: {
    smoking:    { type: Boolean, default: false }, // smoking allowed
    pets:       { type: Boolean, default: false }, // pets allowed
    music:      { type: Boolean, default: true  }, // music allowed
    ac:         { type: Boolean, default: true  }, // AC on
    luggage:    { type: Boolean, default: true  }, // luggage allowed
    chatty:     { type: Boolean, default: true  }, // chatty driver
  },

  genderPreference: { type: String, enum: ["ANY","MALE_ONLY","FEMALE_ONLY"], default: "ANY" },
  paymentMethod: { type: String, enum: ["CASH","RAZORPAY"], default: "CASH" },

  status: {
    type: String,
    enum: ["SEARCHING","ACCEPTED","ARRIVING","ONGOING","COMPLETED","CANCELLED"],
    default: "SEARCHING",
  },

  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },

  // ── Passengers ────────────────────────────────────────────
  riders: [{
    riderId:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    pickup:    { address: String, coordinates: { lat: Number, lng: Number } },
    drop:      { address: String, coordinates: { lat: Number, lng: Number } },
    fare:      Number,
    routeMatchPct: { type: Number, default: 100 },
    status:    { type: String, enum: ["PENDING","ACCEPTED","ONBOARD","DROPPED","CANCELLED"], default: "PENDING" },
    joinedAt:  { type: Date, default: Date.now },
  }],

  // ── Join Requests (rider → driver approval flow) ──────────
  joinRequests: [{
    riderId:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    riderName:   String,
    pickupAddress: String,
    dropAddress:   String,
    pickupLat:   Number, pickupLng: Number,
    dropLat:     Number, dropLng:   Number,
    routeMatchPct: Number,
    fare:        Number,
    message:     { type: String, default: "" }, // optional message from rider
    status:      { type: String, enum: ["PENDING","APPROVED","REJECTED"], default: "PENDING" },
    requestedAt: { type: Date, default: Date.now },
  }],

  // ── Status flags ──────────────────────────────────────────
  isPaid:        { type: Boolean, default: false },
  cancelledBy:   { type: String, enum: ["RIDER","DRIVER","ADMIN",""], default: "" },
  cancelReason:  { type: String, default: "" },
  cancellationFee: { type: Number, default: 0 },
  startOtp:        { type: String, default: null },
  startOtpVerified:{ type: Boolean, default: false },

}, { timestamps: true });

export default mongoose.models.Ride || mongoose.model("Ride", rideSchema);
