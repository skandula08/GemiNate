import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Must match the port the server creates
// (Only used for dev server)
const DEV_BACKEND_PORT = 8000;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4530,
    proxy: {
      "/api": `http://localhost:${DEV_BACKEND_PORT}`,
      "/socket.io": {
        target: `ws://localhost:${DEV_BACKEND_PORT}`,
        ws: true,
        rewriteWsOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./tests/setup.js",
    exclude: ["node_modules/**", "**/.git/**", "tests/e2e/*"],
  },
});
