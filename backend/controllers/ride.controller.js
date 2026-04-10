// controllers/ride.controller.js
import Ride from "../models/Ride.model.js";
import Driver from "../models/Driver.model.js";
import { getRoute } from "../services/geoapify.service.js";
import { calculateFare } from "../config/pricing.js";
import { calcMatchScore } from "../services/matching.service.js";

// ── Get fare estimate ──────────────────────────────────────
export const estimateFare = async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng, cabType, rideType } = req.query;
    if (!fromLat || !fromLng || !toLat || !toLng || !cabType)
      return res.status(400).json({ success: false, message: "Missing parameters." });

    const route = await getRoute(parseFloat(fromLat), parseFloat(fromLng), parseFloat(toLat), parseFloat(toLng));
    const surge = parseFloat(process.env.SURGE_MULTIPLIER) || 1.0;
    const isShared = rideType === "SHARED";
    const fare = calculateFare(cabType, route.distanceKm, route.durationMin, isShared, surge);

    res.json({
      success: true,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      fare,
      surgeMultiplier: surge,
      polyline: route.polyline,
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Create (book) a ride ───────────────────────────────────
export const createRide = async (req, res) => {
  try {
    const {
      pickupAddress, pickupLat, pickupLng,
      dropAddress, dropLat, dropLng,
      cabType, rideType, tripType,
      genderPreference, paymentMethod,
      departureTime,
    } = req.body;

    // Get route data
    const route = await getRoute(
      parseFloat(pickupLat), parseFloat(pickupLng),
      parseFloat(dropLat), parseFloat(dropLng)
    );

    const surge = parseFloat(process.env.SURGE_MULTIPLIER) || 1.0;
    const isShared = rideType === "SHARED";
    const fare = calculateFare(cabType, route.distanceKm, route.durationMin, isShared, surge);

    const ride = await Ride.create({
      rideType: rideType || "PRIVATE",
      cabType,
      tripType: tripType || "INTRACITY",
      pickup: { address: pickupAddress, coordinates: { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) } },
      drop: { address: dropAddress, coordinates: { lat: parseFloat(dropLat), lng: parseFloat(dropLng) } },
      routeCoordinates: route.polyline,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      fareEstimate: fare,
      surgeMultiplier: surge,
      genderPreference: genderPreference || "ANY",
      paymentMethod: paymentMethod || "CASH",
      departureTime: departureTime ? new Date(departureTime) : new Date(),
      maxRiders: isShared ? 3 : 1,
      riders: [{
        riderId: req.user._id,
        pickup: { address: pickupAddress, coordinates: { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) } },
        drop: { address: dropAddress, coordinates: { lat: parseFloat(dropLat), lng: parseFloat(dropLng) } },
        fare,
        routeMatchPct: 100,
        status: "PENDING",
      }],
    });

    // Notify nearby drivers via socket
    req.io?.emit("newRideRequest", {
      rideId: ride._id,
      cabType,
      rideType,
      pickup: { address: pickupAddress, lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) },
      fare,
      genderPreference,
    });

    res.status(201).json({ success: true, ride });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Driver accepts a ride ──────────────────────────────────
export const acceptRide = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver?.isApproved) return res.status(403).json({ success: false, message: "Not approved." });
    if (driver.currentRideId) return res.status(400).json({ success: false, message: "Already on a ride." });

    const ride = await Ride.findById(req.params.id);
    if (!ride || ride.status !== "SEARCHING")
      return res.status(400).json({ success: false, message: "Ride not available." });

    // Gender check
    if (ride.genderPreference !== "ANY") {
      const driverUser = await (await import("../models/User.model.js")).default.findById(req.user._id);
      if (ride.genderPreference === "MALE_ONLY" && driverUser.gender !== "MALE")
        return res.status(403).json({ success: false, message: "Ride requires male driver." });
      if (ride.genderPreference === "FEMALE_ONLY" && driverUser.gender !== "FEMALE")
        return res.status(403).json({ success: false, message: "Ride requires female driver." });
    }

    ride.driverId = driver._id;
    ride.status = "ACCEPTED";
    await ride.save();

    driver.currentRideId = ride._id;
    await driver.save();

    // Notify riders
    req.io?.to(`ride_${ride._id}`).emit("rideAccepted", {
      rideId: ride._id,
      driverId: driver._id,
      driver: { name: req.user.name, rating: driver.rating, vehicle: driver.vehicle },
    });

    res.json({ success: true, ride });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Update ride status ─────────────────────────────────────
export const updateRideStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["ARRIVING", "ONGOING", "COMPLETED", "CANCELLED"];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: "Invalid status." });

    const driver = await Driver.findOne({ userId: req.user._id });
    const ride = await Ride.findOne({ _id: req.params.id, driverId: driver?._id });
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found." });

    ride.status = status;
    if (status === "COMPLETED") {
      driver.currentRideId = null;
      driver.totalRides += 1;
      driver.totalEarnings += ride.fareEstimate;
      await driver.save();

      // Update all riders to DROPPED
      ride.riders.forEach((r) => { if (r.status === "ONBOARD") r.status = "DROPPED"; });
    }
    if (status === "ONGOING") {
      ride.riders.forEach((r) => { if (r.status === "ACCEPTED") r.status = "ONBOARD"; });
    }

    await ride.save();
    req.io?.to(`ride_${ride._id}`).emit("rideStatusUpdate", { rideId: ride._id, status });

    res.json({ success: true, ride });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Cancel ride ────────────────────────────────────────────
export const cancelRide = async (req, res) => {
  try {
    const { reason } = req.body;
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found." });

    const isRider = ride.riders.some((r) => String(r.riderId) === String(req.user._id));
    const isDriver = req.user.role === "DRIVER";

    if (!isRider && !isDriver)
      return res.status(403).json({ success: false, message: "Unauthorized." });

    if (!["SEARCHING", "ACCEPTED", "ARRIVING"].includes(ride.status))
      return res.status(400).json({ success: false, message: "Cannot cancel at this stage." });

    ride.status = "CANCELLED";
    ride.cancelledBy = isDriver ? "DRIVER" : "RIDER";
    ride.cancelReason = reason || "";

    // Cancellation fee if driver already accepted
    if (isRider && ride.status === "ARRIVING") {
      ride.cancellationFee = 30; // ₹30 fee
    }

    await ride.save();

    // Free up driver
    if (ride.driverId) {
      await Driver.findByIdAndUpdate(ride.driverId, { currentRideId: null });
    }

    req.io?.to(`ride_${ride._id}`).emit("rideCancelled", { rideId: ride._id, by: ride.cancelledBy });

    res.json({ success: true, ride });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Get available shared rides (for matching) ──────────────
export const getSharedRides = async (req, res) => {
  try {
    const { lat, lng, dropLat, dropLng, cabType, genderPref } = req.query;
    const filter = {
      rideType: "SHARED",
      status: "SEARCHING",
      cabType,
    };
    if (genderPref && genderPref !== "ANY") filter.genderPreference = { $in: [genderPref, "ANY"] };

    let rides = await Ride.find(filter)
      .populate("driverId")
      .lean();

    // Filter rides that have room
    rides = rides.filter((r) => {
      const accepted = r.riders.filter((x) => ["PENDING", "ACCEPTED", "ONBOARD"].includes(x.status)).length;
      return accepted < r.maxRiders;
    });

    // Apply matching score
    rides = rides.map((ride) => {
      const match = calcMatchScore({
        ride,
        riderPickup: { lat: parseFloat(lat), lng: parseFloat(lng) },
        riderDrop: { lat: parseFloat(dropLat), lng: parseFloat(dropLng) },
        requestedTime: new Date(),
        riderGender: req.user.gender,
      });
      return { ...ride, matchScore: match };
    })
    .filter((r) => !r.matchScore.disqualified)
    .sort((a, b) => b.matchScore.score - a.matchScore.score);

    res.json({ success: true, rides });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Join existing shared ride ──────────────────────────────
export const joinSharedRide = async (req, res) => {
  try {
    const { pickupAddress, pickupLat, pickupLng, dropAddress, dropLat, dropLng } = req.body;
    const ride = await Ride.findById(req.params.id);
    if (!ride || ride.rideType !== "SHARED")
      return res.status(400).json({ success: false, message: "Not a shared ride." });

    const activeRiders = ride.riders.filter((r) => ["PENDING", "ACCEPTED", "ONBOARD"].includes(r.status));
    if (activeRiders.length >= ride.maxRiders)
      return res.status(400).json({ success: false, message: "Ride is full." });

    // Gender check
    if (ride.genderPreference === "MALE_ONLY" && req.user.gender !== "MALE")
      return res.status(403).json({ success: false, message: "This ride is for male passengers only." });
    if (ride.genderPreference === "FEMALE_ONLY" && req.user.gender !== "FEMALE")
      return res.status(403).json({ success: false, message: "This ride is for female passengers only." });

    const route = await getRoute(
      parseFloat(pickupLat), parseFloat(pickupLng),
      parseFloat(dropLat), parseFloat(dropLng)
    );
    const fare = calculateFare(ride.cabType, route.distanceKm, route.durationMin, true);
    const matchPct = calcMatchScore({
      ride, riderPickup: { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) },
      riderDrop: { lat: parseFloat(dropLat), lng: parseFloat(dropLng) },
      requestedTime: new Date(), riderGender: req.user.gender,
    }).routeMatch;

    ride.riders.push({
      riderId: req.user._id,
      pickup: { address: pickupAddress, coordinates: { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) } },
      drop: { address: dropAddress, coordinates: { lat: parseFloat(dropLat), lng: parseFloat(dropLng) } },
      fare, routeMatchPct: matchPct, status: "PENDING",
    });
    await ride.save();

    req.io?.to(`ride_${ride._id}`).emit("newPassengerJoined", { rideId: ride._id, riderId: req.user._id });
    res.json({ success: true, ride, fare, matchPct });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const getRideById = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate({ path: "driverId", populate: { path: "userId", select: "name gender rating" } });
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found." });
    res.json({ success: true, ride });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const getMyRides = async (req, res) => {
  try {
    const rides = await Ride.find({ "riders.riderId": req.user._id })
      .populate({ path: "driverId", populate: { path: "userId", select: "name gender rating" } })
      .sort({ createdAt: -1 });
    res.json({ success: true, rides });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const getDriverRides = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return res.status(404).json({ success: false, message: "Driver not found." });
    const rides = await Ride.find({ driverId: driver._id }).sort({ createdAt: -1 });
    res.json({ success: true, rides });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const geocodeProxy = async (req, res) => {
  try {
    const { text } = req.query;
    const { autocomplete } = await import("../services/geoapify.service.js");
    const results = await autocomplete(text);
    res.json({ success: true, results });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
