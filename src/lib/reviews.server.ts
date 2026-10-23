export interface ReviewRecord {
  id: string;
  provider_id: string;
  rating: number; // 1-5
  comment: string;
  reviewer_name: string | null;
  reviewer_phone?: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export interface PublicReview {
  id: string;
  provider_id: string;
  rating: number;
  comment: string;
  reviewer_name: string | null;
  created_at: string;
}

export interface ProviderRatingSummary {
  average: number;
  count: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Web Crypto helpers for cross-runtime (Node.js & Cloudflare Workers) compatibility
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

async function getDedicatedKey(): Promise<CryptoKey | null> {
  const secret = process.env.PHONE_ENCRYPTION_KEY;
  if (!secret) return null;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function getLegacyKey(): Promise<CryptoKey> {
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_URL ||
    "ahlelsan3a-secure-review-salt-2026";
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function decryptWithKey(
  ivHex: string,
  tagHex: string,
  dataHex: string,
  key: CryptoKey
): Promise<string | null> {
  try {
    if (ivHex.length !== 24 || tagHex.length !== 32) return null;
    const iv = hexToBytes(ivHex);
    const tag = hexToBytes(tagHex);
    const data = hexToBytes(dataHex);
    const combined = new Uint8Array(data.length + tag.length);
    combined.set(data, 0);
    combined.set(tag, data.length);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      combined as BufferSource
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

async function encryptPhone(phone: string): Promise<string> {
  try {
    const dedicatedKey = await getDedicatedKey();
    const key = dedicatedKey || (await getLegacyKey());
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(phone);
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      encoded
    );
    const cipherBytes = new Uint8Array(cipherBuffer);
    const tagBytes = cipherBytes.slice(cipherBytes.length - 16);
    const dataBytes = cipherBytes.slice(0, cipherBytes.length - 16);
    return `${bytesToHex(iv)}:${bytesToHex(tagBytes)}:${bytesToHex(dataBytes)}`;
  } catch {
    return phone;
  }
}

async function decryptPhone(token: string): Promise<string | null> {
  try {
    const parts = token.split(":");
    if (parts.length !== 3) return token;
    const [ivHex, tagHex, dataHex] = parts;

    // 1. If PHONE_ENCRYPTION_KEY is set, try dedicated key first
    const dedicatedKey = await getDedicatedKey();
    if (dedicatedKey) {
      const dec = await decryptWithKey(ivHex, tagHex, dataHex, dedicatedKey);
      if (dec !== null) return dec;
    }

    // 2. Legacy key derivation (preserves all existing encrypted review records)
    const legacyKey = await getLegacyKey();
    return await decryptWithKey(ivHex, tagHex, dataHex, legacyKey);
  } catch {
    return null;
  }
}

function isTableMissingOrSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string; hint?: string; status?: number };
  const msg = (err.message || "").toLowerCase();
  const hint = (err.hint || "").toLowerCase();
  const code = String(err.code || "");
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    code === "22P02" ||
    err.status === 404 ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    msg.includes("relation") ||
    msg.includes("does not exist") ||
    msg.includes("invalid api key") ||
    hint.includes("double check your supabase")
  );
}

/** Insert a new review (defaults to pending) */
export async function createReview(data: {
  provider_id: string;
  rating: number;
  comment: string;
  reviewer_name?: string | null;
  reviewer_phone?: string | null;
}): Promise<{ ok: boolean; id: string }> {
  const newId = globalThis.crypto.randomUUID();
  if (!data.provider_id || !UUID_REGEX.test(data.provider_id.trim())) {
    return { ok: false, id: newId };
  }

  const record: Record<string, any> = {
    id: newId,
    provider_id: data.provider_id.trim(),
    rating: data.rating,
    comment: data.comment,
    reviewer_name: data.reviewer_name?.trim() || null,
    status: "pending" as const,
    created_at: new Date().toISOString(),
  };

  try {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server.ts");
    const { error } = await supabaseAdmin.from("reviews").insert(record);
    if (error) {
      if (!isTableMissingOrSchemaError(error)) {
        console.error("[reviews.server] Error inserting review to Supabase:", error);
      }
      return { ok: false, id: newId };
    }

    // Securely persist reviewer phone for authorized admin verification
    if (data.reviewer_phone) {
      const encrypted = await encryptPhone(data.reviewer_phone.trim());
      await supabaseAdmin.from("app_settings").upsert({
        key: `rev_sec_${newId}`,
        value: encrypted,
        updated_at: new Date().toISOString(),
      });
    }

    return { ok: true, id: newId };
  } catch (e) {
    if (!isTableMissingOrSchemaError(e)) {
      console.error("[reviews.server] Exception inserting review:", e);
    }
    return { ok: false, id: newId };
  }
}

/**
 * Get public reviews for a provider.
 * Strictly returns only APPROVED reviews.
 * Does not expose status, reviewed_at, or any moderation metadata.
 */
export async function getProviderApprovedReviews(providerId: string): Promise<PublicReview[]> {
  if (!providerId || !UUID_REGEX.test(providerId.trim())) {
    return [];
  }

  try {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server.ts");
    const { data, error } = await supabaseAdmin
      .from("reviews")
      .select("id, provider_id, rating, comment, reviewer_name, created_at")
      .eq("provider_id", providerId.trim())
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) {
      if (!isTableMissingOrSchemaError(error)) {
        console.error(`[reviews.server] Error fetching approved reviews:`, error);
      }
      return [];
    }
    return (data ?? []) as unknown as PublicReview[];
  } catch (e) {
    if (!isTableMissingOrSchemaError(e)) {
      console.error("[reviews.server] Exception fetching approved reviews:", e);
    }
    return [];
  }
}

/**
 * Get provider rating summary (average & count).
 * Strictly calculates based on approved reviews only.
 * Pending & rejected are NEVER included.
 */
export async function getProviderRatingSummary(providerId: string): Promise<ProviderRatingSummary> {
  if (!providerId || !UUID_REGEX.test(providerId.trim())) {
    return { average: 0, count: 0 };
  }
  const reviews = await getProviderApprovedReviews(providerId.trim());
  if (!reviews.length) {
    return { average: 0, count: 0 };
  }

  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const average = Math.round((sum / reviews.length) * 10) / 10;
  return { average, count: reviews.length };
}

/**
 * Get all providers' rating summaries in a single batch.
 * Strictly based on approved reviews only.
 */
export async function getAllRatingSummaries(): Promise<Record<string, ProviderRatingSummary>> {
  let approvedReviews: { provider_id: string; rating: number }[] = [];

  try {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server.ts");
    const { data, error } = await supabaseAdmin
      .from("reviews")
      .select("provider_id, rating")
      .eq("status", "approved");

    if (error) {
      if (!isTableMissingOrSchemaError(error)) {
        console.error("[reviews.server] Error fetching ratings for all providers:", error);
      }
      return {};
    }
    approvedReviews = (data ?? []) as unknown as { provider_id: string; rating: number }[];
  } catch (e) {
    if (!isTableMissingOrSchemaError(e)) {
      console.error("[reviews.server] Exception fetching ratings for all providers:", e);
    }
    return {};
  }

  const map: Record<string, { sum: number; count: number }> = {};
  for (const r of approvedReviews) {
    const entry = map[r.provider_id] ?? { sum: 0, count: 0 };
    entry.sum += r.rating;
    entry.count += 1;
    map[r.provider_id] = entry;
  }

  const result: Record<string, ProviderRatingSummary> = {};
  for (const [id, stats] of Object.entries(map)) {
    result[id] = {
      count: stats.count,
      average: Math.round((stats.sum / stats.count) * 10) / 10,
    };
  }

  return result;
}

/**
 * Admin: list reviews with status filtering.
 */
export async function adminGetReviews(status?: "pending" | "approved" | "rejected" | "all"): Promise<ReviewRecord[]> {
  try {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server.ts");
    let q = supabaseAdmin.from("reviews").select("*").order("created_at", { ascending: false });
    if (status && status !== "all") {
      q = q.eq("status", status);
    }
    const { data, error } = await q;
    if (error) {
      if (!isTableMissingOrSchemaError(error)) {
        console.error("[reviews.server] Error in adminGetReviews:", error);
      }
      return [];
    }

    const { data: phoneSettings } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .like("key", "rev_sec_%");

    const phoneMap: Record<string, string> = {};
    if (Array.isArray(phoneSettings)) {
      for (const row of phoneSettings) {
        if (row.key && row.value) {
          const revId = row.key.replace("rev_sec_", "");
          const dec = await decryptPhone(row.value);
          if (dec) phoneMap[revId] = dec;
        }
      }
    }

    const list = (data ?? []) as unknown as ReviewRecord[];
    for (const r of list) {
      r.reviewer_phone = (r as any).reviewer_phone || phoneMap[r.id] || null;
    }
    return list;
  } catch (e) {
    if (!isTableMissingOrSchemaError(e)) {
      console.error("[reviews.server] Exception in adminGetReviews:", e);
    }
    return [];
  }
}

/**
 * Admin: moderate review (approve, reject, or delete).
 */
export async function adminModerateReview(
  reviewId: string,
  action: "approve" | "reject" | "delete",
  adminId?: string
): Promise<{ ok: boolean }> {
  try {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server.ts");
    if (action === "delete") {
      const { error } = await supabaseAdmin.from("reviews").delete().eq("id", reviewId);
      if (error) {
        if (!isTableMissingOrSchemaError(error)) {
          console.error("[reviews.server] Error deleting review:", error);
        }
        return { ok: false };
      }
      // Clean up secure phone token
      await supabaseAdmin.from("app_settings").delete().eq("key", `rev_sec_${reviewId}`);
      return { ok: true };
    } else {
      const newStatus = action === "approve" ? "approved" : "rejected";
      const { error } = await supabaseAdmin
        .from("reviews")
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminId || null,
        })
        .eq("id", reviewId);
      if (error) {
        if (!isTableMissingOrSchemaError(error)) {
          console.error("[reviews.server] Error moderating review:", error);
        }
        return { ok: false };
      }
      return { ok: true };
    }
  } catch (e) {
    if (!isTableMissingOrSchemaError(e)) {
      console.error("[reviews.server] Exception in adminModerateReview:", e);
    }
    return { ok: false };
  }
}
