import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*.svg", "icons/*.png"],
      manifest: {
        name: "Turism — Hub de viagens",
        short_name: "Turism",
        description: "Roteiro, documentos e gastos da viagem, sempre disponíveis offline.",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        categories: ["travel", "productivity"],
        icons: [
          { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
        share_target: {
          action: "/share-target",
          method: "POST",
          enctype: "multipart/form-data",
          params: { title: "title", text: "text", url: "url", files: [{ name: "files", accept: ["image/*", "application/pdf", "audio/*"] }] },
        },
      } as never,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        globIgnores: ["ocr/**"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/share-target/],
        runtimeCaching: [
          {
            // Tesseract.js: worker, core wasm e dados de idioma ficam em cache após o primeiro uso
            urlPattern: ({ url }) => /\/ocr\/|tesseract|tessdata/.test(url.href),
            handler: "CacheFirst",
            options: { cacheName: "ocr-engine", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: ({ url }) => url.hostname === "api.frankfurter.app" || url.hostname === "api.frankfurter.dev",
            handler: "NetworkFirst",
            options: { cacheName: "fx-api", networkTimeoutSeconds: 4, expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
          {
            urlPattern: ({ url }) => /supabase\.co\/storage/.test(url.href),
            handler: "CacheFirst",
            options: { cacheName: "remote-assets", expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { port: 5173, host: true },
  build: { sourcemap: false, chunkSizeWarningLimit: 1500 },
});
