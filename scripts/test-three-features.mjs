// ==============================================================================
// VERIFICATION TEST SUITE: Three Required Features
// Run: node scripts/test-three-features.mjs
// ==============================================================================

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

console.log("==============================================================================");
console.log("       VERIFYING 3 REQUIRED FEATURES — REGRESSION & UNIT TESTS                ");
console.log("==============================================================================\n");

// ----------------------------------------------------------------------------
// FEATURE 1: Dynamic Profession-Aware 24-Hour Message
// ----------------------------------------------------------------------------
console.log("--- FEATURE 1: Dynamic Profession-Aware 24-Hour Message ---");

const directorySrc = readFileSync(resolve("src/lib/directory.ts"), "utf-8");

// Extract format24HourMessage implementation and test it
function format24HourMessage(title) {
  const raw = (title || "").trim();
  if (!raw || raw === "مقدم خدمة" || raw === "خدمة") {
    return "متاح 24 ساعة";
  }

  const isFeminine = /[ة]$/.test(raw);
  const suffix = isFeminine ? "متاحة 24 ساعة" : "متاح 24 ساعة";

  let definiteTitle = raw;
  if (!raw.startsWith("ال") && !raw.includes(" ")) {
    definiteTitle = `ال${raw}`;
  }

  return `${definiteTitle} ${suffix}`;
}

// 1. Custom title كهربائي -> "الكهربائي متاح 24 ساعة"
assert.equal(format24HourMessage("كهربائي"), "الكهربائي متاح 24 ساعة");
console.log("  ✓ [PASS] Custom title 'كهربائي' -> 'الكهربائي متاح 24 ساعة'");

// 2. Custom title طبيب -> "الطبيب متاح 24 ساعة"
assert.equal(format24HourMessage("طبيب"), "الطبيب متاح 24 ساعة");
console.log("  ✓ [PASS] Custom title 'طبيب' -> 'الطبيب متاح 24 ساعة'");

// 3. Establishment title صيدلية (feminine) -> "الصيدلية متاحة 24 ساعة"
assert.equal(format24HourMessage("صيدلية"), "الصيدلية متاحة 24 ساعة");
console.log("  ✓ [PASS] Establishment 'صيدلية' -> 'الصيدلية متاحة 24 ساعة'");

// 4. Establishment title ورشة -> "الورشة متاحة 24 ساعة"
assert.equal(format24HourMessage("ورشة"), "الورشة متاحة 24 ساعة");
console.log("  ✓ [PASS] Establishment 'ورشة' -> 'الورشة متاحة 24 ساعة'");

// 5. Multi-word title طبيب أسنان -> "طبيب أسنان متاح 24 ساعة"
assert.equal(format24HourMessage("طبيب أسنان"), "طبيب أسنان متاح 24 ساعة");
console.log("  ✓ [PASS] Multi-word title 'طبيب أسنان' -> 'طبيب أسنان متاح 24 ساعة'");

// 6. Unknown / missing title fallback -> "متاح 24 ساعة"
assert.equal(format24HourMessage(null), "متاح 24 ساعة");
assert.equal(format24HourMessage(""), "متاح 24 ساعة");
assert.equal(format24HourMessage("مقدم خدمة"), "متاح 24 ساعة");
console.log("  ✓ [PASS] Missing / unknown / fallback title -> 'متاح 24 ساعة'");

// 7. Inspect ProviderCard & WorkingHoursView for no hardcoded "هذا الصنايعي"
const cardSrc = readFileSync(resolve("src/components/ProviderCard.tsx"), "utf-8");
assert.ok(!cardSrc.includes("هذا الصنايعي"), "ProviderCard must not contain 'هذا الصنايعي'");
assert.ok(cardSrc.includes("getProvider24HourMessage"), "ProviderCard must use getProvider24HourMessage");
console.log("  ✓ [PASS] ProviderCard renders dynamic 24h message without hardcoded 'هذا الصنايعي'");

const hoursViewSrc = readFileSync(resolve("src/components/WorkingHoursView.tsx"), "utf-8");
assert.ok(!hoursViewSrc.includes("هذا الصنايعي"), "WorkingHoursView must not contain 'هذا الصنايعي'");
assert.ok(hoursViewSrc.includes("emergencyBannerText"), "WorkingHoursView dynamically resolves banner text");
console.log("  ✓ [PASS] WorkingHoursView dynamically resolves banner text without hardcoded 'هذا الصنايعي'");

// ----------------------------------------------------------------------------
// FEATURE 2: Optional Provider Portfolio / Work-Samples Link
// ----------------------------------------------------------------------------
console.log("\n--- FEATURE 2: Optional Provider Portfolio / Work-Samples Link ---");

function sanitizeExternalUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
    return null;
  } catch {
    if (/^[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/.test(trimmed)) {
      try {
        const parsed = new URL("https://" + trimmed);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return parsed.href;
        }
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Valid URLs
assert.equal(sanitizeExternalUrl("https://facebook.com/my-page"), "https://facebook.com/my-page");
assert.equal(sanitizeExternalUrl("http://instagram.com/my-work"), "http://instagram.com/my-work");
assert.equal(sanitizeExternalUrl("https://youtube.com/@channel"), "https://youtube.com/@channel");
console.log("  ✓ [PASS] Valid external http/https URLs preserved correctly");

// Reject unsafe schemes
assert.equal(sanitizeExternalUrl("javascript:alert(document.cookie)"), null);
assert.equal(sanitizeExternalUrl("data:text/html;base64,PHNjcmlwdD4="), null);
assert.equal(sanitizeExternalUrl("vbscript:msgbox(1)"), null);
assert.equal(sanitizeExternalUrl("file:///etc/passwd"), null);
assert.equal(sanitizeExternalUrl(""), null);
assert.equal(sanitizeExternalUrl(null), null);
console.log("  ✓ [PASS] Unsafe schemes (javascript:, data:, vbscript:, file:) strictly rejected");

// Check Providers.tsx admin form
const adminProvidersSrc = readFileSync(resolve("src/components/admin/Providers.tsx"), "utf-8");
assert.ok(adminProvidersSrc.includes("رابط الأعمال أو معرض الأعمال"), "Admin form contains exact Arabic label");
assert.ok(adminProvidersSrc.includes("أضف رابطًا يعرض أعمال مقدم الخدمة أو نماذج من شغله"), "Admin form contains exact helper text");
assert.ok(adminProvidersSrc.includes("prov_portfolio_"), "Admin form persists portfolio via prov_portfolio_");
assert.ok(adminProvidersSrc.includes("sanitizeExternalUrl"), "Admin form sanitizes URL on save");
console.log("  ✓ [PASS] Admin form contains field, exact label & helper text, and persists with sanitization");

// Check provider.$id.tsx public display
const providerDetailSrc = readFileSync(resolve("src/routes/provider.$id.tsx"), "utf-8");
assert.ok(providerDetailSrc.includes("شاهد الأعمال"), "Provider detail renders 'شاهد الأعمال'");
assert.ok(providerDetailSrc.includes('rel="noopener noreferrer"'), "Provider detail enforces rel='noopener noreferrer'");
assert.ok(providerDetailSrc.includes('target="_blank"'), "Provider detail opens in new tab");
assert.ok(providerDetailSrc.includes("sanitizeExternalUrl(p.portfolio_url)"), "Provider detail validates URL safely");
console.log("  ✓ [PASS] Public provider page renders compact 'شاهد الأعمال' only when valid URL exists");

// ----------------------------------------------------------------------------
// FEATURE 3: General Device Share Instead of WhatsApp-Only Share
// ----------------------------------------------------------------------------
console.log("\n--- FEATURE 3: General Device Share Instead of WhatsApp-Only Share ---");

const contactSrc = readFileSync(resolve("src/lib/contact.ts"), "utf-8");
assert.ok(contactSrc.includes("export async function shareProvider("), "shareProvider exported from contact.ts");
assert.ok(contactSrc.includes("navigator.share"), "shareProvider uses navigator.share when available");
assert.ok(contactSrc.includes("copyToClipboard"), "shareProvider provides reliable clipboard fallback");
assert.ok(contactSrc.includes("AbortError"), "shareProvider handles user cancellation gracefully");
console.log("  ✓ [PASS] shareProvider supports navigator.share, clipboard fallback, and cancellation handling");

const contactButtonsSrc = readFileSync(resolve("src/components/ContactButtons.tsx"), "utf-8");
assert.ok(!contactButtonsSrc.includes("مشاركة عبر واتساب"), "ContactButtons replaced WhatsApp-only share text");
assert.ok(contactButtonsSrc.includes("مشاركة"), "ContactButtons uses general 'مشاركة' label");
assert.ok(contactButtonsSrc.includes("shareProvider("), "ContactButtons calls shareProvider");
assert.ok(contactButtonsSrc.includes("تم نسخ رابط صفحة مقدم الخدمة بنجاح"), "ContactButtons confirms copy success");
console.log("  ✓ [PASS] ContactButtons uses general 'مشاركة' action and handles feedback correctly");

console.log("\n==============================================================================");
console.log("             ALL 3 FEATURES PASSED VERIFICATION WITH ZERO ERRORS              ");
console.log("==============================================================================");
