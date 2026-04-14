import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import Driver from "../models/Driver.model.js";
import { Message } from "../models/index.models.js";

const authSocket = async (socket) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return null;
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    return await User.findById(userId);
  } catch { return null; }
};

const initSocketHandlers = (io) => {
  io.on("connection", async (socket) => {
    const user = await authSocket(socket);
    if (!user) { socket.disconnect(); return; }

    console.log(`🔌 ${user.name} (${user.role}) [${socket.id}]`);
    socket.userId = String(user._id);
    socket.userRole = user.role;

    // Auto-rejoin online room if driver was online
    if (user.role === "DRIVER") {
      const driver = await Driver.findOne({ userId: user._id });
      if (driver?.isOnline && driver?.isApproved) {
        socket.join("drivers_online");
        console.log(`  ↳ ${user.name} auto-joined drivers_online`);
      }
    }

    // ── Ride room ─────────────────────────────────────────
    socket.on("joinRide", ({ rideId }) => {
      socket.join(`ride_${rideId}`);
      console.log(`  ${user.name} → ride_${rideId}`);
    });
    socket.on("leaveRide", ({ rideId }) => socket.leave(`ride_${rideId}`));

    // ── Driver online/offline ─────────────────────────────
    socket.on("goOnline", async () => {
      if (user.role !== "DRIVER") return;
      socket.join("drivers_online");
      const driver = await Driver.findOne({ userId: user._id });
      console.log(`  🟢 ${user.name} ONLINE`);
      io.emit("driverStatusChanged", { driverId: driver?._id, isOnline: true });
    });

    socket.on("goOffline", async () => {
      if (user.role !== "DRIVER") return;
      socket.leave("drivers_online");
      const driver = await Driver.findOne({ userId: user._id });
      console.log(`  🔴 ${user.name} OFFLINE`);
      io.emit("driverStatusChanged", { driverId: driver?._id, isOnline: false });
    });

    // ── Rider searching ───────────────────────────────────
    socket.on("riderSearching", (data) => {
      io.to("drivers_online").emit("newRideAvailable", { ...data, timestamp: new Date().toISOString() });
    });

    // ── Driver GPS ────────────────────────────────────────
    socket.on("driverLocation", async ({ rideId, lat, lng }) => {
      if (user.role !== "DRIVER") return;
      Driver.findOneAndUpdate({ userId: user._id }, { currentLocation: { lat, lng, updatedAt: new Date() } }).catch(() => {});
      if (rideId) socket.to(`ride_${rideId}`).emit("driverLocationUpdate", { lat, lng });
    });

    // ── Chat ──────────────────────────────────────────────
    socket.on("sendMessage", async ({ rideId, message }) => {
      if (!message?.trim() || !rideId) return;
      try {
        const msg = await Message.create({
          rideId, senderId: user._id,
          senderRole: user.role === "DRIVER" ? "DRIVER" : "RIDER",
          message: message.trim(),
        });
        let name = user.name;
        if (user.nameVisibility === "FIRST_NAME") name = name.split(" ")[0];
        if (user.nameVisibility === "INITIALS") name = name.split(" ").map(n => n[0] + ".").join(" ");
        io.to(`ride_${rideId}`).emit("receiveMessage", {
          _id: msg._id, rideId,
          senderId: { _id: user._id, name },
          senderRole: msg.senderRole,
          message: msg.message,
          createdAt: msg.createdAt,
        });
      } catch (e) { socket.emit("error", { message: "Failed to send message." }); }
    });

    // ── WebRTC In-App Voice Call Signaling ────────────────
    // The ride room is used for signaling — both driver and rider join it

    // Caller initiates call
    socket.on("callOffer", ({ rideId, offer, callerId, callerName, callerRole }) => {
      console.log(`  📞 callOffer from ${callerName} in ride_${rideId}`);
      // Broadcast to everyone else in the ride room
      socket.to(`ride_${rideId}`).emit("callIncoming", {
        offer, callerId, callerName, callerRole,
        socketId: socket.id,
      });
    });

    // Receiver answers
    socket.on("callAnswer", ({ rideId, answer, callerId }) => {
      console.log(`  📞 callAnswer in ride_${rideId}`);
      socket.to(`ride_${rideId}`).emit("callAnswered", { answer });
    });

    // ICE candidate exchange
    socket.on("iceCandidate", ({ rideId, candidate }) => {
      socket.to(`ride_${rideId}`).emit("iceCandidate", { candidate });
    });

    // Hang up
    socket.on("callEnd", ({ rideId }) => {
      console.log(`  📞 callEnd in ride_${rideId}`);
      socket.to(`ride_${rideId}`).emit("callEnded");
    });

    // Call rejected
    socket.on("callReject", ({ rideId }) => {
      socket.to(`ride_${rideId}`).emit("callRejected");
    });

    // ── Disconnect ────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`🔌 ${user.name} disconnected`);
    });
  });
};

export default initSocketHandlers;
