import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash.startsWith("/") ? hash : "/";
}

interface RouterValue {
  path: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterValue>({ path: "/", navigate: () => {} });

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const target = to.startsWith("/") ? to : `/${to}`;
    if (currentPath() === target) return;
    if (options?.replace) {
      window.history.replaceState(null, "", `#${target}`);
      setPath(target);
    } else {
      window.location.hash = target;
    }
  }, []);

  const value = useMemo(() => ({ path, navigate }), [path, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRoute(): RouterValue {
  return useContext(RouterContext);
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
}

export function Link({ to, onClick, children, ...rest }: LinkProps) {
  const { navigate } = useRoute();
  return (
    <a
      href={`#${to}`}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export function matchRoute(path: string): { name: string; params: Record<string, string> } {
  const segments = path.split("?")[0].split("/").filter(Boolean);
  if (segments.length === 0) return { name: "landing", params: {} };
  const [first, second] = segments;
  switch (first) {
    case "jelajah":
      return { name: "explore", params: {} };
    case "janda":
      return { name: "profile", params: second ? { id: second } : {} };
    case "program":
      return { name: "programs", params: {} };
    case "event":
      if (second === "baru") return { name: "event-new", params: {} };
      if (second && segments[2] === "kelola") return { name: "event-manage", params: { id: second } };
      return { name: "events", params: second ? { id: second } : {} };
    case "galang-dana":
      if (second === "buat") return { name: "campaign-create", params: {} };
      return { name: "campaigns", params: {} };
    case "bisnis":
      if (second === "baru") return { name: "business-form", params: {} };
      if (second) return { name: "business-detail", params: { id: second } };
      return { name: "businesses", params: {} };
    case "grup":
      return { name: "groups", params: {} };
    case "pesan":
      return { name: "chat", params: {} };
    case "dasbor":
      return { name: "dashboard", params: {} };
    case "admin":
      return { name: "admin", params: {} };
    case "keuangan":
      return { name: "finance", params: {} };
    case "masuk":
      return { name: "login", params: {} };
    case "daftar":
      return { name: "register", params: {} };
    case "langganan":
      return { name: "subscription", params: {} };
    case "mentor-ai":
      return { name: "ai-mentor", params: {} };
    case "marketplace":
      if (second === "baru") return { name: "marketplace-form", params: {} };
      if (second) return { name: "marketplace-detail", params: { id: second } };
      return { name: "marketplace", params: {} };
    case "koin":
      return { name: "coins", params: {} };
    case "live-trading":
      return { name: "live-trading", params: {} };
    case "ai-agent":
      return { name: "ai-agent", params: {} };
    case "learning-center":
      return { name: "learning-center", params: {} };
    case "kompetisi-esport":
      if (second === "baru") return { name: "esport-create", params: {} };
      if (second === "tim") return { name: "esport-teams", params: {} };
      if (second === "papan") return { name: "esport-leaderboard", params: {} };
      if (second === "kelola" && segments[2]) return { name: "esport-manage", params: { id: segments[2] } };
      if (second && segments[2] === "kelola") return { name: "esport-manage", params: { id: second } };
      return { name: "esport-competition", params: second ? { id: second } : {} };
    case "bursa-transfer":
      return { name: "bursa-transfer", params: {} };
    case "pembayaran-berhasil":
      return { name: "payment-success", params: {} };
    case "pembayaran-gagal":
      return { name: "payment-failed", params: {} };
    case "feed":
      return { name: "feed", params: {} };
    default:
      return { name: "notfound", params: {} };
  }
}

export function useQueryParam(name: string): string | null {
  const { path } = useRoute();
  const query = path.split("?")[1] ?? "";
  return new URLSearchParams(query).get(name);
}
