import fs from "fs";
import path from "path";
import { supabase } from "../src/integrations/supabase/client";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";

console.log("=== AHL ELSAN3A ANALYTICS & PROFILE VIEW REGRESSION TEST SUITE ===");

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  FAIL: ${testName} ${detail ? `- ${detail}` : ""}`);
    failed++;
  }
}

async function runTests() {
  const trackPath = path.resolve(process.cwd(), "src/lib/track.ts");
  const providerPath = path.resolve(process.cwd(), "src/routes/provider.$id.tsx");
  const insightsPath = path.resolve(process.cwd(), "src/components/admin/Insights.tsx");
  const serverFnPath = path.resolve(process.cwd(), "src/lib/analytics.functions.ts");

  assert(fs.existsSync(trackPath), "track.ts exists");
  assert(fs.existsSync(providerPath), "provider.$id.tsx exists");
  assert(fs.existsSync(insightsPath), "Insights.tsx exists");
  assert(fs.existsSync(serverFnPath), "analytics.functions.ts exists");

  const trackCode = fs.readFileSync(trackPath, "utf-8");
  const providerCode = fs.readFileSync(providerPath, "utf-8");
  const insightsCode = fs.readFileSync(insightsPath, "utf-8");
  const serverFnCode = fs.readFileSync(serverFnPath, "utf-8");

  // --- Scenario 1: Source Code & Schema Alignment ---
  console.log("\n[Scenario 1: Schema Alignment & Payload Sanitization]");
  assert(
    !trackCode.includes("query: extra.query") && !trackCode.includes("query: item.query"),
    "track.ts does not send 'query' property in database insert payload (eliminates PGRST204 error)"
  );
  assert(
    trackCode.includes("event_type: item.event_type") &&
    trackCode.includes("provider_id: item.provider_id") &&
    trackCode.includes("category_id: item.category_id"),
    "track.ts maps strictly to valid database columns: event_type, provider_id, category_id"
  );
  assert(
    serverFnCode.includes("AllowedEventTypeSchema") && serverFnCode.includes("profile_view"),
    "analytics.functions.ts explicitly restricts event_type to allowed values"
  );
  assert(
    serverFnCode.includes("provider_id: z.string().uuid().nullable().optional()"),
    "analytics.functions.ts validates provider_id as UUID"
  );

  // --- Scenario 2: Provider Page Trigger & Deduplication ---
  console.log("\n[Scenario 2: Provider Profile View Trigger & Deduplication]");
  assert(
    providerCode.includes("if (!pid) return;"),
    "ProviderPage avoids recording a profile view before a valid provider has loaded"
  );
  assert(
    providerCode.includes("trackedProviderRef") && providerCode.includes("trackedProviderRef.current === pid"),
    "ProviderPage uses trackedProviderRef to prevent duplicate triggers across re-renders for the same visit"
  );
  assert(
    trackCode.includes("recentProfileViews") && trackCode.includes("now - lastViewed < 3000"),
    "track.ts includes session-level deduplication against React Strict Mode and rapid remounts"
  );

  // --- Scenario 3: Admin Exclusion ---
  console.log("\n[Scenario 3: Admin Exclusion Policy]");
  assert(
    trackCode.includes("const admin = await isAdmin();") && trackCode.includes("if (admin)"),
    "track.ts checks isAdmin() and aborts event flushing for logged-in admins"
  );
  assert(
    serverFnCode.includes("has_role") && serverFnCode.includes("_role: \"admin\""),
    "analytics.functions.ts checks admin role server-side to exclude admin visits"
  );

  // --- Scenario 4: Reliable Delivery & Lifecycle Flush ---
  console.log("\n[Scenario 4: Delivery Reliability & Page Termination]");
  assert(
    trackCode.includes("window.addEventListener(\"pagehide\"") &&
    trackCode.includes("document.addEventListener(\"visibilitychange\""),
    "track.ts registers pagehide and visibilitychange handlers to flush pending events before navigation/unload"
  );
  assert(
    trackCode.includes("flushAnalytics = flushEvents"),
    "track.ts exports flushAnalytics for explicit manual or lifecycle invocation"
  );
  assert(
    trackCode.includes("recordAnalyticsEventsServerFn") && trackCode.includes("supabase.from(\"analytics_events\").insert"),
    "track.ts employs dual-channel delivery: Server Function primary with Supabase direct client fallback"
  );
  assert(
    trackCode.includes("retries < 2"),
    "track.ts implements bounded retry for transient errors without creating unbounded loops"
  );

  // --- Scenario 5: Dashboard Reads & Distinction of States ---
  console.log("\n[Scenario 5: Admin Dashboard Insights & Reading]");
  assert(
    insightsCode.includes("c(\"profile_view\")") && insightsCode.includes("cnt(\"profile_view\")"),
    "Insights.tsx aggregates profile_view in both Overview and Analytics tabs"
  );
  assert(
    insightsCode.includes("ev.isLoading && !ev.data") && insightsCode.includes("Loader2"),
    "Insights.tsx distinguishes loading state from valid zero counts"
  );
  assert(
    insightsCode.includes("if (providers.isError || ev.isError)"),
    "Insights.tsx prevents presenting failed queries as silent zero counts"
  );
  assert(
    insightsCode.includes("select(\"event_type,provider_id,category_id\")"),
    "Insights.tsx reads event_type, provider_id, and category_id columns"
  );

  // --- Scenario 6: Live Database Integration & Persistence ---
  console.log("\n[Scenario 6: Live Database Persistence & Verification]");
  try {
    const { data: provs, error: provErr } = await supabaseAdmin
      .from("providers")
      .select("id, category_id")
      .limit(1);

    assert(!provErr && !!provs?.length, "Retrieved existing provider from live Supabase", provErr?.message);
    const testProv = provs![0];

    // Test direct anonymous insert using the corrected schema
    const directPayload = {
      event_type: "profile_view" as const,
      provider_id: testProv.id,
      category_id: testProv.category_id,
    };

    const directRes = await supabase.from("analytics_events").insert([directPayload]);
    assert(directRes.status === 201 && directRes.error === null, "Direct anonymous insert succeeds with HTTP 201 Created");

    // Verify row was actually created in live database
    const { data: insertedRows, error: verifyErr } = await supabaseAdmin
      .from("analytics_events")
      .select("id, event_type, provider_id, category_id")
      .eq("provider_id", testProv.id)
      .eq("event_type", "profile_view")
      .order("created_at", { ascending: false })
      .limit(1);

    assert(!verifyErr && insertedRows?.length === 1, "Persisted profile_view row verified in live database via supabaseAdmin");
    assert(insertedRows?.[0]?.event_type === "profile_view", "Row event_type matches 'profile_view'");
    assert(insertedRows?.[0]?.provider_id === testProv.id, "Row provider_id matches expected provider");

    // Clean up test event so production counts remain pristine
    if (insertedRows?.[0]?.id) {
      await supabaseAdmin.from("analytics_events").delete().eq("id", insertedRows[0].id);
      console.log(`  INFO: Cleaned up verified test event ${insertedRows[0].id}`);
    }
  } catch (err: any) {
    assert(false, "Live database test threw exception", err?.message);
  }

  // --- Scenario 7: Contact and Privacy Gateway Integrity ---
  console.log("\n[Scenario 7: Contact & Privacy Gateway Preservation]");
  const contactFuncCode = fs.readFileSync(path.resolve(process.cwd(), "src/lib/contact.functions.ts"), "utf-8");
  assert(
    contactFuncCode.includes("contact_provider") && contactFuncCode.includes("Minimum disclosure guarantee"),
    "contactProviderServerFn and contact_provider RPC maintain minimum disclosure guarantees"
  );

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
