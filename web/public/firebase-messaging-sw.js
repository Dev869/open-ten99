/* Firebase Cloud Messaging service worker.
   Handles background push notifications when the app is not in the foreground. */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const notification = payload.notification ?? {};
  const title = notification.title ?? 'Ten99';
  const options = {
    body: notification.body ?? '',
    icon: notification.icon ?? '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data ?? {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url ?? '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
