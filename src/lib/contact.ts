import { telHref, whatsappHref, getCategoryUnit } from "@/lib/directory";
import { contactProviderServerFn } from "@/lib/contact.functions";

export type ContactKind = "phone_click" | "whatsapp_click";
type ContactResult = { phone: string | null; whatsapp: string | null };

export class NoNumberError extends Error {}
export class RateLimitError extends Error {}

const last = new Map<string, number>();
const cache = new Map<string, ContactResult>();

/**
 * Requests contact details securely through the server-side gateway with rate limiting and audit logging.
 * Rapid repeat taps within 3s reuse the cached number without sending unnecessary server calls.
 */
async function contact(providerId: string, kind: ContactKind): Promise<ContactResult | null> {
  const key = `${providerId}:${kind}`;
  const now = Date.now();
  if (now - (last.get(key) ?? 0) < 3000 && cache.has(key)) return cache.get(key)!;
  last.set(key, now);

  const res = await contactProviderServerFn({
    data: {
      providerId,
      kind,
    },
  });

  if (!res.ok) {
    last.delete(key);
    if (res.code === "rate_limited") {
      throw new RateLimitError("rate_limited");
    }
    throw new Error(res.code);
  }

  const row: ContactResult = {
    phone: res.phone,
    whatsapp: res.whatsapp,
  };

  cache.set(key, row);
  return row;
}

/** Opens tel:/wa.me via a real anchor click; target _top escapes embedded previews. */
function open(href: string, newTab = false) {
  const a = document.createElement("a");
  a.href = href;
  a.target = newTab ? "_blank" : "_top";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function callProvider(providerId: string) {
  const r = await contact(providerId, "phone_click");
  const href = telHref(r?.phone ?? "");
  if (!href) throw new NoNumberError();
  open(href);
}

export async function whatsappProvider(providerId: string) {
  const r = await contact(providerId, "whatsapp_click");
  if (!r?.whatsapp) throw new NoNumberError();
  const href = whatsappHref(r.whatsapp);
  if (!href) throw new NoNumberError();
  open(href, true);
}

export type ShareResult = "shared" | "copied" | "cancelled";

export interface ShareProviderData {
  id: string;
  name: string;
  categoryName?: string | null | undefined;
  categoryUnitTitle?: string | null | undefined;
  areaName?: string | null | undefined;
  isEmergency24h?: boolean | undefined;
}

/**
 * Copies text using modern navigator.clipboard or fallback textarea execCommand.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to execCommand below
    }
  }

  try {
    if (typeof document === "undefined") return false;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    textArea.setAttribute("readonly", "");
    document.body.appendChild(textArea);
    textArea.select();
    const successful = document.execCommand("copy");
    textArea.remove();
    return successful;
  } catch {
    return false;
  }
}

/**
 * General device share action using navigator.share with fallback to clipboard copy.
 * Uses the existing profession title resolution hierarchy.
 * Never hardcodes "صنايعي".
 * Excludes private phone numbers or review verification data.
 */
export async function shareProvider(provider: ShareProviderData): Promise<ShareResult> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const profileUrl = `${origin}/provider/${provider.id}`;

  const profession = (provider.categoryUnitTitle && provider.categoryUnitTitle.trim())
    ? provider.categoryUnitTitle.trim()
    : (provider.categoryName && provider.categoryName.trim())
      ? getCategoryUnit(provider.categoryName)
      : "مقدم خدمة";

  const definiteProfession = profession === "مقدم خدمة"
    ? "مقدم الخدمة"
    : profession.startsWith("ال")
      ? profession
      : `ال${profession}`;

  const shareTitle = `${provider.name} — ${profession} | أهل الصنعة`;
  const lines = [
    `${profession} موثوق من «أهل الصنعة»`,
    ``,
    `👤 الاسم: ${provider.name}`,
    provider.categoryName ? `🏷️ التخصص: ${provider.categoryName}` : null,
    provider.areaName ? `📍 المنطقة: ${provider.areaName}` : null,
    provider.isEmergency24h ? `⚡ متاح طوارئ ٢٤ ساعة: نعم` : null,
    ``,
    `🔗 تواصل مع ${definiteProfession} واطلب الخدمة عبر الرابط:`,
    profileUrl,
  ].filter(Boolean);
  const shareText = lines.join("\n");

  // 1. Try Web Share API if supported and available
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: profileUrl,
      });
      return "shared";
    } catch (err: unknown) {
      // AbortError indicates user dismissed/cancelled the native share sheet
      if (err instanceof Error && (err.name === "AbortError" || /abort|cancel/i.test(err.message))) {
        return "cancelled";
      }
      // If Web Share failed for other reasons, fall through to clipboard
    }
  }

  // 2. Reliable clipboard copy fallback
  const copied = await copyToClipboard(profileUrl);
  if (copied) {
    return "copied";
  }

  throw new Error("clipboard_failed");
}

export async function shareProviderViaWhatsapp(provider: ShareProviderData) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const profileUrl = `${origin}/provider/${provider.id}`;

  const profession = (provider.categoryUnitTitle && provider.categoryUnitTitle.trim())
    ? provider.categoryUnitTitle.trim()
    : (provider.categoryName && provider.categoryName.trim())
      ? getCategoryUnit(provider.categoryName)
      : "مقدم خدمة";

  const definiteProfession = profession === "مقدم خدمة"
    ? "مقدم الخدمة"
    : profession.startsWith("ال")
      ? profession
      : `ال${profession}`;

  const lines = [
    `${profession} موثوق من «أهل الصنعة»`,
    ``,
    `👤 الاسم: ${provider.name}`,
    provider.categoryName ? `🏷️ التخصص: ${provider.categoryName}` : null,
    provider.areaName ? `📍 المنطقة: ${provider.areaName}` : null,
    provider.isEmergency24h ? `⚡ متاح طوارئ ٢٤ ساعة: نعم` : null,
    ``,
    `🔗 تواصل مع ${definiteProfession} واطلب الخدمة عبر الرابط:`,
    profileUrl,
    ``,
    `أهل الصنعة — كل صنعة عند أهلها`,
  ].filter(Boolean);
  const text = lines.join("\n");
  open(`https://wa.me/?text=${encodeURIComponent(text)}`, true);
}
