/* ============================================================
   THE LEGACY CODE JOURNAL — Service Worker
   Caches the app shell for offline use (iOS PWA compatible)
   ============================================================ */

const CACHE_NAME = 'legacy-journal-v7';
const SHELL_FILES = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
];

// ── Install: pre-cache app shell ─────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ───────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first, fallback to cache ──────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't intercept Supabase or Anthropic API calls
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('anthropic.com') ||
    url.hostname.includes('jsdelivr.net') ||
    request.method !== 'GET'
  ) {
    return; // let the browser handle it normally
  }

  // App shell: cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Cache fresh copies of shell files
        if (response.ok && SHELL_FILES.some(f => url.pathname.endsWith(f.replace('/', '')))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html')); // offline fallback
    })
  );
});
