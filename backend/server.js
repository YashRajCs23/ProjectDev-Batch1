// ============================================================
// server.js — RideBook Backend Entry Point (Uber/Ola clone)
// ============================================================
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

// Routes
import authRoutes from "./routes/auth.routes.js";
import rideRoutes from "./routes/ride.routes.js";
import driverRoutes from "./routes/driver.routes.js";
import requestRoutes from "./routes/request.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import emergencyRoutes from "./routes/emergency.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import ratingRoutes from "./routes/rating.routes.js";

// Socket handlers
import initSocketHandlers from "./sockets/main.socket.js";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// ── Socket.io ──────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ── Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Make io available to controllers via req.io
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ── Routes ─────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ratings", ratingRoutes);

app.get("/", (req, res) =>
  res.json({ message: "🚗 RideBook API running ✅" })
);

// ── Socket Handlers ────────────────────────────────────────
initSocketHandlers(io);

// ── Global Error Handler ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Global Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`🚀 RideBook Server: http://localhost:${PORT}`);
  });
});
