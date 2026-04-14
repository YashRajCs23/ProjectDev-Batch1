import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    rideId:      { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true },
    riderId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    driverId:    { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
    amount:      { type: Number, required: true },       // INR
    method:      { type: String, enum: ["RAZORPAY", "CASH"], required: true },
    status:      { type: String, enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"], default: "PENDING" },
    razorpayOrderId:   { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Payment = mongoose.model("Payment", PaymentSchema);

// OTP
const OTPSchema = new mongoose.Schema({
  email:     { type: String, required: true, lowercase: true },
  otp:       { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  isUsed:    { type: Boolean, default: false },
});
export const OTP = mongoose.model("OTP", OTPSchema);

// Message
const MessageSchema = new mongoose.Schema(
  {
    rideId:      { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true },
    senderId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderRole:  { type: String, enum: ["RIDER", "DRIVER"], required: true },
    message:     { type: String, required: true, trim: true, maxlength: 1000 },
    messageType: { type: String, enum: ["TEXT", "SYSTEM"], default: "TEXT" },
  },
  { timestamps: true }
);
export const Message = mongoose.model("Message", MessageSchema);

// Emergency
const EmergencySchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rideId:   { type: mongoose.Schema.Types.ObjectId, ref: "Ride", default: null },
    location: { lat: Number, lng: Number, address: { type: String, default: "" } },
    status:   { type: String, enum: ["ACTIVE", "RESOLVED"], default: "ACTIVE" },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);
export const Emergency = mongoose.model("Emergency", EmergencySchema);

// Rating
const RatingSchema = new mongoose.Schema(
  {
    rideId:     { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    toUserId:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    toDriverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
    ratedRole:  { type: String, enum: ["DRIVER", "RIDER"], required: true },
    rating:     { type: Number, required: true, min: 1, max: 5 },
    review:     { type: String, default: "" },
  },
  { timestamps: true }
);
export const Rating = mongoose.model("Rating", RatingSchema);

// Complaint
const ComplaintSchema = new mongoose.Schema(
  {
    rideId:       { type: mongoose.Schema.Types.ObjectId, ref: "Ride" },
    filedBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    againstUserId:{ type: mongoose.Schema.Types.ObjectId, ref: "User" },
    againstRole:  { type: String, enum: ["DRIVER", "RIDER"] },
    subject:      { type: String, required: true },
    description:  { type: String, required: true },
    status:       { type: String, enum: ["OPEN", "REVIEWED", "RESOLVED", "DISMISSED"], default: "OPEN" },
    adminNote:    { type: String, default: "" },
  },
  { timestamps: true }
);
export const Complaint = mongoose.model("Complaint", ComplaintSchema);