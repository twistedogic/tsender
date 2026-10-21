import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/tsender/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icon-192.svg", "icon-512.svg"],
      manifest: {
        name: "tsender",
        short_name: "tsender",
        description: "Hong Kong personal-finance scenario simulator (browser).",
        theme_color: "#0b3a5b",
        background_color: "#f8fafc",
        display: "standalone",
        start_url: "/tsender/",
        scope: "/tsender/",
        icons: [
          { src: "icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
          {
            src: "icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
