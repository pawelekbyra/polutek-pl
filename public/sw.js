self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // Polish phase kill switch: do not intercept requests or keep persistent
  // offline caches. The app uses in-memory preloading instead.
  return;
});
