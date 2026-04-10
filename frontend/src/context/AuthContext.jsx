// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../utils/api";

const Ctx = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });
  const [driverProfile, setDriverProfile] = useState(null);

  useEffect(() => {
    if (user) loadDriver();
  }, [user?.role]);

  const loadDriver = async () => {
    if (user?.role !== "DRIVER") return;
    try {
      const { data } = await api.get("/drivers/me");
      if (data.success) setDriverProfile(data.driver);
    } catch {}
  };

  const saveAuth = (token, u) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setDriverProfile(null);
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
    <Ctx.Provider value={{ user, driverProfile, setDriverProfile, saveAuth, logout, refreshUser, loadDriver }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
};
