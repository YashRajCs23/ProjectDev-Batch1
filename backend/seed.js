// seed.js — Run: node seed.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
dotenv.config();

const URI = process.env.MONGO_URI || "mongodb://localhost:27017/ridebook";

const seed = async () => {
  await mongoose.connect(URI);

  const { default: User }   = await import("./models/User.model.js");
  const { default: Driver } = await import("./models/Driver.model.js");
  const { default: Ride }   = await import("./models/Ride.model.js");

  await User.deleteMany({});
  await Driver.deleteMany({});
  await Ride.deleteMany({});

  const cols = ["otps","payments","messages","emergencies","ratings","complaints"];
  for (const c of cols) {
    try { await mongoose.connection.collection(c).deleteMany({}); } catch (_) {}
  }
  console.log("🗑  Collections cleared");

  const hash = (p) => bcrypt.hash(p, 12);

  // ── Users ─────────────────────────────────────────────────
  const [admin, rider1, rider2, rider3, dU1, dU2, dU3] = await User.insertMany([
    { name: "Admin User",    email: "admin@ridebook.com",  password: await hash("admin123"),  gender: "MALE",   role: "ADMIN",  isVerified: true,
      trustedContacts: [{ name: "Emergency Contact", phone: "+91-9999999999", relationship: "Guardian" }] },
    { name: "Priya Sharma",  email: "priya@example.com",  password: await hash("rider123"),  gender: "FEMALE", role: "RIDER",
      trustedContacts: [{ name: "Ravi Sharma", phone: "+91-9876543210", relationship: "Parent" }] },
    { name: "Rahul Gupta",   email: "rahul@example.com",  password: await hash("rider123"),  gender: "MALE",   role: "RIDER",
      trustedContacts: [{ name: "Meena Gupta", phone: "+91-9876543211", relationship: "Spouse" }] },
    { name: "Yash Kumar",    email: "yash@example.com",   password: await hash("rider123"),  gender: "MALE",   role: "RIDER",
      trustedContacts: [{ name: "Mom", phone: "+91-9876543212", relationship: "Parent" }] },
    { name: "Arjun Singh",   email: "arjun@example.com",  password: await hash("driver123"), gender: "MALE",   role: "DRIVER",
      trustedContacts: [{ name: "Kavita Singh", phone: "+91-9876543213", relationship: "Spouse" }] },
    { name: "Sunita Verma",  email: "sunita@example.com", password: await hash("driver123"), gender: "FEMALE", role: "DRIVER",
      trustedContacts: [{ name: "Ramesh Verma", phone: "+91-9876543214", relationship: "Parent" }] },
    { name: "Manish Yadav",  email: "manish@example.com", password: await hash("driver123"), gender: "MALE",   role: "DRIVER",
      trustedContacts: [{ name: "Sita Yadav", phone: "+91-9876543215", relationship: "Spouse" }] },
  ]);

  // ── Drivers ───────────────────────────────────────────────
  const [driver1, driver2, driver3] = await Driver.insertMany([
    {
      userId: dU1._id,
      vehicle: { make: "Maruti", model: "Swift Dzire", year: 2022, color: "White", plateNumber: "UP80AB1234", cabType: "SEDAN" },
      licenseNumber: "UP80-2020-0012345", rideMode: "HYBRID", tripType: "INTRACITY",
      genderPreference: "ANY", isVerified: true, isApproved: true, isOnline: true,
      currentLocation: { lat: 27.5030, lng: 77.6737 }, // Mathura NH44 area
      rating: 4.8, totalRides: 120,
    },
    {
      userId: dU2._id,
      vehicle: { make: "Hyundai", model: "Creta", year: 2023, color: "Grey", plateNumber: "UP80CD5678", cabType: "SUV" },
      licenseNumber: "UP80-2021-0067890", rideMode: "SHARED_ONLY", tripType: "BOTH",
      genderPreference: "FEMALE_ONLY", isVerified: true, isApproved: true, isOnline: false,
      currentLocation: { lat: 27.4728, lng: 77.6798 },
      rating: 4.6, totalRides: 85,
    },
    {
      userId: dU3._id,
      vehicle: { make: "Maruti", model: "Ertiga", year: 2021, color: "Silver", plateNumber: "UP80EF9012", cabType: "SUV" },
      licenseNumber: "UP80-2019-0098765", rideMode: "HYBRID", tripType: "INTRACITY",
      genderPreference: "ANY", isVerified: true, isApproved: true, isOnline: true,
      currentLocation: { lat: 27.5680, lng: 77.6710 },
      rating: 4.7, totalRides: 203,
    },
  ]);

  // ── Sample Pools (Shared Rides) in Mathura/Vrindavan area ─
  const now  = new Date();
  const dep1 = new Date(now.getTime() + 30  * 60000); // 30 min from now
  const dep2 = new Date(now.getTime() + 60  * 60000); // 1 hr from now
  const dep3 = new Date(now.getTime() + 90  * 60000); // 1.5 hr from now
  const dep4 = new Date(now.getTime() + 120 * 60000); // 2 hrs from now
  const dep5 = new Date(now.getTime() + 180 * 60000); // 3 hrs from now

  await Ride.insertMany([
    // Pool 1: Mathura → Vrindavan (Arjun, SEDAN)
    {
      rideType: "SHARED", cabType: "SEDAN", status: "SEARCHING",
      pickup: { address: "Mathura Junction, Bharatpur-Mathura Road, Dholi Pyau, Mathura, UP", coordinates: { lat: 27.4728, lng: 77.6885 } },
      drop:   { address: "Banke Bihari Temple, Vrindavan, UP", coordinates: { lat: 27.5792, lng: 77.6944 } },
      distanceKm: 12.5, durationMin: 28, fareEstimate: 98,
      maxRiders: 3, availableSeats: 2, departureTime: dep1,
      genderPreference: "ANY",
      preferences: { smoking: false, pets: false, music: true, ac: true, luggage: true, chatty: true },
      driverId: driver1._id, riders: [],
      routeCoordinates: [
        { lat: 27.4728, lng: 77.6885 }, { lat: 27.5000, lng: 77.6900 },
        { lat: 27.5400, lng: 77.6920 }, { lat: 27.5792, lng: 77.6944 },
      ],
    },
    // Pool 2: Goverdhan → Mathura (Manish, SUV, Female-only)
    {
      rideType: "SHARED", cabType: "SUV", status: "SEARCHING",
      pickup: { address: "Goverdhan, Mathura District, UP", coordinates: { lat: 27.5000, lng: 77.4650 } },
      drop:   { address: "Mathura Bus Stand, Dampier Nagar, Mathura, UP", coordinates: { lat: 27.4934, lng: 77.6721 } },
      distanceKm: 22.3, durationMin: 38, fareEstimate: 136,
      maxRiders: 4, availableSeats: 3, departureTime: dep2,
      genderPreference: "FEMALE_ONLY",
      preferences: { smoking: false, pets: true, music: true, ac: true, luggage: true, chatty: false },
      driverId: driver3._id, riders: [],
      routeCoordinates: [
        { lat: 27.5000, lng: 77.4650 }, { lat: 27.4960, lng: 77.5400 },
        { lat: 27.4940, lng: 77.6100 }, { lat: 27.4934, lng: 77.6721 },
      ],
    },
    // Pool 3: Vrindavan → Agra (Arjun, SEDAN)
    {
      rideType: "SHARED", cabType: "SEDAN", status: "SEARCHING",
      pickup: { address: "ISKCON Temple, Vrindavan, UP", coordinates: { lat: 27.5826, lng: 77.6987 } },
      drop:   { address: "Agra Cantonment Railway Station, Agra, UP", coordinates: { lat: 27.1592, lng: 78.0022 } },
      distanceKm: 61.4, durationMin: 72, fareEstimate: 480,
      maxRiders: 3, availableSeats: 3, departureTime: dep3,
      genderPreference: "ANY",
      preferences: { smoking: false, pets: false, music: false, ac: true, luggage: true, chatty: false },
      driverId: driver1._id, riders: [],
      routeCoordinates: [
        { lat: 27.5826, lng: 77.6987 }, { lat: 27.4728, lng: 77.6885 },
        { lat: 27.3000, lng: 77.8000 }, { lat: 27.1592, lng: 78.0022 },
      ],
    },
    // Pool 4: Mathura → Delhi (Manish, SUV)
    {
      rideType: "SHARED", cabType: "SUV", status: "SEARCHING",
      pickup: { address: "Prem Mandir, Bhaktivedanta Swami Marg, Chhatikara, Mathura, UP", coordinates: { lat: 27.5681, lng: 77.6490 } },
      drop:   { address: "Connaught Place, New Delhi", coordinates: { lat: 28.6315, lng: 77.2167 } },
      distanceKm: 148.0, durationMin: 165, fareEstimate: 720,
      maxRiders: 4, availableSeats: 4, departureTime: dep4,
      genderPreference: "ANY",
      preferences: { smoking: false, pets: false, music: true, ac: true, luggage: true, chatty: true },
      driverId: driver3._id, riders: [],
      routeCoordinates: [
        { lat: 27.5681, lng: 77.6490 }, { lat: 27.8000, lng: 77.5500 },
        { lat: 28.2000, lng: 77.3800 }, { lat: 28.6315, lng: 77.2167 },
      ],
    },
    // Pool 5: Mathura → Bharatpur (Sunita, SUV, Female-only)
    {
      rideType: "SHARED", cabType: "SUV", status: "SEARCHING",
      pickup: { address: "Mathura Junction Railway Station, Mathura, UP", coordinates: { lat: 27.4728, lng: 77.6885 } },
      drop:   { address: "Bharatpur Railway Station, Rajasthan", coordinates: { lat: 27.2152, lng: 77.4900 } },
      distanceKm: 38.5, durationMin: 52, fareEstimate: 245,
      maxRiders: 3, availableSeats: 2, departureTime: dep5,
      genderPreference: "FEMALE_ONLY",
      preferences: { smoking: false, pets: false, music: true, ac: true, luggage: true, chatty: true },
      driverId: driver2._id,
      riders: [{ // One rider already joined
        riderId: rider1._id,
        pickup: { address: "Mathura Junction, UP", coordinates: { lat: 27.4728, lng: 77.6885 } },
        drop:   { address: "Bharatpur, Rajasthan", coordinates: { lat: 27.2152, lng: 77.4900 } },
        fare: 245, routeMatchPct: 100, status: "ACCEPTED",
      }],
      routeCoordinates: [
        { lat: 27.4728, lng: 77.6885 }, { lat: 27.3800, lng: 77.6100 },
        { lat: 27.2800, lng: 77.5600 }, { lat: 27.2152, lng: 77.4900 },
      ],
    },
  ]);

  console.log("✅ Seed complete!\n");
  console.log("📧 Login Credentials:");
  console.log("  Admin:   admin@ridebook.com  / admin123");
  console.log("  Rider1:  priya@example.com   / rider123  (Female)");
  console.log("  Rider2:  rahul@example.com   / rider123  (Male)");
  console.log("  Rider3:  yash@example.com    / rider123  (Male)");
  console.log("  Driver1: arjun@example.com   / driver123 (SEDAN, Mathura)");
  console.log("  Driver2: sunita@example.com  / driver123 (SUV, Female-only)");
  console.log("  Driver3: manish@example.com  / driver123 (SUV, Mathura→Delhi)\n");
  console.log("🚗 5 sample pools seeded in Mathura/Vrindavan/Agra area");

  await mongoose.disconnect();
};

seed().catch(console.error);
