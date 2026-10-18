import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { User, Session } from "@supabase/supabase-js";

// Hook: Get current user
export function useSupabaseUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}

// Hook: Get current session
export function useSupabaseSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
}

// Hook: Realtime subscription
export function useSupabaseRealtime<T>(
  table: string,
  filter?: string,
  options?: { event?: "INSERT" | "UPDATE" | "DELETE" | "*" },
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    let query = supabase.from(table).select("*");
    if (filter) {
      const [column, value] = filter.split("=");
      query = query.eq(column, value);
    }

    query.then(({ data, error }) => {
      if (!error && data) {
        setData(data as T[]);
      }
      setLoading(false);
    });

    // Subscribe to changes
    const channel = supabase
      .channel(`${table}_changes`)
      .on(
        "postgres_changes",
        {
          event: options?.event ?? "*",
          schema: "public",
          table,
          filter: filter ? `${filter.replace("=", ":")}` : undefined,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setData((prev) => [...prev, payload.new as T]);
          } else if (payload.eventType === "UPDATE") {
            setData((prev) =>
              prev.map((item) =>
                (item as Record<string, unknown>).id === (payload.new as Record<string, unknown>).id
                  ? (payload.new as T)
                  : item,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setData((prev) =>
              prev.filter(
                (item) => (item as Record<string, unknown>).id !== (payload.old as Record<string, unknown>).id,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter]);

  return { data, loading };
}
