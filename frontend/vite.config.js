import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:5000",
        ws: true,
        // Suppress ECONNABORTED noise from WebSocket proxy
        configure: (proxy) => {
          proxy.on("error", (err) => {
            if (err.code !== "ECONNABORTED" && err.code !== "ECONNRESET") {
              console.error("Proxy error:", err.message);
            }
          });
        },
      },
    },
  },
});
