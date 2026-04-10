// src/context/SocketContext.jsx — Fixed: use state so socket updates propagate
import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const Ctx = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const s = io("/", {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    s.on("connect", () => { setConnected(true); setSocket(s); });
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", (err) => console.warn("Socket error:", err.message));

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, []);

  return (
    <Ctx.Provider value={{ socket, connected }}>
      {children}
    </Ctx.Provider>
  );
};

export const useSocket = () => useContext(Ctx);
