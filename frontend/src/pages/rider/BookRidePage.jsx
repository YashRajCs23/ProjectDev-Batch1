// src/pages/rider/BookRidePage.jsx
// Redirect to main dashboard which has the booking UI
import { Navigate } from "react-router-dom";
export default function BookRidePage() { return <Navigate to="/ride" replace />; }
