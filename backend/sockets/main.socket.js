// sockets/main.socket.js — All real-time events
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

    console.log(`🔌 Socket: ${user.name} (${user.role})`);
    socket.userId = String(user._id);
    socket.userRole = user.role;

    // ── Join ride room ──────────────────────────────────
    socket.on("joinRide", ({ rideId }) => {
      socket.join(`ride_${rideId}`);
      console.log(`${user.name} joined ride room: ${rideId}`);
    });

    socket.on("leaveRide", ({ rideId }) => {
      socket.leave(`ride_${rideId}`);
    });

    // ── Driver location broadcast ───────────────────────
    socket.on("driverLocation", async ({ rideId, lat, lng }) => {
      if (user.role !== "DRIVER") return;
      // Update DB
      await Driver.findOneAndUpdate(
        { userId: user._id },
        { currentLocation: { lat, lng, updatedAt: new Date() } }
      );
      // Broadcast to ride room
      io.to(`ride_${rideId}`).emit("driverLocationUpdate", { lat, lng, timestamp: new Date() });
    });

    // ── Chat ────────────────────────────────────────────
    socket.on("sendMessage", async ({ rideId, message }) => {
      if (!message?.trim()) return;
      try {
        const msg = await Message.create({
          rideId,
          senderId: user._id,
          senderRole: user.role === "DRIVER" ? "DRIVER" : "RIDER",
          message: message.trim(),
        });

        const displayName = user.nameVisibility === "FULL" ? user.name
          : user.nameVisibility === "FIRST_NAME" ? user.name.split(" ")[0]
          : user.name.split(" ").map((n) => n[0] + ".").join(" ");

        io.to(`ride_${rideId}`).emit("receiveMessage", {
          _id: msg._id,
          rideId,
          senderId: { _id: user._id, name: displayName },
          senderRole: msg.senderRole,
          message: msg.message,
          createdAt: msg.createdAt,
        });
      } catch (e) {
        socket.emit("error", { message: "Failed to send message." });
      }
    });

    // ── Driver available for new rides ──────────────────
    socket.on("goOnline", async () => {
      if (user.role !== "DRIVER") return;
      const driver = await Driver.findOneAndUpdate(
        { userId: user._id },
        { isOnline: true },
        { new: true }
      );
      socket.join("drivers_online");
      io.emit("driverOnline", { driverId: driver._id });
    });

    socket.on("goOffline", async () => {
      if (user.role !== "DRIVER") return;
      await Driver.findOneAndUpdate({ userId: user._id }, { isOnline: false });
      socket.leave("drivers_online");
    });

    // ── Rider searching — notify all online drivers ────
    socket.on("riderSearching", (data) => {
      socket.to("drivers_online").emit("newRideAvailable", data);
    });

    socket.on("disconnect", async () => {
      if (user.role === "DRIVER") {
        await Driver.findOneAndUpdate({ userId: user._id }, { isOnline: false });
      }
      console.log(`🔌 Disconnected: ${user.name}`);
    });
  });
};

export default initSocketHandlers;
