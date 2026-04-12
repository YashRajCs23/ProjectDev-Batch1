// src/context/SocketContext.jsx — Fixed singleton with proper token refresh
import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const Ctx = createContext(null);

let _socket = null;   // singleton instance
let _token  = null;   // token used to create current socket

export const disconnectSocket = () => {
  if (_socket) { _socket.disconnect(); _socket = null; _token = null; }
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket]       = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // If socket exists and uses the same token → reuse it
    if (_socket && _token === token) {
      setSocket(_socket);
      setConnected(_socket.connected);
      return;
    }

    // Disconnect any stale socket (different token or disconnected)
    if (_socket) { _socket.disconnect(); _socket = null; }

    const s = io("/", {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 20,
      timeout: 15000,
    });

    _socket = s;
    _token  = token;

    s.on("connect", () => {
      console.log("✅ Socket connected:", s.id);
      setConnected(true);
      setSocket(s);
    });

    s.on("disconnect", (reason) => {
      console.log("❌ Socket disconnect:", reason);
      setConnected(false);
      // Don't clear socket — let reconnection handle it
    });

    s.on("reconnect", () => {
      console.log("🔄 Socket reconnected");
      setConnected(true);
    });

    s.on("connect_error", (err) => {
      console.warn("Socket error:", err.message);
    });

    // Expose immediately (even before connect event fires)
    setSocket(s);

    return () => {
      // Don't disconnect on unmount — singleton persists across navigation
    };
  }, []);

  return (
    <Ctx.Provider value={{ socket, connected }}>
      {children}
    </Ctx.Provider>
  );
};

export const useSocket = () => useContext(Ctx);
