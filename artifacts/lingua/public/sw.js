const CACHE_NAME = 'lingua-shell-v1';
const SHELL = ['./', './manifest.webmanifest', './lingua-icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL);
    const shell = await cache.match('./');
    if (shell) {
      const html = await shell.text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)]
        .map(match => new URL(match[1], self.registration.scope).href);
      await Promise.allSettled(assets.map(asset => cache.add(asset)));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request).then(response => {
      if (response.ok) event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone())));
      return response;
    }).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') return caches.match('./');
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })
  );
});
