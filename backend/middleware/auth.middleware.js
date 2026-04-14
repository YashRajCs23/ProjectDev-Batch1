import jwt from "jsonwebtoken";
import User from "../models/User.model.js";

export const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer "))
      return res.status(401).json({ success: false, message: "No token." });

    const decoded = jwt.verify(auth.split(" ")[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ success: false, message: "User not found." });
    if (user.isBlocked) return res.status(403).json({ success: false, message: "Account blocked." });

    req.user = user;
    next();
  } catch (err) {
    const msg = err.name === "TokenExpiredError" ? "Token expired." : "Invalid token.";
    res.status(401).json({ success: false, message: msg });
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: "Forbidden." });
  next();
};
