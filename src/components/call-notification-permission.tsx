import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type CallNotificationPermission = NotificationPermission | "unsupported";

function readPermission(): CallNotificationPermission {
  if (typeof window === "undefined" || !window.isSecureContext || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function CallNotificationPermissionNotice() {
  const [permission, setPermission] = useState<CallNotificationPermission>(readPermission);

  useEffect(() => {
    if (window.isSecureContext && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(() => {});
    }
    const refreshPermission = () => setPermission(readPermission());
    window.addEventListener("focus", refreshPermission);
    return () => window.removeEventListener("focus", refreshPermission);
  }, []);

  const requestPermission = async () => {
    if (readPermission() === "unsupported") {
      setPermission("unsupported");
      return;
    }
    try {
      const next = await Notification.requestPermission();
      setPermission(next);
      if (next === "granted") toast.success("Notifikasi panggilan perangkat telah diaktifkan.");
    } catch {
      setPermission(readPermission());
      toast.error("Browser belum dapat mengaktifkan notifikasi. Periksa izin situs di pengaturan perangkat.");
    }
  };

  if (permission === "granted") return null;

  const blocked = permission === "denied" || permission === "unsupported";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex shrink-0 items-center gap-3 border-b px-3 py-2.5 sm:px-4 ${
        blocked
          ? "border-amber-200/70 bg-amber-50/80 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100"
          : "border-primary/10 bg-primary/[0.04] text-foreground"
      }`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/80">
        {blocked ? <BellOff className="size-4" aria-hidden /> : <BellRing className="size-4 text-primary" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold">
          {permission === "default" ? "Aktifkan notifikasi panggilan" : "Notifikasi panggilan belum tersedia"}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug opacity-80">
          {permission === "default"
            ? "Izinkan browser menampilkan pemberitahuan perangkat saat ada panggilan masuk. Browser harus tetap berjalan."
            : permission === "denied"
              ? "Notifikasi diblokir. Ubah izin situs menjadi Izinkan di setelan browser/perangkat, lalu cek kembali."
              : "Browser ini belum mendukung notifikasi web yang aman. Panggilan tetap tampil saat aplikasi terbuka."}
        </p>
      </div>
      {permission === "default" ? (
        <Button type="button" size="sm" className="h-8 shrink-0 px-3 text-xs" onClick={() => void requestPermission()}>
          Aktifkan
        </Button>
      ) : permission === "denied" ? (
        <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 px-3 text-xs" onClick={() => setPermission(readPermission())}>
          Cek lagi
        </Button>
      ) : null}
    </div>
  );
}
