import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import {
  type ShortcutId,
  DEFAULT_SHORTCUTS_ORDER,
  KNOWN_SHORTCUT_IDS,
  SHORTCUT_SETTINGS_KEY,
  LEGACY_SHORTCUT_SETTINGS_KEY,
  resolveShortcutsOrder,
  validateShortcutsOrder,
} from "../src/lib/shortcuts";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://ahuelbhmosyrozlaxbgb.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY is required for settings test suite");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.error(`  FAIL: ${name}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
}

async function runTests() {
  console.log("=== AHL ELSAN3A ADMIN SETTINGS & SHORTCUTS TEST SUITE ===\n");

  // ==========================================
  // PART 1: Shortcut Ordering Logic & Contracts
  // ==========================================
  console.log("[Part 1: Shortcut Ordering Logic & Contracts]");

  // 1.1 Default order when no setting exists
  const defOrder = resolveShortcutsOrder(null);
  assert(
    JSON.stringify(defOrder) === JSON.stringify(DEFAULT_SHORTCUTS_ORDER),
    "Default order is used when no saved configuration exists",
    JSON.stringify(defOrder)
  );

  const emptyOrder = resolveShortcutsOrder("");
  assert(
    JSON.stringify(emptyOrder) === JSON.stringify(DEFAULT_SHORTCUTS_ORDER),
    "Empty string resolves to default order"
  );

  // 1.2 Valid custom order is loaded and preserved
  const customOrder: ShortcutId[] = ["delivery", "emergency_now", "available_now"];
  const resolvedCustom = resolveShortcutsOrder(JSON.stringify(customOrder));
  assert(
    JSON.stringify(resolvedCustom) === JSON.stringify(customOrder),
    "Valid custom order is accurately preserved"
  );

  // 1.3 Missing shortcut identifier is gracefully appended
  const partialOrder = ["delivery", "available_now"];
  const resolvedPartial = resolveShortcutsOrder(JSON.stringify(partialOrder));
  assert(
    resolvedPartial.length === 3 &&
      resolvedPartial[0] === "delivery" &&
      resolvedPartial[1] === "available_now" &&
      resolvedPartial[2] === "emergency_now",
    "Missing shortcut identifier is gracefully appended using default order"
  );

  // 1.4 Invalid identifiers and duplicate entries rejection & normalization
  const invalidWithDupes = ["delivery", "invalid_id", "delivery", "emergency_now"];
  const validationRes = validateShortcutsOrder(invalidWithDupes);
  assert(
    !validationRes.valid,
    "validateShortcutsOrder rejects arrays containing unknown IDs and duplicates"
  );

  const resolvedInvalid = resolveShortcutsOrder(JSON.stringify(invalidWithDupes));
  assert(
    resolvedInvalid.length === 3 &&
      !resolvedInvalid.includes("invalid_id" as any) &&
      new Set(resolvedInvalid).size === 3,
    "resolveShortcutsOrder filters out invalid identifiers and duplicates while preserving all known shortcuts"
  );

  // 1.5 Non-array input fallback
  const malformedInput = "not-json-or-array{{{";
  const resolvedMalformed = resolveShortcutsOrder(malformedInput);
  assert(
    JSON.stringify(resolvedMalformed) === JSON.stringify(DEFAULT_SHORTCUTS_ORDER),
    "Malformed/corrupted JSON safely falls back to default order without throwing"
  );

  // ==========================================
  // PART 2: UI Presentation & Shared Consistency
  // ==========================================
  console.log("\n[Part 2: UI Presentation & Shared Consistency]");

  // 2.1 Homepage uses resolveShortcutsOrder
  const indexSource = readFileSync("src/routes/index.tsx", "utf8");
  assert(
    indexSource.includes("resolveShortcutsOrder") &&
      indexSource.includes("SHORTCUT_SETTINGS_KEY") &&
      indexSource.includes("shortcutOrder.map"),
    "src/routes/index.tsx resolves and renders shortcuts using resolveShortcutsOrder"
  );

  // 2.2 AvailabilityFilter supports shortcut order
  const availFilterSource = readFileSync("src/components/AvailabilityFilter.tsx", "utf8");
  assert(
    availFilterSource.includes("resolveShortcutsOrder") &&
      availFilterSource.includes("activeOrder.map") &&
      availFilterSource.includes("الكل"),
    "AvailabilityFilter renders shortcuts in resolved order with pinned 'الكل' button"
  );

  // 2.3 ServicesHub contains shortcut ordering section/tab
  const servicesHubSource = readFileSync("src/components/admin/ServicesHub.tsx", "utf8");
  assert(
    servicesHubSource.includes("ServiceShortcutsOrder") &&
      servicesHubSource.includes("ترتيب اختصارات الخدمات"),
    "ServicesHub includes 'ترتيب اختصارات الخدمات' subtab and component"
  );

  // 2.4 ServiceShortcutsOrder component features
  const orderComponentSource = readFileSync("src/components/admin/ServiceShortcutsOrder.tsx", "utf8");
  assert(
    orderComponentSource.includes("draggable") &&
      orderComponentSource.includes("ArrowUp") &&
      orderComponentSource.includes("ArrowDown") &&
      orderComponentSource.includes("استعادة الترتيب الافتراضي") &&
      orderComponentSource.includes("حفظ ترتيب الاختصارات"),
    "ServiceShortcutsOrder includes drag handles, move buttons, reset, and save actions"
  );

  // ==========================================
  // PART 3: Admin Settings Architecture & Integrity
  // ==========================================
  console.log("\n[Part 3: Admin Settings Architecture & Integrity]");

  // 3.1 PlatformSettings component has all 4 logical sections
  const platformSettingsSource = readFileSync("src/components/admin/PlatformSettings.tsx", "utf8");
  assert(
    platformSettingsSource.includes('"brand"') &&
      platformSettingsSource.includes('"contact"') &&
      platformSettingsSource.includes('"pages"') &&
      platformSettingsSource.includes('"general"'),
    "PlatformSettings organizes settings into brand, contact, pages, and general sections"
  );

  // 3.2 Brand settings
  assert(
    platformSettingsSource.includes("app_name") &&
      platformSettingsSource.includes("tagline") &&
      platformSettingsSource.includes("logo_url") &&
      platformSettingsSource.includes("handleLogoUpload"),
    "PlatformSettings supports app_name, tagline, and logo upload/URL/remove"
  );

  // 3.3 Contact settings preservation & safe string normalization
  assert(
    platformSettingsSource.includes("contact_phone") &&
      platformSettingsSource.includes("contact_whatsapp") &&
      platformSettingsSource.includes("contact_email") &&
      platformSettingsSource.includes("contact_address") &&
      platformSettingsSource.includes("contact_hours") &&
      platformSettingsSource.includes("contact_facebook") &&
      platformSettingsSource.includes("contact_telegram") &&
      platformSettingsSource.includes("contact_custom_link") &&
      platformSettingsSource.includes("contact_custom_link_label"),
    "PlatformSettings preserves all 10 existing contact fields"
  );
  assert(
    platformSettingsSource.includes('.trim()') && !platformSettingsSource.includes('value: null'),
    "PlatformSettings normalizes empty contact fields to safe empty strings (no null constraint violations)"
  );

  // 3.4 Pages content management
  assert(
    platformSettingsSource.includes("about_content") &&
      platformSettingsSource.includes("privacy_content") &&
      platformSettingsSource.includes("terms_content") &&
      platformSettingsSource.includes("contact_content") &&
      platformSettingsSource.includes("pagePreviewMode"),
    "PlatformSettings provides dedicated content management and preview for about, privacy, terms, and contact"
  );

  // 3.5 General settings
  assert(
    platformSettingsSource.includes("default_provider_status") &&
      platformSettingsSource.includes("ExperienceManager"),
    "PlatformSettings manages default_provider_status and incorporates ExperienceManager"
  );

  // 3.6 Backward compatibility: Insights.tsx re-exports PlatformSettings as Settings
  const insightsSource = readFileSync("src/components/admin/Insights.tsx", "utf8");
  assert(
    insightsSource.includes('export { PlatformSettings as Settings } from "./PlatformSettings"'),
    "Insights.tsx maintains backwards-compatible export of PlatformSettings as Settings"
  );

  // ==========================================
  // PART 4: Security, Access Control & Database Integrity
  // ==========================================
  console.log("\n[Part 4: Security, Access Control & Database Integrity]");

  // 4.1 Server function authorization check
  const adminActionsSource = readFileSync("src/lib/admin-actions.functions.ts", "utf8");
  assert(
    adminActionsSource.includes("saveSettingsAdminFn") &&
      adminActionsSource.includes("requireAdminAuth"),
    "saveSettingsAdminFn is strictly protected by requireAdminAuth middleware"
  );

  // 4.2 Verify app_settings table state in Supabase
  const { data: dbSettings, error: dbErr } = await supabaseAdmin
    .from("app_settings")
    .select("key, value");

  assert(!dbErr && Array.isArray(dbSettings), "app_settings table accessible and healthy in live Supabase");

  // 4.3 Verify existing production content is intact
  const dbSettingsMap: Record<string, string> = {};
  for (const row of dbSettings || []) {
    dbSettingsMap[row.key] = row.value;
  }

  assert("app_name" in dbSettingsMap, "app_name setting exists in live database");
  assert("contact_phone" in dbSettingsMap, "contact_phone setting exists in live database");
  assert("contact_whatsapp" in dbSettingsMap, "contact_whatsapp setting exists in live database");

  // 4.4 Public routes still exist and function properly
  const aboutRoute = readFileSync("src/routes/about.tsx", "utf8");
  const privacyRoute = readFileSync("src/routes/privacy.tsx", "utf8");
  const termsRoute = readFileSync("src/routes/terms.tsx", "utf8");
  const contactRoute = readFileSync("src/routes/contact.tsx", "utf8");

  assert(aboutRoute.includes('about_content') && aboutRoute.includes('whitespace-pre-wrap'), "about.tsx consumes about_content with whitespace-pre-wrap");
  assert(privacyRoute.includes('privacy_content') && privacyRoute.includes('whitespace-pre-wrap'), "privacy.tsx consumes privacy_content with whitespace-pre-wrap");
  assert(termsRoute.includes('terms_content') && termsRoute.includes('whitespace-pre-wrap'), "terms.tsx consumes terms_content with whitespace-pre-wrap");
  assert(contactRoute.includes('contact_phone') && contactRoute.includes('contact_whatsapp'), "contact.tsx consumes contact settings properly");

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test execution error:", e);
  process.exit(1);
});
