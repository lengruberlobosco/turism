/// <reference lib="webworker" />
/**
 * Service Worker (Workbox injectManifest). Além do precache do app shell e dos caches de runtime,
 * trata o Web Share Target com arquivos (POST multipart → cache temporário → redirect GET).
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { clientsClaim } from "workbox-core";

declare let self: ServiceWorkerGlobalScope;

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Share Target: outro app compartilha PDF/foto/áudio/link com o Turism
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        const form = await event.request.formData();
        const cache = await caches.open("share-target");
        await cache.put("/share-target/files", new Response(form));
        const params = new URLSearchParams();
        for (const k of ["title", "text", "url"]) {
          const v = form.get(k);
          if (typeof v === "string" && v) params.set(k, v);
        }
        return Response.redirect(`/share-target?${params}`, 303);
      })(),
    );
  }
});

registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/share-target$/] }));

registerRoute(
  ({ url }) => /\/ocr\/|tesseract|tessdata/.test(url.href),
  new CacheFirst({ cacheName: "ocr-engine", plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })] }),
);
registerRoute(
  ({ url }) => url.hostname === "api.frankfurter.app" || url.hostname === "api.frankfurter.dev",
  new NetworkFirst({ cacheName: "fx-api", networkTimeoutSeconds: 4, plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 })] }),
);
registerRoute(
  ({ url }) => /supabase\.co\/storage/.test(url.href),
  new CacheFirst({ cacheName: "remote-assets", plugins: [new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90 })] }),
);
registerRoute(
  ({ url }) => url.hostname === "upload.wikimedia.org",
  new CacheFirst({ cacheName: "reference-images", plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 })] }),
);
