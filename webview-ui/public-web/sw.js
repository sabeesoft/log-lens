/*
 * Log Lens service worker — offline app shell, nothing more.
 *
 * Strategy:
 *   - navigations  → network-first, fall back to the cached shell when offline.
 *   - static assets (hashed, same-origin) → cache-first, then network.
 *   - everything else is left alone.
 *
 * It only ever caches same-origin GET responses for the app itself. Log files
 * are read through the File API and never pass through here, so no log data is
 * ever cached. There are no cross-origin requests — the app makes none.
 *
 * Bump CACHE when the shell changes to evict the old one.
 */
const CACHE = 'log-lens-shell-v1';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') {
    return;
  }

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    // The app makes no cross-origin requests; don't touch any that appear.
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('./index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
