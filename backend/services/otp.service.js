// services/otp.service.js
import { OTP } from "../models/index.models.js";

export const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const saveAndSendOTP = async (email) => {
  await OTP.deleteMany({ email });
  const otp = generateOTP();
  const minutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
  const expiresAt = new Date(Date.now() + minutes * 60000);
  await OTP.create({ email, otp, expiresAt });
  // In production: replace with SMS/email service
  console.log(`\n🔐 OTP for ${email}: ${otp}  (expires in ${minutes} min)\n`);
  return { success: true };
};

export const verifyOTPCode = async (email, inputOtp) => {
  const record = await OTP.findOne({ email, isUsed: false });
  if (!record) return { valid: false, message: "No OTP found. Request a new one." };
  if (new Date() > record.expiresAt) {
    await OTP.deleteOne({ _id: record._id });
    return { valid: false, message: "OTP expired." };
  }
  if (record.otp !== inputOtp) return { valid: false, message: "Invalid OTP." };
  await OTP.findByIdAndUpdate(record._id, { isUsed: true });
  return { valid: true };
};
