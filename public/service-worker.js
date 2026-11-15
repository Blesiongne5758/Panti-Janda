self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() ?? "Ada panggilan masuk." };
  }

  const title = payload.title || "Panggilan masuk — Panti Janda";
  const options = {
    body: payload.body || "Buka Panti Janda untuk melihat panggilan masuk.",
    icon: payload.icon || "/images/logo-pj.png",
    tag: payload.tag || payload.callId || "panti-janda-call",
    data: { url: payload.url || "/#/pesan" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/#/pesan", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus().then((focused) => {
            if (focused && "navigate" in focused) return focused.navigate(targetUrl);
            return focused;
          });
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
