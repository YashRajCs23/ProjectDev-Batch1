// controllers/auth.controller.js
import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import Driver from "../models/Driver.model.js";
import { saveAndSendOTP, verifyOTPCode } from "../services/otp.service.js";

const sign = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

const safeUser = (u) => ({
  id: u._id, name: u.name, email: u.email, gender: u.gender,
  role: u.role, rating: u.rating, nameVisibility: u.nameVisibility,
  isProfileBlurred: u.isProfileBlurred,
});

export const register = async (req, res) => {
  try {
    const { name, email, password, gender, role, phone } = req.body;
    if (!name || !email || !password || !gender)
      return res.status(400).json({ success: false, message: "All fields required." });
    if (await User.findOne({ email }))
      return res.status(409).json({ success: false, message: "Email already registered." });

    const user = await User.create({ name, email, password, gender, role: role || "RIDER", phone });
    res.status(201).json({ success: true, token: sign(user._id), user: safeUser(user) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    if (user.isBlocked)
      return res.status(403).json({ success: false, message: "Account blocked." });
    res.json({ success: true, token: sign(user._id), user: safeUser(user) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const requestOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "No account with this email." });
    await saveAndSendOTP(email);
    res.json({ success: true, message: "OTP sent. Check console." });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const result = await verifyOTPCode(email, otp);
    if (!result.valid) return res.status(401).json({ success: false, message: result.message });
    const user = await User.findOne({ email });
    res.json({ success: true, token: sign(user._id), user: safeUser(user) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    let driverProfile = null;
    if (user.role === "DRIVER") {
      driverProfile = await Driver.findOne({ userId: user._id });
    }
    res.json({ success: true, user, driverProfile });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const updateProfile = async (req, res) => {
  try {
    const allowed = ["nameVisibility", "isProfileBlurred", "phone", "trustedContacts"];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ success: true, user });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
