// Service Worker for W3C Web Push Notifications

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "Pemuda Persis Cirengit";
    const options = {
      body: payload.body || "",
      icon: payload.icon || "/icons/icon-192.png",
      badge: payload.badge || "/icons/badge-72.png",
      data: {
        url: payload.url || "/dashboard",
        ...(payload.data || {}),
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (_err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification("Pemuda Persis Cirengit", {
        body: text,
        data: { url: "/dashboard" },
      }),
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});
