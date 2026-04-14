import Driver from "../models/Driver.model.js";
import User from "../models/User.model.js";

// Register as driver (attach to user)
export const registerDriver = async (req, res) => {
  try {
    const exists = await Driver.findOne({ userId: req.user._id });
    if (exists) return res.status(409).json({ success: false, message: "Driver profile already exists." });

    const { vehicle, licenseNumber, rideMode, tripType, genderPreference } = req.body;
    if (!vehicle || !licenseNumber)
      return res.status(400).json({ success: false, message: "Vehicle and license required." });

    const driver = await Driver.create({
      userId: req.user._id,
      vehicle,
      licenseNumber,
      rideMode: rideMode || "HYBRID",
      tripType: tripType || "INTRACITY",
      genderPreference: genderPreference || "ANY",
    });

    // Update user role
    await User.findByIdAndUpdate(req.user._id, { role: "DRIVER" });

    res.status(201).json({ success: true, message: "Driver registered. Awaiting admin approval.", driver });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const getMyDriver = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return res.status(404).json({ success: false, message: "Driver profile not found." });
    res.json({ success: true, driver });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const updateDriver = async (req, res) => {
  try {
    const allowed = ["rideMode", "tripType", "genderPreference", "vehicle"];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const driver = await Driver.findOneAndUpdate({ userId: req.user._id }, updates, { new: true });
    res.json({ success: true, driver });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const toggleOnline = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return res.status(404).json({ success: false, message: "Driver profile not found." });
    if (!driver.isApproved)
      return res.status(403).json({ success: false, message: "Not approved by admin yet." });

    driver.isOnline = !driver.isOnline;
    await driver.save();

    // Broadcast online status via socket
    req.io?.emit("driverStatusChanged", { driverId: driver._id, isOnline: driver.isOnline });

    res.json({ success: true, isOnline: driver.isOnline, message: `You are now ${driver.isOnline ? "Online 🟢" : "Offline 🔴"}` });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const driver = await Driver.findOneAndUpdate(
      { userId: req.user._id },
      { currentLocation: { lat, lng, updatedAt: new Date() } },
      { new: true }
    );
    // Broadcast to riders tracking this driver
    if (driver?.currentRideId) {
      req.io?.to(`ride_${driver.currentRideId}`).emit("driverLocationUpdate", { lat, lng, driverId: driver._id });
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const getNearbyDrivers = async (req, res) => {
  try {
    const { lat, lng, cabType, rideType } = req.query;
    const filter = { isOnline: true, isApproved: true, isBlocked: false };
    if (cabType) filter["vehicle.cabType"] = cabType;
    if (rideType === "SHARED") {
      filter.rideMode = { $in: ["SHARED_ONLY", "HYBRID"] };
    } else if (rideType === "PRIVATE") {
      filter.rideMode = { $in: ["PRIVATE_ONLY", "HYBRID"] };
    }

    const drivers = await Driver.find(filter).populate("userId", "name gender rating");

    // Filter by rough proximity (within ~10km using simple lat/lng diff)
    const nearby = drivers.filter((d) => {
      if (!d.currentLocation?.lat) return true; // include if no location set
      const dLat = Math.abs(d.currentLocation.lat - parseFloat(lat || 0));
      const dLng = Math.abs(d.currentLocation.lng - parseFloat(lng || 0));
      return dLat < 0.15 && dLng < 0.15; // ~10km
    });

    res.json({ success: true, drivers: nearby });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
