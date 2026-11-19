const REFRESH_EVENT = "pj:notifications-refresh";
const REFRESH_STORAGE_KEY = "pj:notifications-refresh";

export function publishNotificationRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(REFRESH_EVENT));
  try {
    window.localStorage.setItem(REFRESH_STORAGE_KEY, `${Date.now()}-${Math.random()}`);
  } catch {
    // The current tab still refreshes if storage is unavailable.
  }
}

export function subscribeToNotificationRefresh(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === REFRESH_STORAGE_KEY) listener();
  };
  window.addEventListener(REFRESH_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(REFRESH_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
