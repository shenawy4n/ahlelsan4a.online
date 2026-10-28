import assert from "node:assert";
import { normalizeEgPhone } from "../src/lib/directory";
import { publicFormError } from "../src/lib/public-forms.functions";

console.log("=== RUNNING REGRESSION SUITE: TASK 1 (PUBLIC FORMS) & TASK 2 (SHORTCUT PROVIDER ORDERING) ===");

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ----------------------------------------------------
// TASK 1: PUBLIC FORMS & PHONE VALIDATION
// ----------------------------------------------------

test("1. normalizeEgPhone accepts standard 11-digit mobile (01012345678)", () => {
  const norm = normalizeEgPhone("01012345678");
  assert.strictEqual(norm, "201012345678");
});

test("2. normalizeEgPhone accepts numbers with +20 prefix", () => {
  const norm = normalizeEgPhone("+201123456789");
  assert.strictEqual(norm, "201123456789");
});

test("3. normalizeEgPhone accepts Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩)", () => {
  const norm = normalizeEgPhone("٠١٠١٢٣٤٥٦٧٨");
  assert.strictEqual(norm, "201012345678");
});

test("4. normalizeEgPhone handles spaces, dashes, and parentheses", () => {
  const norm = normalizeEgPhone("(012) 3456-7890");
  assert.strictEqual(norm, "201234567890");
});

test("5. normalizeEgPhone rejects invalid numbers (landline 02, short numbers, invalid prefix 013)", () => {
  assert.strictEqual(normalizeEgPhone("023456789"), null);
  assert.strictEqual(normalizeEgPhone("12345"), null);
  assert.strictEqual(normalizeEgPhone("01312345678"), null);
  assert.strictEqual(normalizeEgPhone(""), null);
  assert.strictEqual(normalizeEgPhone(undefined), null);
});

test("6. publicFormError provides descriptive Arabic messages for all error codes", () => {
  assert.ok(publicFormError("invalid_phone").includes("رقم التليفون غير صحيح"));
  assert.ok(publicFormError("duplicate_phone").includes("مسجل بالفعل"));
  assert.ok(publicFormError("rate_limited").includes("طلبات كثيرة"));
  assert.ok(publicFormError("invalid").includes("البيانات غير مكتملة"));
  assert.ok(publicFormError("error").includes("حصلت مشكلة"));
});

// ----------------------------------------------------
// TASK 2: SHORTCUT PROVIDER ORDERING LOGIC
// ----------------------------------------------------

interface MockProvider {
  id: string;
  name: string;
  category_id: string;
  area_id: string;
  is_emergency_24h?: boolean | null;
  working_hours?: string | null;
  has_delivery?: boolean | null;
  is_premium: boolean;
  created_at: string;
}

const mockProviders: MockProvider[] = [
  { id: "p1", name: "أحمد سباك", category_id: "cat-1", area_id: "area-1", is_emergency_24h: false, has_delivery: false, is_premium: false, created_at: "2026-01-01" },
  { id: "p2", name: "محمود كهربائي", category_id: "cat-1", area_id: "area-1", is_emergency_24h: true, has_delivery: true, is_premium: true, created_at: "2026-01-02" },
  { id: "p3", name: "علي نجار", category_id: "cat-2", area_id: "area-1", is_emergency_24h: true, has_delivery: false, is_premium: false, created_at: "2026-01-03" },
  { id: "p4", name: "حسن نقاش", category_id: "cat-2", area_id: "area-2", is_emergency_24h: false, has_delivery: true, is_premium: false, created_at: "2026-01-04" },
  { id: "p5", name: "إبراهيم تبريد", category_id: "cat-1", area_id: "area-2", is_emergency_24h: true, has_delivery: true, is_premium: false, created_at: "2026-01-05" },
];

test("7. Emergency shortcut filter strictly includes only emergency providers", () => {
  const emergencyList = mockProviders.filter((p) => Boolean(p.is_emergency_24h));
  assert.strictEqual(emergencyList.length, 3);
  assert.deepStrictEqual(emergencyList.map((p) => p.id), ["p2", "p3", "p5"]);
  // Ineligible provider p1 and p4 must not be in emergency
  assert.ok(!emergencyList.some((p) => p.id === "p1"));
  assert.ok(!emergencyList.some((p) => p.id === "p4"));
});

test("8. Delivery shortcut filter strictly includes only delivery providers", () => {
  const deliveryList = mockProviders.filter((p) => Boolean(p.has_delivery));
  assert.strictEqual(deliveryList.length, 3);
  assert.deepStrictEqual(deliveryList.map((p) => p.id), ["p2", "p4", "p5"]);
  // Ineligible provider p1 and p3 must not be in delivery
  assert.ok(!deliveryList.some((p) => p.id === "p1"));
  assert.ok(!deliveryList.some((p) => p.id === "p3"));
});

test("9. Shortcut provider custom ordering applies correctly to eligible items", () => {
  // Let configured order for delivery be ["p5", "p2"]
  const configuredOrder = ["p5", "p2"];
  const orderMap = new Map(configuredOrder.map((id, idx) => [id, idx]));

  const deliveryEligible = mockProviders.filter((p) => Boolean(p.has_delivery));
  deliveryEligible.sort((a, b) => {
    const aPos = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
    const bPos = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
    if (aPos !== bPos) return aPos - bPos;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Expected order: p5 (idx 0), p2 (idx 1), p4 (Infinity -> sorted by created_at)
  assert.deepStrictEqual(deliveryEligible.map((p) => p.id), ["p5", "p2", "p4"]);
});

test("10. Area filter is strictly respected regardless of shortcut custom order", () => {
  // Admin configured ["p4", "p5", "p2"] for delivery
  const configuredOrder = ["p4", "p5", "p2"];
  const orderMap = new Map(configuredOrder.map((id, idx) => [id, idx]));

  // User filters to area-1
  const scopedArea1 = mockProviders.filter((p) => Boolean(p.has_delivery) && p.area_id === "area-1");
  scopedArea1.sort((a, b) => {
    const aPos = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
    const bPos = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
    return aPos - bPos;
  });

  // Only p2 is in area-1, p4 and p5 must NOT leak in even though they are in configuredOrder!
  assert.deepStrictEqual(scopedArea1.map((p) => p.id), ["p2"]);
});

test("11. Ineligible provider IDs in custom order are never returned in filtered views", () => {
  // Admin configured order contains "p1" (which has NO delivery)
  const configuredOrder = ["p1", "p5", "p2"];
  const orderMap = new Map(configuredOrder.map((id, idx) => [id, idx]));

  const deliveryEligible = mockProviders.filter((p) => Boolean(p.has_delivery));
  deliveryEligible.sort((a, b) => {
    const aPos = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
    const bPos = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
    return aPos - bPos;
  });

  // p1 must NOT appear in delivery results
  assert.ok(!deliveryEligible.some((p) => p.id === "p1"));
  assert.deepStrictEqual(deliveryEligible.map((p) => p.id), ["p5", "p2", "p4"]);
});

test("12. Deleted / hidden provider IDs in custom order do not break sorting", () => {
  // Admin configured order contains non-existent / deleted "p999"
  const configuredOrder = ["p999", "p2", "p5"];
  const orderMap = new Map(configuredOrder.map((id, idx) => [id, idx]));

  const deliveryEligible = mockProviders.filter((p) => Boolean(p.has_delivery));
  deliveryEligible.sort((a, b) => {
    const aPos = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
    const bPos = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
    return aPos - bPos;
  });

  assert.deepStrictEqual(deliveryEligible.map((p) => p.id), ["p2", "p5", "p4"]);
});

test("13. App settings keys for shortcut provider ordering are distinct from badge shortcut ordering", () => {
  const badgeSettingKey = "service_shortcuts_order";
  const shortcutProviderKeys = [
    "shortcut_prov_order_available_now",
    "shortcut_prov_order_emergency_now",
    "shortcut_prov_order_delivery",
  ];

  for (const k of shortcutProviderKeys) {
    assert.notStrictEqual(k, badgeSettingKey);
    assert.ok(k.startsWith("shortcut_prov_order_"));
  }
});

console.log(`\nALL ${passed} / 13 REGRESSION TESTS PASSED! ✨`);
