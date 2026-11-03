import { Link, useRoute } from "@/lib/router";
import { Home, Store, PlusCircle, Inbox, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const { path } = useRoute();

  const navItems = [
    { id: "home", label: "Home", icon: Home, path: "/" },
    { id: "marketplace", label: "Market", icon: Store, path: "/marketplace" },
    { id: "create", label: "Post", icon: PlusCircle, path: "/marketplace-form" },
    { id: "inbox", label: "Inbox", icon: Inbox, path: "/chat" },
    { id: "profile", label: "Profile", icon: User, path: "/dashboard" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-md sm:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 items-center justify-center gap-1 p-2">
        {navItems.map((item) => {
          const isActive = path === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 transition-all active:scale-90",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "flex size-8 items-center justify-center rounded-xl transition-colors",
                isActive ? "bg-primary/10 text-primary" : "bg-transparent"
              )}>
                <Icon className="size-5" />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
