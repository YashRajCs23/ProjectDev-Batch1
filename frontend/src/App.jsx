// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import LandingPage from "./pages/LandingPage";
import RiderDashboard from "./pages/rider/RiderDashboard";
import BookRidePage from "./pages/rider/BookRidePage";
import MyRidesPage from "./pages/rider/MyRidesPage";
import RideTrackingPage from "./pages/rider/RideTrackingPage";
import DriverDashboard from "./pages/driver/DriverDashboard";
import DriverSetupPage from "./pages/driver/DriverSetupPage";
import DriverRidesPage from "./pages/driver/DriverRidesPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ChatPage from "./pages/ChatPage";
import ProfilePage from "./pages/ProfilePage";
import SOSButton from "./components/common/SOSButton";

const Guard = ({ children, role }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role && user.role !== "ADMIN") return <Navigate to="/" replace />;
  return children;
};

const GuestOnly = ({ children }) => {
  const { user } = useAuth();
  if (user) {
    if (user.role === "DRIVER") return <Navigate to="/driver" replace />;
    if (user.role === "ADMIN") return <Navigate to="/admin" replace />;
    return <Navigate to="/ride" replace />;
  }
  return children;
};

const HomeRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/home" replace />;
  if (user.role === "DRIVER") return <Navigate to="/driver" replace />;
  if (user.role === "ADMIN") return <Navigate to="/admin" replace />;
  return <Navigate to="/ride" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/home" element={<LandingPage />} />
            <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />

            {/* Rider */}
            <Route path="/ride" element={<Guard role="RIDER"><RiderDashboard /></Guard>} />
            <Route path="/ride/book" element={<Guard role="RIDER"><BookRidePage /></Guard>} />
            <Route path="/ride/my-rides" element={<Guard role="RIDER"><MyRidesPage /></Guard>} />
            <Route path="/ride/track/:id" element={<Guard><RideTrackingPage /></Guard>} />

            {/* Driver */}
            <Route path="/driver" element={<Guard role="DRIVER"><DriverDashboard /></Guard>} />
            <Route path="/driver/setup" element={<Guard><DriverSetupPage /></Guard>} />
            <Route path="/driver/rides" element={<Guard role="DRIVER"><DriverRidesPage /></Guard>} />

            {/* Admin */}
            <Route path="/admin/*" element={<Guard role="ADMIN"><AdminDashboard /></Guard>} />

            {/* Shared */}
            <Route path="/chat/:rideId" element={<Guard><ChatPage /></Guard>} />
            <Route path="/profile" element={<Guard><ProfilePage /></Guard>} />
          </Routes>
          <SOSFloating />
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}

const SOSFloating = () => {
  const { user } = useAuth();
  if (!user) return null;
  return <SOSButton />;
};
