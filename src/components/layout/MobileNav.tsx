import { Link, useRoute } from "@/lib/router";
import { CalendarDays, Camera, Home, MessageCircle, Store } from "lucide-react";
import { useAuth } from "@/lib/session";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const { path } = useRoute();
  const { account } = useAuth();
  const cleanPath = path.split("?")[0];

  const navItems = [
    { id: "home", label: "Home", icon: Home, path: account ? "/feed" : "/" },
    { id: "marketplace", label: "Marketplace", icon: Store, path: "/marketplace" },
    { id: "create", label: "Posting", icon: Camera, path: "/feed", create: true },
    { id: "chat", label: "Chat", icon: MessageCircle, path: "/pesan" },
    { id: "events", label: "Event", icon: CalendarDays, path: "/event" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-md sm:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-5 items-center justify-center gap-1 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {navItems.map((item) => {
          const isActive = item.id === "home"
            ? cleanPath === item.path
            : item.create
              ? false
              : cleanPath === item.path || cleanPath.startsWith(`${item.path}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={item.create ? () => {
                sessionStorage.setItem("feed-camera", "1");
                window.dispatchEvent(new Event("feed:camera"));
              } : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-all active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "flex size-8 items-center justify-center rounded-xl transition-colors",
                item.create
                  ? "-mt-3 size-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-2 ring-background"
                  : isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-transparent"
              )}>
                <Icon className={cn("size-5", item.create && "size-6 stroke-[2.5px]")} aria-hidden />
              </div>
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
