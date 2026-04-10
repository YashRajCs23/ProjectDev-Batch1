// controllers/admin.controller.js
import User from "../models/User.model.js";
import Driver from "../models/Driver.model.js";
import Ride from "../models/Ride.model.js";
import { Complaint, Rating, Payment } from "../models/index.models.js";

export const getDashboard = async (req, res) => {
  try {
    const [totalUsers, totalDrivers, totalRides, pendingApprovals, openComplaints, totalRevenue] =
      await Promise.all([
        User.countDocuments({ role: "RIDER" }),
        Driver.countDocuments(),
        Ride.countDocuments(),
        Driver.countDocuments({ isApproved: false, isBlocked: false }),
        Complaint.countDocuments({ status: "OPEN" }),
        Payment.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
      ]);
    res.json({ success: true, stats: { totalUsers, totalDrivers, totalRides, pendingApprovals, openComplaints, totalRevenue: totalRevenue[0]?.total || 0 } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: "RIDER" }).sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const getAllDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find().populate("userId", "name email gender rating isBlocked").sort({ createdAt: -1 });
    res.json({ success: true, drivers });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const approveDriver = async (req, res) => {
  try {
    const driver = await Driver.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
    res.json({ success: true, message: "Driver approved.", driver });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const blockUser = async (req, res) => {
  try {
    const { targetId, targetType } = req.body; // targetType: "user" | "driver"
    if (targetType === "driver") {
      await Driver.findByIdAndUpdate(targetId, { isBlocked: true });
    } else {
      await User.findByIdAndUpdate(targetId, { isBlocked: true });
    }
    res.json({ success: true, message: "Blocked." });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const unblockUser = async (req, res) => {
  try {
    const { targetId, targetType } = req.body;
    if (targetType === "driver") {
      await Driver.findByIdAndUpdate(targetId, { isBlocked: false });
    } else {
      await User.findByIdAndUpdate(targetId, { isBlocked: false });
    }
    res.json({ success: true, message: "Unblocked." });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate("filedBy", "name email")
      .populate("againstUserId", "name email role")
      .sort({ createdAt: -1 });
    res.json({ success: true, complaints });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const resolveComplaint = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, { status, adminNote }, { new: true });
    res.json({ success: true, complaint });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const getAllRides = async (req, res) => {
  try {
    const rides = await Ride.find()
      .populate({ path: "driverId", populate: { path: "userId", select: "name" } })
      .sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, rides });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ─────────────────────────────────────────────────────────────
// controllers/rating.controller.js logic bundled here
import { Rating as RatingModel } from "../models/index.models.js";

export const submitRating = async (req, res) => {
  try {
    const { rideId, toUserId, toDriverId, ratedRole, rating, review } = req.body;
    const existing = await RatingModel.findOne({ rideId, fromUserId: req.user._id });
    if (existing) return res.status(409).json({ success: false, message: "Already rated." });

    await RatingModel.create({ rideId, fromUserId: req.user._id, toUserId, toDriverId, ratedRole, rating, review });

    // Update aggregate rating
    if (ratedRole === "DRIVER" && toDriverId) {
      const driver = await Driver.findById(toDriverId);
      const newTotal = driver.totalRatings + 1;
      const newRating = ((driver.rating * driver.totalRatings) + rating) / newTotal;
      await Driver.findByIdAndUpdate(toDriverId, { rating: newRating.toFixed(1), totalRatings: newTotal });
    } else if (ratedRole === "RIDER" && toUserId) {
      const user = await User.findById(toUserId);
      const newTotal = user.totalRatings + 1;
      const newRating = ((user.rating * user.totalRatings) + rating) / newTotal;
      await User.findByIdAndUpdate(toUserId, { rating: newRating.toFixed(1), totalRatings: newTotal });
    }

    res.json({ success: true, message: "Rating submitted." });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ─────────────────────────────────────────────────────────────
// Complaint
import { Complaint as ComplaintModel } from "../models/index.models.js";

export const fileComplaint = async (req, res) => {
  try {
    const { rideId, againstUserId, againstRole, subject, description } = req.body;
    const complaint = await ComplaintModel.create({
      rideId, filedBy: req.user._id, againstUserId, againstRole, subject, description,
    });
    res.status(201).json({ success: true, complaint });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ─────────────────────────────────────────────────────────────
// Emergency
import { Emergency as EmergencyModel } from "../models/index.models.js";

export const triggerSOS = async (req, res) => {
  try {
    const { rideId, location } = req.body;
    const em = await EmergencyModel.create({ userId: req.user._id, rideId: rideId || null, location });
    console.log(`\n🚨 SOS! User: ${req.user.email} | Loc: ${location?.lat}, ${location?.lng}\n`);
    req.io?.emit("sosAlert", { userId: req.user._id, location, rideId });
    res.status(201).json({ success: true, emergency: em });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const getMyAlerts = async (req, res) => {
  try {
    const alerts = await EmergencyModel.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, alerts });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const resolveAlert = async (req, res) => {
  try {
    const alert = await EmergencyModel.findByIdAndUpdate(req.params.id, { status: "RESOLVED", resolvedAt: new Date() }, { new: true });
    res.json({ success: true, alert });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ─────────────────────────────────────────────────────────────
// Chat
import { Message as MessageModel } from "../models/index.models.js";
import Ride2 from "../models/Ride.model.js";

export const getChatHistory = async (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = await Ride2.findById(rideId);
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found." });

    const isParticipant = ride.riders.some((r) => String(r.riderId) === String(req.user._id)) ||
      (req.user.role === "DRIVER");

    if (!isParticipant) return res.status(403).json({ success: false, message: "Not authorized." });

    const messages = await MessageModel.find({ rideId })
      .populate("senderId", "name nameVisibility")
      .sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
