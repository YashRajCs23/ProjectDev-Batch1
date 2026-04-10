// seed.js — Run: node seed.js
// Works with both local MongoDB AND MongoDB Atlas
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
dotenv.config();

const URI = process.env.MONGO_URI || "mongodb://localhost:27017/ridebook";

const seed = async () => {
  await mongoose.connect(URI);

  // Import models first so collections exist before we clear them
  const { default: User } = await import("./models/User.model.js");
  const { default: Driver } = await import("./models/Driver.model.js");

  // Use deleteMany instead of dropDatabase (Atlas-compatible)
  await User.deleteMany({});
  await Driver.deleteMany({});

  // Also clear other collections if they exist
  const collections = ["otps", "rides", "payments", "messages", "emergencies", "ratings", "complaints"];
  for (const col of collections) {
    try {
      await mongoose.connection.collection(col).deleteMany({});
    } catch (_) { /* collection may not exist yet, that's fine */ }
  }

  console.log("🗑  Collections cleared");

  const hash = (p) => bcrypt.hash(p, 12);

  // Users
  const [admin, rider1, rider2, driverUser1, driverUser2] = await User.insertMany([
    { name: "Admin User", email: "admin@ridebook.com", password: await hash("admin123"), gender: "MALE", role: "ADMIN", isVerified: true },
    { name: "Priya Sharma", email: "priya@example.com", password: await hash("rider123"), gender: "FEMALE", role: "RIDER" },
    { name: "Rahul Gupta", email: "rahul@example.com", password: await hash("rider123"), gender: "MALE", role: "RIDER" },
    { name: "Arjun Singh", email: "arjun@example.com", password: await hash("driver123"), gender: "MALE", role: "DRIVER" },
    { name: "Sunita Verma", email: "sunita@example.com", password: await hash("driver123"), gender: "FEMALE", role: "DRIVER" },
  ]);

  // Drivers
  await Driver.insertMany([
    {
      userId: driverUser1._id,
      vehicle: { make: "Maruti", model: "Swift Dzire", year: 2022, color: "White", plateNumber: "DL01AB1234", cabType: "SEDAN" },
      licenseNumber: "DL-2020-0012345",
      rideMode: "HYBRID",
      tripType: "INTRACITY",
      genderPreference: "ANY",
      isVerified: true,
      isApproved: true,
      isOnline: true,
      currentLocation: { lat: 28.6315, lng: 77.2167 },
      rating: 4.8,
      totalRides: 120,
    },
    {
      userId: driverUser2._id,
      vehicle: { make: "Hyundai", model: "Creta", year: 2023, color: "Grey", plateNumber: "DL02CD5678", cabType: "SUV" },
      licenseNumber: "DL-2021-0067890",
      rideMode: "SHARED_ONLY",
      tripType: "BOTH",
      genderPreference: "FEMALE_ONLY",
      isVerified: true,
      isApproved: true,
      isOnline: false,
      currentLocation: { lat: 28.5706, lng: 77.1794 },
      rating: 4.6,
      totalRides: 85,
    },
  ]);

  console.log("✅ Seed complete!\n");
  console.log("📧 Credentials:");
  console.log("  Admin:  admin@ridebook.com  / admin123");
  console.log("  Rider1: priya@example.com   / rider123  (Female)");
  console.log("  Rider2: rahul@example.com   / rider123  (Male)");
  console.log("  Driver1: arjun@example.com  / driver123 (Sedan, Hybrid)");
  console.log("  Driver2: sunita@example.com / driver123 (SUV, Shared-only, Female-only)\n");

  await mongoose.disconnect();
};

seed().catch(console.error);