import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AllowedEventTypeSchema = z.enum([
  "profile_view",
  "phone_click",
  "whatsapp_click",
  "search",
  "category_view",
]);

export type AllowedEventType = z.infer<typeof AllowedEventTypeSchema>;

const AnalyticsItemSchema = z.object({
  event_type: AllowedEventTypeSchema,
  provider_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
});

const IngestInputSchema = z.object({
  events: z.array(AnalyticsItemSchema).min(1).max(30),
});

export type AnalyticsBatchInput = z.infer<typeof IngestInputSchema>;

// Rate limiting map for public event ingestion (sliding window: 60 events per minute per IP)
const ipAnalyticsLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string, maxEvents = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const history = (ipAnalyticsLimitMap.get(ip) || []).filter((t) => now - t < windowMs);
  if (history.length >= maxEvents) {
    return true;
  }
  history.push(now);
  ipAnalyticsLimitMap.set(ip, history);
  return false;
}

/**
 * Public Analytics Event Ingestion Server Function
 *
 * Guarantees:
 * - Only permitted event types are accepted.
 * - Provider and category IDs are strictly validated UUIDs.
 * - Database schema mapping: inserts only (event_type, provider_id, category_id).
 * - Excludes admin visits by verifying user role.
 * - Rate limited against flood abuse.
 * - Never exposes service-role keys to client.
 */
export const recordAnalyticsEventsServerFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const res = IngestInputSchema.safeParse(d);
    if (!res.success) {
      throw new Error(`invalid_analytics_payload: ${res.error.message}`);
    }
    return res.data;
  })
  .handler(async ({ data }): Promise<{ ok: boolean; count?: number; error?: string }> => {
    try {
      let clientIp = "unknown";
      try {
        const { getRequest } = await import("@tanstack/react-start/server");
        const req = getRequest();
        if (req) {
          const { getClientIp } = await import("./rate-limit.server");
          clientIp = getClientIp(req);
        }
      } catch {
        // Fallback in environments without getRequest
      }

      if (isRateLimited(clientIp)) {
        return { ok: false, error: "rate_limited" };
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Check if session belongs to an admin
      try {
        const { getRequest } = await import("@tanstack/react-start/server");
        const req = getRequest();
        const authHeader = req?.headers.get("authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
          const token = authHeader.slice(7);
          const { data: userData } = await supabaseAdmin.auth.getUser(token);
          if (userData?.user?.id) {
            const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
              _user_id: userData.user.id,
              _role: "admin",
            });
            if (isAdmin) {
              // Exclude admin events per analytics policy
              return { ok: true, count: 0 };
            }
          }
        }
      } catch {
        // Continue anonymous logging if no admin session
      }

      // Map strictly to the actual database columns (id, event_type, provider_id, category_id, created_at)
      const rows = data.events.map((e) => ({
        event_type: e.event_type,
        provider_id: e.provider_id || null,
        category_id: e.category_id || null,
      }));

      const { error } = await supabaseAdmin.from("analytics_events").insert(rows);

      if (error) {
        console.warn("[analytics:server] Database insert error:", error.code, error.message);
        return { ok: false, error: error.message };
      }

      return { ok: true, count: rows.length };
    } catch (err: any) {
      console.error("[analytics:server] Unexpected exception:", err);
      return { ok: false, error: err?.message || "server_error" };
    }
  });
