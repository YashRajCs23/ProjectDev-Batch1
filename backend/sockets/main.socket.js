// sockets/main.socket.js — Fixed: reliable driver notifications
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
  // Track online drivers: driverSocketId → driverId
  const onlineDriverSockets = new Map();

  io.on("connection", async (socket) => {
    const user = await authSocket(socket);
    if (!user) { socket.disconnect(); return; }

    console.log(`🔌 ${user.name} (${user.role}) connected [${socket.id}]`);
    socket.userId = String(user._id);
    socket.userRole = user.role;

    // ── Auto-rejoin online room if driver was online ──────
    if (user.role === "DRIVER") {
      const driver = await Driver.findOne({ userId: user._id });
      if (driver?.isOnline && driver?.isApproved) {
        socket.join("drivers_online");
        onlineDriverSockets.set(socket.id, String(driver._id));
        console.log(`  ↳ Auto-rejoined drivers_online room`);
      }
    }

    // ── Join a ride room ──────────────────────────────────
    socket.on("joinRide", ({ rideId }) => {
      socket.join(`ride_${rideId}`);
      console.log(`  ${user.name} → ride room: ${rideId}`);
    });

    socket.on("leaveRide", ({ rideId }) => socket.leave(`ride_${rideId}`));

    // ── Driver goes online ────────────────────────────────
    socket.on("goOnline", async () => {
      if (user.role !== "DRIVER") return;
      socket.join("drivers_online");
      const driver = await Driver.findOne({ userId: user._id });
      if (driver) onlineDriverSockets.set(socket.id, String(driver._id));
      console.log(`  🟢 ${user.name} is now ONLINE`);
      io.emit("driverStatusChanged", { driverId: driver?._id, isOnline: true });
    });

    socket.on("goOffline", async () => {
      if (user.role !== "DRIVER") return;
      socket.leave("drivers_online");
      onlineDriverSockets.delete(socket.id);
      console.log(`  🔴 ${user.name} is now OFFLINE`);
      const driver = await Driver.findOne({ userId: user._id });
      io.emit("driverStatusChanged", { driverId: driver?._id, isOnline: false });
    });

    // ── Rider searching → broadcast to drivers_online ─────
    // This is a SECONDARY path (backend createRide already does io.emit)
    // Kept for real-time push without waiting for HTTP response
    socket.on("riderSearching", (data) => {
      console.log(`  🚗 Rider searching: ${data.cabType} ride, ₹${data.fare}`);
      // Emit to all online drivers
      io.to("drivers_online").emit("newRideAvailable", {
        ...data,
        timestamp: new Date().toISOString(),
      });
    });

    // ── Driver GPS location update ────────────────────────
    socket.on("driverLocation", async ({ rideId, lat, lng }) => {
      if (user.role !== "DRIVER") return;
      // Update DB asynchronously
      Driver.findOneAndUpdate(
        { userId: user._id },
        { currentLocation: { lat, lng, updatedAt: new Date() } }
      ).catch(() => {});
      // Broadcast to everyone in ride room
      if (rideId) {
        socket.to(`ride_${rideId}`).emit("driverLocationUpdate", {
          lat, lng, timestamp: new Date().toISOString(),
        });
      }
    });

    // ── Chat messages ─────────────────────────────────────
    socket.on("sendMessage", async ({ rideId, message }) => {
      if (!message?.trim() || !rideId) return;
      try {
        const msg = await Message.create({
          rideId,
          senderId: user._id,
          senderRole: user.role === "DRIVER" ? "DRIVER" : "RIDER",
          message: message.trim(),
        });
        // Display name based on privacy setting
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
      } catch (e) {
        socket.emit("error", { message: "Failed to send message." });
      }
    });

    // ── Disconnect ────────────────────────────────────────
    socket.on("disconnect", async () => {
      onlineDriverSockets.delete(socket.id);
      if (user.role === "DRIVER") {
        // Don't set isOnline=false on disconnect — driver may reconnect briefly
        // The toggleOnline API handles the persistent state
      }
      console.log(`🔌 ${user.name} disconnected [${socket.id}]`);
    });
  });
};

export default initSocketHandlers;
