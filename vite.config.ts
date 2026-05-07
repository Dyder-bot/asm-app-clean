import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "ASM Pau",
        short_name: "ASM Pau",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0f1110",
        theme_color: "#d4e157",
        orientation: "portrait",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1000
  }
});
