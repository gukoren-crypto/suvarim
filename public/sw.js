const ROOT = new URL("./", self.location.href).pathname;
const PREFIX = `suvarim-${encodeURIComponent(ROOT)}-`;
const CACHE = PREFIX + "shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          ROOT,
          `${ROOT}icon.svg`,
          `${ROOT}manifest.webmanifest`,
          `${ROOT}icon-192.png`,
          `${ROOT}icon-512.png` /* BUILD_ASSETS */,
        ]),
      ),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(PREFIX) && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(ROOT)
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(ROOT, copy));
          }
          return response;
        })
        .catch(() => caches.match(ROOT)),
    );
    return;
  }
  if (
    url.pathname.startsWith(`${ROOT}assets/`) ||
    ["icon.svg", "icon-192.png", "icon-512.png", "manifest.webmanifest"].some(
      (path) => url.pathname === ROOT + path,
    )
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches
                .open(CACHE)
                .then((cache) => cache.put(event.request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
