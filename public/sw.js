/* Penny service worker — offline app shell + check-in notification actions. */
const CACHE = 'penny-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg'])).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.host.includes('fonts.googleapis.com') || url.host.includes('fonts.gstatic.com');
  if (url.origin !== location.origin && !isFont) return;
  if (url.pathname.startsWith('/@') || url.pathname.includes('/node_modules/') || url.search.includes('t=')) return; // dev server internals
  if (isFont) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  // Network first, fall back to cache (so you always get the latest version when online).
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});

async function tellClient(action) {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (all.length) {
    const c = all[0];
    c.postMessage({ type: 'penny-checkin', action });
    if (action === 'log' && 'focus' in c) return c.focus();
    return;
  }
  return self.clients.openWindow(`./?checkin=${action}#/dashboard`);
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(tellClient(e.action || 'log'));
});

/* Ready for a future push backend (Web Push). Not used by the MVP. */
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(data.title || 'Penny check-in', {
    body: data.body || 'Spent anything since your last check-in? Log it while it\'s fresh.',
    tag: 'penny-checkin', icon: './icon-192.png',
    actions: [{ action: 'log', title: 'Yes, log expense' }, { action: 'nothing', title: 'Nothing spent' }, { action: 'later', title: 'Later' }],
  }));
});
