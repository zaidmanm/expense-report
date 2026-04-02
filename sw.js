// ═══════════════════════════════════════════════════════════════════
//  RETROCADE — Service Worker
//  GitHub: https://github.com/YOUR_USERNAME/YOUR_REPO
// ───────────────────────────────────────────────────────────────────
//
//  HOW TO PUSH AN UPDATE TO ALL PLAYERS:
//  ──────────────────────────────────────
//  1. Edit index.html (or any asset) as needed
//  2. Bump the VERSION string below  (e.g.  v1 → v2)
//  3. Commit and push to GitHub:
//       git add .
//       git commit -m "chore: bump to v2"
//       git push
//
//  What happens next (automatically):
//  • GitHub Pages serves the new sw.js
//  • Each player's browser detects the changed file on next visit
//    (or within 60 seconds if the app is already open)
//  • A yellow "UPDATE AVAILABLE — TAP TO INSTALL" banner appears
//  • Tapping it applies the update instantly, no full re-download
//
// ═══════════════════════════════════════════════════════════════════

const VERSION = 'retrocade-v1';   // ← BUMP THIS NUMBER TO PUSH AN UPDATE

// Files to pre-cache on install (relative to the sw.js location)
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
];

// External assets cached on first use (Google Fonts, etc.)
const RUNTIME_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// ── Install: pre-cache core files ──────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => {
        console.log(`[SW] ${VERSION} installed`);
        return self.skipWaiting(); // activate immediately, don't wait for old tabs to close
      })
  );
});

// ── Activate: delete all caches from previous versions ─────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== VERSION)
          .map(k => {
            console.log(`[SW] Deleting old cache: ${k}`);
            return caches.delete(k);
          })
      )
    ).then(() => {
      console.log(`[SW] ${VERSION} active`);
      return self.clients.claim(); // take control of all open tabs immediately
    })
  );
});

// ── Fetch: serve from cache, keep cache fresh ──────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET requests and browser extensions
  if (e.request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // NAVIGATION (HTML) — Network first so updates always land
  // Falls back to cache if offline
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // RUNTIME HOSTS (fonts, CDN) — Cache first, fetch & cache if missing
  if (RUNTIME_HOSTS.some(h => url.hostname.includes(h))) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // EVERYTHING ELSE (local assets) — Cache first
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, clone));
        return res;
      })
    )
  );
});

// ── Message: triggered by applyUpdate() in the page ───────────────
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') {
    console.log('[SW] skipWaiting — applying update now');
    self.skipWaiting();
  }
});
