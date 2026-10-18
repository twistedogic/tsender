import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/model": path.resolve(__dirname, "./src/model"),
      "@/scenario": path.resolve(__dirname, "./src/scenario"),
      "@/output": path.resolve(__dirname, "./src/output"),
      "@/ui": path.resolve(__dirname, "./src/ui"),
      "@/test": path.resolve(__dirname, "./src/test"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
