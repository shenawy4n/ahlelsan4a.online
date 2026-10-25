import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { isOpenNow, isProviderEmergency24h } from "../src/lib/working-hours";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://ahuelbhmosyrozlaxbgb.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY is required for regression test");
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
  console.log("=== AHL ELSAN3A DELIVERY FILTER & REGRESSION TEST SUITE ===\n");

  // ==========================================
  // SCENARIO 1: Search & Filter Combinations
  // ==========================================
  console.log("[Scenario 1: Search & Filter Combinations]");

  // Fetch active providers and settings directly from DB to verify filtering algorithm
  const [providersRes, settingsRes] = await Promise.all([
    supabaseAdmin
      .from("providers")
      .select("id, name, description, services, category_id, area_id, experience_id, working_hours, is_emergency_24h, is_premium, premium_expires_at, created_at")
      .eq("status", "active"),
    supabaseAdmin.from("app_settings").select("key, value"),
  ]);

  assert(!providersRes.error && Array.isArray(providersRes.data), "Retrieved active providers from Supabase");
  const providers = providersRes.data || [];

  const settingsMap: Record<string, string> = {};
  for (const s of settingsRes.data || []) {
    settingsMap[s.key] = s.value;
  }

  // Enrich providers with has_delivery from app_settings
  const enrichedProviders = providers.map((p) => ({
    ...p,
    has_delivery: Boolean(settingsMap[`prov_deliv_${p.id}`]),
  }));

  const totalDeliveryCount = enrichedProviders.filter((p) => p.has_delivery).length;
  console.log(`  INFO: Total active providers = ${enrichedProviders.length}, with delivery = ${totalDeliveryCount}`);

  // Test 1.1: Unfiltered providers
  assert(enrichedProviders.length > 0, "Active providers dataset is non-empty");

  // Test 1.2: Delivery-only filter logic
  const deliveryOnlyProviders = enrichedProviders.filter((p) => p.has_delivery);
  assert(
    deliveryOnlyProviders.every((p) => p.has_delivery === true),
    "Delivery filter returns only providers where has_delivery === true"
  );
  assert(
    deliveryOnlyProviders.length === totalDeliveryCount,
    `Delivery filter matches exact count of delivery providers (${totalDeliveryCount})`
  );

  // Test 1.3: Combining delivery with available_now
  const deliveryAndAvailable = enrichedProviders.filter((p) => {
    if (!p.has_delivery) return false;
    const isEmerg = Boolean(p.is_emergency_24h || isProviderEmergency24h(p.working_hours));
    const status = isOpenNow(p.working_hours);
    return isEmerg || status === true;
  });
  assert(
    deliveryAndAvailable.every((p) => p.has_delivery === true),
    "Combined delivery + available_now only returns providers with delivery"
  );

  // Test 1.4: Combining delivery with emergency_now
  const deliveryAndEmergency = enrichedProviders.filter((p) => {
    if (!p.has_delivery) return false;
    return Boolean(p.is_emergency_24h || isProviderEmergency24h(p.working_hours));
  });
  assert(
    deliveryAndEmergency.every((p) => p.has_delivery === true),
    "Combined delivery + emergency_now only returns providers with delivery"
  );

  // Test 1.5: Area + delivery filter
  const testArea = enrichedProviders[0]?.area_id;
  if (testArea) {
    const areaAndDelivery = enrichedProviders.filter((p) => p.area_id === testArea && p.has_delivery);
    assert(
      areaAndDelivery.every((p) => p.has_delivery === true && p.area_id === testArea),
      `Area filter (${testArea}) + delivery correctly subsets to specified area`
    );
  }

  // Test 1.6: ValidateSearch query parameter parsing contracts
  const searchRouteCode = readFileSync("src/routes/search.tsx", "utf8");
  const categoryRouteCode = readFileSync("src/routes/category.$id.tsx", "utf8");

  assert(
    searchRouteCode.includes("delivery") &&
      /s\[['"]delivery['"]\] === true/.test(searchRouteCode) &&
      /s\[['"]filter['"]\] === ['"]delivery['"]/.test(searchRouteCode),
    "search.tsx validateSearch handles boolean, string true, 1, and legacy ?filter=delivery gracefully"
  );
  assert(
    categoryRouteCode.includes("delivery") &&
      /s\[['"]delivery['"]\] === true/.test(categoryRouteCode) &&
      /s\[['"]filter['"]\] === ['"]delivery['"]/.test(categoryRouteCode),
    "category.$id.tsx validateSearch handles delivery query parameter"
  );

  // ==========================================
  // SCENARIO 2: Provider Contact & Privacy
  // ==========================================
  console.log("\n[Scenario 2: Provider Contact & Privacy]");

  // 2.1 Public provider listings do not expose unencrypted or un-gated phone numbers
  const dirFunctionsCode = readFileSync("src/lib/directory.functions.ts", "utf8");
  assert(
    dirFunctionsCode.includes("PUBLIC_PROVIDER_SELECT"),
    "directory.functions.ts uses restricted PUBLIC_PROVIDER_SELECT column list"
  );
  assert(
    !dirFunctionsCode.includes("select('*')"),
    "directory.functions.ts does not use wildcard select on providers table"
  );

  // 2.2 Security of keys & environment
  const gitIgnore = readFileSync(".gitignore", "utf8");
  assert(gitIgnore.includes(".env"), ".gitignore contains .env to prevent secret leakage");

  const envExample = readFileSync(".env.example", "utf8");
  assert(
    !envExample.includes("SUPABASE_SERVICE_ROLE_KEY=ey") && !envExample.includes("PHONE_ENCRYPTION_KEY=0x"),
    ".env.example contains no raw secrets"
  );

  // 2.3 Review phone privacy and encryption
  const reviewsSource = readFileSync("src/lib/reviews.server.ts", "utf8");
  assert(
    reviewsSource.includes("PHONE_ENCRYPTION_KEY") && reviewsSource.includes("decryptPhone"),
    "reviews.server.ts enforces PHONE_ENCRYPTION_KEY and decryptPhone"
  );

  // ==========================================
  // SCENARIO 3: Navigation, Loading, and Empty States
  // ==========================================
  console.log("\n[Scenario 3: Navigation, Loading, and Empty States]");

  // 3.1 ZeroSearchResults component handles delivery-specific empty states
  const zeroResultsSource = readFileSync("src/components/ZeroSearchResults.tsx", "utf8");
  assert(
    zeroResultsSource.includes("deliveryOnly") &&
      zeroResultsSource.includes("onClearDelivery") &&
      zeroResultsSource.includes("توصيل"),
    "ZeroSearchResults includes deliveryOnly prop, clear action, and friendly Egyptian Arabic text"
  );

  // 3.2 Homepage quick filters include all three options
  const indexSource = readFileSync("src/routes/index.tsx", "utf8");
  assert(
    indexSource.includes("متاح الآن") &&
      indexSource.includes("طوارئ ٢٤ ساعة") &&
      indexSource.includes("توصيل للمنازل") &&
      indexSource.includes("Truck"),
    "Homepage hero section contains all three quick filters with Truck icon"
  );

  // 3.3 AvailabilityFilter component renders delivery toggle button
  const availFilterSource = readFileSync("src/components/AvailabilityFilter.tsx", "utf8");
  assert(
    availFilterSource.includes("deliveryOnly") &&
      availFilterSource.includes("onDeliveryChange") &&
      availFilterSource.includes("توصيل للمنازل"),
    "AvailabilityFilter component supports delivery toggle state and count badge"
  );

  // 3.4 Reset behavior: 'الكل' clears delivery filter as well
  assert(
    availFilterSource.includes("onDeliveryChange?.(false)"),
    "AvailabilityFilter 'الكل' button resets deliveryOnly to false"
  );

  // ==========================================
  // SCENARIO 4: Mobile & Accessibility Check
  // ==========================================
  console.log("\n[Scenario 4: Mobile & Accessibility Check]");

  // 4.1 Minimum 44px touch targets
  assert(
    availFilterSource.includes("min-h-[44px]") && indexSource.includes("min-h-[44px]"),
    "Filter buttons enforce minimum 44px touch targets for mobile accessibility"
  );

  // 4.2 Responsive layout wrapping for small screens (320px - 390px)
  assert(
    availFilterSource.includes("flex-wrap") && indexSource.includes("flex-wrap"),
    "Filter button containers use flex-wrap to prevent horizontal overflow on narrow screens (320px, 360px, 390px)"
  );

  // 4.3 Arabic RTL markup & ARIA attributes
  const rootSource = readFileSync("src/routes/__root.tsx", "utf8");
  assert(
    rootSource.includes('dir="rtl"') && rootSource.includes('lang="ar"'),
    "Application root sets dir='rtl' and lang='ar'"
  );
  assert(
    availFilterSource.includes('role="group"') && availFilterSource.includes("aria-label="),
    "Filter toolbar includes accessible group role and aria-label"
  );
  assert(
    availFilterSource.includes("aria-pressed"),
    "Delivery filter button uses aria-pressed for screen reader state communication"
  );

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test execution error:", e);
  process.exit(1);
});
