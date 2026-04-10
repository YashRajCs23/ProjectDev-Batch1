// src/context/SocketContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const Ctx = createContext(null);

export const SocketProvider = ({ children }) => {
  const ref = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    ref.current = io("/", { auth: { token }, transports: ["websocket"] });
    ref.current.on("connect", () => setConnected(true));
    ref.current.on("disconnect", () => setConnected(false));

    return () => ref.current?.disconnect();
  }, []);

  return (
    <Ctx.Provider value={{ socket: ref.current, connected }}>
      {children}
    </Ctx.Provider>
  );
};

export const useSocket = () => useContext(Ctx);
