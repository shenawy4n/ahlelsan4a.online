import { supabase } from "@/integrations/supabase/client";

export type EventType =
  | "profile_view"
  | "phone_click"
  | "whatsapp_click"
  | "search"
  | "category_view";

let cachedIsAdmin: boolean | null = null;
let adminCheckPromise: Promise<boolean> | null = null;

async function isAdmin(): Promise<boolean> {
  if (cachedIsAdmin !== null) return cachedIsAdmin;
  if (adminCheckPromise) return adminCheckPromise;

  adminCheckPromise = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) {
        cachedIsAdmin = false;
        return false;
      }
      const { data: r } = await supabase.rpc("has_role", {
        _user_id: uid,
        _role: "admin",
      });
      cachedIsAdmin = Boolean(r);
      return cachedIsAdmin;
    } catch {
      cachedIsAdmin = false;
      return false;
    } finally {
      adminCheckPromise = null;
    }
  })();

  return adminCheckPromise;
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange(() => {
    cachedIsAdmin = null;
    adminCheckPromise = null;
  });
}

interface QueuedEvent {
  event_type: EventType;
  provider_id: string | null;
  category_id: string | null;
  retries: number;
}

// Queue and batch events to avoid bursting network requests
let eventQueue: QueuedEvent[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;

// Session-level deduplication for profile views to avoid React Strict Mode or fast re-render double-tracking
const recentProfileViews = new Map<string, number>();

/**
 * Clean up old deduplication entries after 60 seconds to avoid unbounded memory growth.
 */
function pruneRecentViews() {
  const cutoff = Date.now() - 60_000;
  for (const [id, timestamp] of recentProfileViews.entries()) {
    if (timestamp < cutoff) {
      recentProfileViews.delete(id);
    }
  }
}

/**
 * Flush all queued analytics events.
 * Uses the dedicated server function as primary ingestion with direct client Supabase insert fallback.
 */
export async function flushEvents(): Promise<void> {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (!eventQueue.length || isFlushing) return;
  isFlushing = true;

  const toSend = [...eventQueue];
  eventQueue = [];

  try {
    const admin = await isAdmin();
    if (admin) {
      // Exclude admin events per analytics policy
      isFlushing = false;
      return;
    }

    // Map strictly to the database columns (event_type, provider_id, category_id)
    // CRITICAL: Do NOT include 'query' column which does not exist in the live analytics_events schema.
    const dbRows = toSend.map((item) => ({
      event_type: item.event_type,
      provider_id: item.provider_id,
      category_id: item.category_id,
    }));

    let succeeded = false;

    // 1. Primary path: TanStack Start Server Function
    try {
      const { recordAnalyticsEventsServerFn } = await import("./analytics.functions");
      const res = await recordAnalyticsEventsServerFn({ data: { events: dbRows } });
      if (res.ok) {
        succeeded = true;
      } else {
        console.warn("[track] Server ingestion returned non-ok:", res.error);
      }
    } catch (serverFnErr) {
      console.warn("[track] Server function ingestion failed, attempting direct insert fallback:", serverFnErr);
    }

    // 2. Fallback path: Direct client-side Supabase insert
    if (!succeeded) {
      const { error } = await supabase.from("analytics_events").insert(dbRows);
      if (error) {
        console.warn(`[track] Analytics write failed [code: ${error.code}]:`, error.message);
        // If transient network error, allow up to 2 retries
        const isTransient = error.code === "" || error.code === "PGRST000" || error.message?.includes("fetch");
        if (isTransient) {
          const eligibleForRetry = toSend
            .filter((item) => item.retries < 2)
            .map((item) => ({ ...item, retries: item.retries + 1 }));
          if (eligibleForRetry.length && eventQueue.length < 50) {
            eventQueue.unshift(...eligibleForRetry);
          }
        }
      } else {
        succeeded = true;
      }
    }
  } catch (err) {
    console.warn("[track] Unexpected exception during event flush:", err);
  } finally {
    isFlushing = false;
  }
}

/**
 * Flush analytics immediately. Can be invoked on route unmount or beforeunload.
 */
export const flushAnalytics = flushEvents;

// Register lifecycle listeners to capture queued events before page hidden or navigated away
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    void flushEvents();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void flushEvents();
    }
  });
}

/**
 * Lightweight, anonymous event logging. Batched to prevent network flooding.
 */
export function track(
  event_type: EventType,
  extra: {
    provider_id?: string | undefined;
    category_id?: string | undefined;
    query?: string | undefined;
  } = {}
) {
  if (typeof window === "undefined") return;

  // Deduplicate rapid repeat profile views for the same provider (e.g. React Strict Mode or state transitions)
  if (event_type === "profile_view" && extra.provider_id) {
    const now = Date.now();
    const lastViewed = recentProfileViews.get(extra.provider_id);
    if (lastViewed && now - lastViewed < 3000) {
      // Ignore duplicate profile view within 3 seconds for the exact same provider
      return;
    }
    recentProfileViews.set(extra.provider_id, now);
    if (recentProfileViews.size > 50) {
      pruneRecentViews();
    }
  }

  eventQueue.push({
    event_type,
    provider_id: extra.provider_id ?? null,
    category_id: extra.category_id ?? null,
    retries: 0,
  });

  if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      flushTimeout = null;
      void flushEvents();
    }, 350);
  }
}
