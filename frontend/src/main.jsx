import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// StrictMode removed: it causes socket.io to connect/disconnect/connect in dev mode
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
