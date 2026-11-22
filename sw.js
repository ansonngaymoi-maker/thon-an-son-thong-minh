const CACHE_NAME = 'an-son-thong-minh-v1.0.0';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Thôn An Sơn Thông Minh', body: 'Có thông báo mới từ Ban thôn.' };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Thôn An Sơn Thông Minh', {
      body: data.body || 'Bấm để xem chi tiết thông báo.',
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
