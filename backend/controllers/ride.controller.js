// controllers/ride.controller.js
import Ride from "../models/Ride.model.js";
import Driver from "../models/Driver.model.js";
import { getRoute } from "../services/geoapify.service.js";
import { calculateFare } from "../config/pricing.js";
import { calcMatchScore } from "../services/matching.service.js";

// ── Fare estimate ──────────────────────────────────────────
export const estimateFare = async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng, cabType, rideType } = req.query;
    if (!fromLat || !fromLng || !toLat || !toLng || !cabType)
      return res.status(400).json({ success: false, message: "Missing parameters." });

    const route = await getRoute(parseFloat(fromLat), parseFloat(fromLng), parseFloat(toLat), parseFloat(toLng));
    const surge = parseFloat(process.env.SURGE_MULTIPLIER) || 1.0;
    const fare = calculateFare(cabType, route.distanceKm, route.durationMin, rideType === "SHARED", surge);
    res.json({ success: true, distanceKm: route.distanceKm, durationMin: route.durationMin, fare, surgeMultiplier: surge, polyline: route.polyline });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Create (book) a ride ───────────────────────────────────
export const createRide = async (req, res) => {
  try {
    const { pickupAddress, pickupLat, pickupLng, dropAddress, dropLat, dropLng, cabType, rideType, tripType, genderPreference, paymentMethod } = req.body;

    if (!pickupLat || !pickupLng || !dropLat || !dropLng)
      return res.status(400).json({ success: false, message: "Coordinates required." });
    if (!cabType)
      return res.status(400).json({ success: false, message: "Cab type required." });

    const route = await getRoute(parseFloat(pickupLat), parseFloat(pickupLng), parseFloat(dropLat), parseFloat(dropLng));
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
      departureTime: new Date(),
      maxRiders: isShared ? 3 : 1,
      riders: [{
        riderId: req.user._id,
        pickup: { address: pickupAddress, coordinates: { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) } },
        drop: { address: dropAddress, coordinates: { lat: parseFloat(dropLat), lng: parseFloat(dropLng) } },
        fare, routeMatchPct: 100, status: "PENDING",
      }],
    });

    // ── Broadcast to ALL connected sockets ────────────────
    const payload = {
      rideId: String(ride._id),
      cabType,
      rideType: rideType || "PRIVATE",
      pickup: { address: pickupAddress, lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) },
      fare,
      genderPreference: genderPreference || "ANY",
      distanceKm: route.distanceKm,
    };

    if (req.io) {
      const count = req.io.sockets.size;
      console.log(`\n📢 newRideAvailable → ${count} socket(s) | ${cabType} ₹${fare}`);
      req.io.emit("newRideAvailable", payload);
    } else {
      console.error("❌ req.io undefined — socket broadcast failed");
    }

    res.status(201).json({ success: true, ride });
  } catch (e) {
    console.error("createRide error:", e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── Driver accepts a ride ──────────────────────────────────
export const acceptRide = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver?.isApproved) return res.status(403).json({ success: false, message: "Not approved by admin." });
    if (driver.currentRideId) return res.status(400).json({ success: false, message: "Already on a ride." });

    const ride = await Ride.findById(req.params.id);
    if (!ride || ride.status !== "SEARCHING")
      return res.status(400).json({ success: false, message: "Ride not available." });

    ride.driverId = driver._id;
    ride.status = "ACCEPTED";
    await ride.save();
    driver.currentRideId = ride._id;
    await driver.save();

    req.io?.to(`ride_${ride._id}`).emit("rideAccepted", { rideId: ride._id, driverId: driver._id, driver: { name: req.user.name, rating: driver.rating, vehicle: driver.vehicle } });
    req.io?.emit("rideUnavailable", { rideId: String(ride._id) });
    res.json({ success: true, ride });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Update ride status ─────────────────────────────────────
export const updateRideStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return res.status(404).json({ success: false, message: "Driver not found." });
    const ride = await Ride.findOne({ _id: req.params.id, driverId: driver._id });
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found." });

    ride.status = status;
    if (status === "COMPLETED") {
      driver.currentRideId = null; driver.totalRides += 1; driver.totalEarnings += ride.fareEstimate;
      await driver.save();
      ride.riders.forEach(r => { if (r.status === "ONBOARD") r.status = "DROPPED"; });
    }
    if (status === "ONGOING") ride.riders.forEach(r => { if (r.status === "ACCEPTED") r.status = "ONBOARD"; });
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

    const isRider = ride.riders.some(r => String(r.riderId) === String(req.user._id));
    const driver = req.user.role === "DRIVER" ? await Driver.findOne({ userId: req.user._id }) : null;
    const isDriver = driver && String(ride.driverId) === String(driver._id);
    if (!isRider && !isDriver) return res.status(403).json({ success: false, message: "Unauthorized." });

    ride.status = "CANCELLED";
    ride.cancelledBy = isDriver ? "DRIVER" : "RIDER";
    ride.cancelReason = reason || "";
    await ride.save();
    if (ride.driverId) await Driver.findByIdAndUpdate(ride.driverId, { currentRideId: null });
    req.io?.to(`ride_${ride._id}`).emit("rideCancelled", { rideId: ride._id, by: ride.cancelledBy });
    res.json({ success: true, ride });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Shared rides matching ──────────────────────────────────
export const getSharedRides = async (req, res) => {
  try {
    const { lat, lng, dropLat, dropLng, cabType, genderPref } = req.query;
    const filter = { rideType: "SHARED", status: "SEARCHING" };
    if (cabType) filter.cabType = cabType;
    if (genderPref && genderPref !== "ANY") filter.genderPreference = { $in: [genderPref, "ANY"] };
    let rides = await Ride.find(filter).populate("driverId").lean();
    rides = rides.filter(r => r.riders.filter(x => ["PENDING","ACCEPTED","ONBOARD"].includes(x.status)).length < r.maxRiders);
    if (lat && lng && dropLat && dropLng) {
      rides = rides.map(ride => {
        const match = calcMatchScore({ ride, riderPickup: { lat: parseFloat(lat), lng: parseFloat(lng) }, riderDrop: { lat: parseFloat(dropLat), lng: parseFloat(dropLng) }, requestedTime: new Date(), riderGender: req.user?.gender });
        return { ...ride, matchScore: match };
      }).filter(r => !r.matchScore?.disqualified).sort((a, b) => (b.matchScore?.score || 0) - (a.matchScore?.score || 0));
    }
    res.json({ success: true, rides });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Join shared ride ───────────────────────────────────────
export const joinSharedRide = async (req, res) => {
  try {
    const { pickupAddress, pickupLat, pickupLng, dropAddress, dropLat, dropLng } = req.body;
    const ride = await Ride.findById(req.params.id);
    if (!ride || ride.rideType !== "SHARED") return res.status(400).json({ success: false, message: "Not a shared ride." });
    if (ride.riders.filter(r => ["PENDING","ACCEPTED","ONBOARD"].includes(r.status)).length >= ride.maxRiders)
      return res.status(400).json({ success: false, message: "Ride is full." });

    const route = await getRoute(parseFloat(pickupLat), parseFloat(pickupLng), parseFloat(dropLat), parseFloat(dropLng));
    const fare = calculateFare(ride.cabType, route.distanceKm, route.durationMin, true);
    const matchPct = calcMatchScore({ ride, riderPickup: { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) }, riderDrop: { lat: parseFloat(dropLat), lng: parseFloat(dropLng) }, requestedTime: new Date(), riderGender: req.user.gender }).routeMatch || 85;
    ride.riders.push({ riderId: req.user._id, pickup: { address: pickupAddress, coordinates: { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) } }, drop: { address: dropAddress, coordinates: { lat: parseFloat(dropLat), lng: parseFloat(dropLng) } }, fare, routeMatchPct: matchPct, status: "PENDING" });
    await ride.save();
    req.io?.to(`ride_${ride._id}`).emit("newPassengerJoined", { rideId: ride._id });
    res.json({ success: true, ride, fare, matchPct });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const getRideById = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id).populate({ path: "driverId", populate: { path: "userId", select: "name gender rating phone" } });
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found." });
    res.json({ success: true, ride });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const getMyRides = async (req, res) => {
  try {
    const rides = await Ride.find({ "riders.riderId": req.user._id }).populate({ path: "driverId", populate: { path: "userId", select: "name gender rating" } }).sort({ createdAt: -1 });
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
    const { text, lat, lng } = req.query;
    const { autocomplete } = await import("../services/geoapify.service.js");
    const results = await autocomplete(text, lat, lng);
    res.json({ success: true, results });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Generate start OTP (when driver arrives) ──────────────
export const generateStartOtp = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    const ride = await Ride.findOne({ _id: req.params.id, driverId: driver?._id });
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found." });
    if (ride.status !== "ARRIVING") return res.status(400).json({ success: false, message: "Driver must be arriving to generate OTP." });

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    ride.startOtp = otp;
    await ride.save();

    // Send OTP to rider via socket
    req.io?.to(`ride_${ride._id}`).emit("startOtpGenerated", { otp });

    res.json({ success: true, otp, message: "Show this OTP to the rider" });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Verify start OTP (driver submits OTP from rider) ──────
export const verifyStartOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const driver = await Driver.findOne({ userId: req.user._id });
    const ride = await Ride.findOne({ _id: req.params.id, driverId: driver?._id });
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found." });
    if (ride.startOtp !== otp) return res.status(400).json({ success: false, message: "Wrong OTP. Ask rider again." });

    ride.status = "ONGOING";
    ride.startOtpVerified = true;
    ride.riders.forEach(r => { if (r.status === "ACCEPTED") r.status = "ONBOARD"; });
    await ride.save();

    req.io?.to(`ride_${ride._id}`).emit("rideStatusUpdate", { rideId: ride._id, status: "ONGOING" });
    res.json({ success: true, message: "OTP verified. Ride started!" });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Change destination mid-ride ───────────────────────────
export const changeDestination = async (req, res) => {
  try {
    const { dropAddress, dropLat, dropLng } = req.body;
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found." });
    if (ride.status !== "ONGOING") return res.status(400).json({ success: false, message: "Can only change destination during an ongoing ride." });

    const isRider = ride.riders.some(r => String(r.riderId) === String(req.user._id));
    if (!isRider) return res.status(403).json({ success: false, message: "Unauthorized." });

    // Recalculate route and fare
    const { getRoute } = await import("../services/geoapify.service.js");
    const { calculateFare } = await import("../config/pricing.js");

    const route = await getRoute(ride.pickup.coordinates.lat, ride.pickup.coordinates.lng, parseFloat(dropLat), parseFloat(dropLng));
    const newFare = calculateFare(ride.cabType, route.distanceKm, route.durationMin, ride.rideType === "SHARED");

    const oldFare = ride.fareEstimate;
    ride.drop = { address: dropAddress, coordinates: { lat: parseFloat(dropLat), lng: parseFloat(dropLng) } };
    ride.distanceKm = route.distanceKm;
    ride.durationMin = route.durationMin;
    ride.fareEstimate = newFare;
    ride.routeCoordinates = route.polyline;
    await ride.save();

    req.io?.to(`ride_${ride._id}`).emit("destinationChanged", {
      rideId: ride._id,
      newDrop: { address: dropAddress, lat: parseFloat(dropLat), lng: parseFloat(dropLng) },
      newFare, oldFare, distanceKm: route.distanceKm,
    });

    res.json({ success: true, newFare, distanceKm: route.distanceKm, polyline: route.polyline });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── POOL: Driver creates a scheduled shared ride ──────────
export const createPool = async (req, res) => {
  try {
    const {
      pickupAddress, pickupLat, pickupLng,
      dropAddress, dropLat, dropLng,
      cabType, departureTime, availableSeats,
      genderPreference, paymentMethod,
      preferences, // { smoking, pets, music, ac, luggage, chatty }
    } = req.body;

    if (!pickupLat || !dropLat) return res.status(400).json({ success: false, message: "Coordinates required." });
    if (!departureTime) return res.status(400).json({ success: false, message: "Departure time required." });

    // Get driver profile
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver?.isApproved) return res.status(403).json({ success: false, message: "Driver not approved." });

    const route = await getRoute(parseFloat(pickupLat), parseFloat(pickupLng), parseFloat(dropLat), parseFloat(dropLng));
    const seats = Math.min(parseInt(availableSeats) || 2, 6);
    // Pool fare is shared — each seat pays less
    const farePerSeat = Math.round(calculateFare(cabType || driver.vehicle?.cabType, route.distanceKm, route.durationMin, true));

    const pool = await Ride.create({
      rideType: "SHARED",
      cabType: cabType || driver.vehicle?.cabType || "SEDAN",
      pickup: { address: pickupAddress, coordinates: { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) } },
      drop:   { address: dropAddress,   coordinates: { lat: parseFloat(dropLat),   lng: parseFloat(dropLng) } },
      routeCoordinates: route.polyline,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      fareEstimate: farePerSeat,
      maxRiders: seats,
      availableSeats: seats,
      departureTime: new Date(departureTime),
      genderPreference: genderPreference || "ANY",
      paymentMethod: paymentMethod || "CASH",
      preferences: preferences || {},
      driverId: driver._id,
      status: "SEARCHING",
      riders: [],
    });

    // Broadcast to all sockets so riders can find it
    req.io?.emit("newPoolAvailable", {
      poolId: pool._id,
      cabType: pool.cabType,
      pickup: pool.pickup,
      drop: pool.drop,
      farePerSeat,
      availableSeats: seats,
      departureTime: pool.departureTime,
      preferences: pool.preferences,
      genderPreference: pool.genderPreference,
    });

    res.status(201).json({ success: true, pool });
  } catch (e) {
    console.error("createPool error:", e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── POOL: Rider sends join request ────────────────────────
export const requestToJoin = async (req, res) => {
  try {
    const { pickupAddress, pickupLat, pickupLng, dropAddress, dropLat, dropLng, message } = req.body;
    const ride = await Ride.findById(req.params.id);
    if (!ride || ride.rideType !== "SHARED") return res.status(404).json({ success: false, message: "Pool not found." });
    if (ride.status !== "SEARCHING") return res.status(400).json({ success: false, message: "This pool is no longer accepting requests." });
    if (ride.availableSeats <= 0) return res.status(400).json({ success: false, message: "Pool is full." });

    // Check not already requested
    const existing = ride.joinRequests.find(r => String(r.riderId) === String(req.user._id));
    if (existing) return res.status(400).json({ success: false, message: existing.status === "PENDING" ? "Request already sent." : `Request was ${existing.status.toLowerCase()}.` });

    // Calculate route match
    const { calcMatchScore } = await import("../services/matching.service.js");
    const matchResult = calcMatchScore({
      ride,
      riderPickup: { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) },
      riderDrop:   { lat: parseFloat(dropLat),   lng: parseFloat(dropLng) },
      requestedTime: new Date(),
      riderGender: req.user.gender,
    });

    if (matchResult.disqualified) return res.status(400).json({ success: false, message: "This pool doesn't match your preferences." });

    const route = await getRoute(parseFloat(pickupLat), parseFloat(pickupLng), parseFloat(dropLat), parseFloat(dropLng));
    const fare = calculateFare(ride.cabType, route.distanceKm, route.durationMin, true);

    ride.joinRequests.push({
      riderId: req.user._id,
      riderName: req.user.name,
      pickupAddress, pickupLat: parseFloat(pickupLat), pickupLng: parseFloat(pickupLng),
      dropAddress, dropLat: parseFloat(dropLat), dropLng: parseFloat(dropLng),
      routeMatchPct: matchResult.routeMatch,
      fare,
      message: message || "",
    });
    await ride.save();

    // Notify driver
    req.io?.to(`ride_${ride._id}`).emit("joinRequestReceived", {
      rideId: ride._id,
      rider: { name: req.user.name, id: req.user._id },
      routeMatchPct: matchResult.routeMatch,
      fare,
    });

    res.json({ success: true, message: "Join request sent! Waiting for driver approval.", routeMatchPct: matchResult.routeMatch, fare });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── POOL: Driver approves/rejects join request ────────────
export const respondToJoinRequest = async (req, res) => {
  try {
    const { requestId, action } = req.body; // action: "APPROVED" | "REJECTED"
    const driver = await Driver.findOne({ userId: req.user._id });
    const ride = await Ride.findOne({ _id: req.params.id, driverId: driver?._id });
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found." });

    const request = ride.joinRequests.id(requestId);
    if (!request) return res.status(404).json({ success: false, message: "Request not found." });
    if (request.status !== "PENDING") return res.status(400).json({ success: false, message: "Request already handled." });

    request.status = action;

    if (action === "APPROVED") {
      if (ride.availableSeats <= 0) return res.status(400).json({ success: false, message: "Pool is full." });
      ride.riders.push({
        riderId: request.riderId,
        pickup: { address: request.pickupAddress, coordinates: { lat: request.pickupLat, lng: request.pickupLng } },
        drop:   { address: request.dropAddress,   coordinates: { lat: request.dropLat,   lng: request.dropLng } },
        fare: request.fare,
        routeMatchPct: request.routeMatchPct,
        status: "ACCEPTED",
      });
      ride.availableSeats = Math.max(0, ride.availableSeats - 1);
    }

    await ride.save();

    // Notify the rider who requested
    req.io?.emit(`joinResponse_${request.riderId}`, {
      rideId: ride._id,
      action,
      ride: action === "APPROVED" ? { pickup: ride.pickup, drop: ride.drop, fare: request.fare, departureTime: ride.departureTime } : null,
    });

    res.json({ success: true, action, availableSeats: ride.availableSeats });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── POOL: Search available pools ──────────────────────────
export const searchPools = async (req, res) => {
  try {
    const { lat, lng, dropLat, dropLng, date, smoking, pets, music, gender } = req.query;

    const query = {
      rideType: "SHARED",
      status: "SEARCHING",
      availableSeats: { $gt: 0 },
    };

    // Date filter (within same day if provided)
    if (date) {
      const d = new Date(date);
      query.departureTime = {
        $gte: new Date(d.setHours(0, 0, 0, 0)),
        $lt:  new Date(d.setHours(23, 59, 59, 999)),
      };
    } else {
      // Default: show rides from now onwards
      query.departureTime = { $gte: new Date(Date.now() - 15 * 60000) }; // 15 min grace
    }

    // Preference filters
    if (smoking === "true")  query["preferences.smoking"] = true;
    if (pets === "true")     query["preferences.pets"] = true;
    if (music === "true")    query["preferences.music"] = true;
    if (gender && gender !== "ANY") query.genderPreference = { $in: [gender, "ANY"] };

    let pools = await Ride.find(query)
      .populate({ path: "driverId", populate: { path: "userId", select: "name gender rating" } })
      .sort({ departureTime: 1 })
      .limit(30)
      .lean();

    // Calculate route match for each pool
    if (lat && lng && dropLat && dropLng) {
      const { calcMatchScore } = await import("../services/matching.service.js");
      pools = pools.map(pool => {
        const match = calcMatchScore({
          ride: pool,
          riderPickup: { lat: parseFloat(lat), lng: parseFloat(lng) },
          riderDrop:   { lat: parseFloat(dropLat), lng: parseFloat(dropLng) },
          requestedTime: new Date(),
          riderGender: req.user?.gender,
        });
        return { ...pool, matchScore: match };
      })
      .filter(p => !p.matchScore?.disqualified && p.matchScore?.routeMatch >= 30)
      .sort((a, b) => (b.matchScore?.score || 0) - (a.matchScore?.score || 0));
    }

    res.json({ success: true, pools });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
