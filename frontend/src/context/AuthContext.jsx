// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../utils/api";

const Ctx = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });
  const [driverProfile, setDriverProfile] = useState(null);
  // Critical: don't show driver dashboard until profile is loaded
  const [driverLoading, setDriverLoading] = useState(false);
  const [driverLoaded, setDriverLoaded]   = useState(false);

  useEffect(() => {
    if (user?.role === "DRIVER") {
      setDriverLoaded(false);
      loadDriver();
    } else {
      setDriverLoaded(true);
    }
  }, [user?._id, user?.role]);

  const loadDriver = async () => {
    setDriverLoading(true);
    try {
      const { data } = await api.get("/drivers/me");
      if (data.success) setDriverProfile(data.driver);
      else setDriverProfile(null);
    } catch {
      setDriverProfile(null);
    } finally {
      setDriverLoading(false);
      setDriverLoaded(true);
    }
  };

  const saveAuth = (token, u) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
    setDriverProfile(null);
    setDriverLoaded(false);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setDriverProfile(null);
    setDriverLoaded(true);
    // Disconnect socket singleton
    import("./SocketContext").then(m => m.disconnectSocket?.()).catch(() => {});
  };

  const refreshUser = async () => {
    try {
      const { data } = await api.get("/auth/me");
      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
        if (data.driverProfile) setDriverProfile(data.driverProfile);
      }
    } catch {}
  };

  return (
    <Ctx.Provider value={{ user, driverProfile, driverLoading, driverLoaded, setDriverProfile, saveAuth, logout, refreshUser, loadDriver }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
};
