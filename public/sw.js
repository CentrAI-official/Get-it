// Service worker de Get iT : affiche les notifications reçues (web push) et
// ouvre la bonne page quand on touche une notification. Rien d'autre (pas de
// mise en cache hors ligne).

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Get iT";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        // Une fenêtre de Get iT est déjà ouverte : elle va à la page
        for (const client of windows) {
          if (new URL(client.url).origin === self.location.origin) {
            return client.focus().then(() => client.navigate(url));
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
