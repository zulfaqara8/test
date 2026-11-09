// PulseSync AI service worker.
// Purpose: lets alarms show system notifications (required on Android) and focuses the app when tapped.
// It does not cache anything, so updates always load fresh.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes('/dashboard') && 'focus' in c) return c.focus();
    }
    return self.clients.openWindow(url);
  })());
});
