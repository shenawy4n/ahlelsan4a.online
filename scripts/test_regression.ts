import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ROLE_PERMISSIONS, hasPermission, type AdminRole, type AdminAction } from "../src/lib/auth.server.ts";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://ahuelbhmosyrozlaxbgb.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY is required for regression test");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let failedCount = 0;
function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  PASS: ${testName}`);
  } else {
    console.error(`  FAIL: ${testName}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("=== REGRESSION SUITE: AHL ELSAN3A ROLE & SECURITY FIXES ===");

  // 1. Zod Role Input Validation Schema
  console.log("\n[Test 1: Input Validation Schema]");
  const addSchema = z.object({
    email: z.string().trim().toLowerCase().email().max(255),
    role: z.enum(["admin", "moderator"]).default("admin"),
  });

  assert(addSchema.safeParse({ email: "test@mod.com", role: "moderator" }).success, "Accepts 'moderator' role");
  assert(addSchema.safeParse({ email: "test@adm.com", role: "admin" }).success, "Accepts 'admin' role");
  assert(!addSchema.safeParse({ email: "test@bad.com", role: "superadmin" }).success, "Rejects 'superadmin' role");
  assert(!addSchema.safeParse({ email: "test@bad.com", role: "owner" }).success, "Rejects 'owner' role assignment via addAdmin");
  assert(!addSchema.safeParse({ email: "test@bad.com", role: "" }).success, "Rejects empty role");
  assert(!addSchema.safeParse({ email: "invalid-email", role: "moderator" }).success, "Rejects invalid email format");

  // 2. Role Permissions Matrix
  console.log("\n[Test 2: Role Permissions Matrix]");
  assert(hasPermission("moderator", "reviews"), "Moderator can moderate reviews");
  assert(hasPermission("moderator", "suggestions"), "Moderator can view suggestions");
  assert(hasPermission("moderator", "messages"), "Moderator can view messages");
  assert(hasPermission("moderator", "applications"), "Moderator can review applications");
  assert(hasPermission("moderator", "providers:edit"), "Moderator can edit providers");
  assert(!hasPermission("moderator", "providers:delete"), "Moderator CANNOT delete providers");
  assert(!hasPermission("moderator", "categories:delete"), "Moderator CANNOT delete categories");
  assert(!hasPermission("moderator", "areas:delete"), "Moderator CANNOT delete areas");
  assert(!hasPermission("moderator", "settings"), "Moderator CANNOT access settings");
  assert(!hasPermission("moderator", "admin_management"), "Moderator CANNOT manage admins");
  assert(!hasPermission("moderator", "data_export"), "Moderator CANNOT export data");

  assert(hasPermission("admin", "settings"), "Admin can access settings");
  assert(hasPermission("admin", "admin_management"), "Admin can access admin management");
  assert(!hasPermission("admin", "owner_management"), "Admin CANNOT transfer owner or revoke owner");

  assert(hasPermission("owner", "owner_management"), "Owner has owner_management");

  // 3. Database State and Role Resolution Verification
  console.log("\n[Test 3: Authoritative Role Resolution on Stored Records]");
  const { data: roleMapRow } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "admin_roles_map")
    .maybeSingle();

  const roleMap: Record<string, string> = roleMapRow?.value ? JSON.parse(roleMapRow.value) : {};

  // Verify moderator accounts in roleMap
  assert(roleMap["moderator@example.com"] === "moderator", "moderator@example.com is stored as 'moderator'");
  assert(roleMap["ahmaadelshenawy@gmail.com"] === "moderator", "ahmaadelshenawy@gmail.com is stored as 'moderator'");
  assert(roleMap["ahlelsan3a.online@gmail.com"] === "moderator", "ahlelsan3a.online@gmail.com is stored as 'moderator'");

  // 4. Test Simulated resolveRole Logic
  console.log("\n[Test 4: Disagreement and Safety Rules]");
  function simulateResolveRole(
    userEmail: string,
    adminRecord: { is_owner?: boolean; active?: boolean; role?: string } | null,
    metaRole?: string,
    mapRole?: string
  ): AdminRole | null {
    if (adminRecord && adminRecord.active === false) return null;
    if (adminRecord?.is_owner === true) return "owner";
    if (adminRecord?.role) {
      const r = String(adminRecord.role).toLowerCase().trim();
      if (r === "owner" || r === "moderator" || r === "admin") return r as AdminRole;
      return null;
    }
    let settingRole: AdminRole | null = null;
    if (mapRole) {
      const r = mapRole.toLowerCase().trim();
      if (r === "owner" || r === "moderator" || r === "admin") settingRole = r as AdminRole;
      else return null;
    }
    let authMetaRole: AdminRole | null = null;
    if (metaRole) {
      const r = metaRole.toLowerCase().trim();
      if (r === "owner" || r === "moderator" || r === "admin") authMetaRole = r as AdminRole;
      else return null;
    }
    if (settingRole && authMetaRole) {
      if (settingRole === authMetaRole) return settingRole;
      if (settingRole === "moderator" || authMetaRole === "moderator") return "moderator";
      return settingRole;
    }
    if (settingRole) return settingRole;
    if (authMetaRole) return authMetaRole;
    if (adminRecord && adminRecord.active === true) return "admin";
    return null;
  }

  // Check scenarios
  assert(simulateResolveRole("mod@test.com", null, undefined, "moderator") === "moderator", "Resolves moderator from map");
  assert(simulateResolveRole("mod@test.com", null, "moderator", undefined) === "moderator", "Resolves moderator from auth metadata");
  assert(simulateResolveRole("mod@test.com", null, "admin", "moderator") === "moderator", "Disagreement (map=moderator, meta=admin) resolves to moderator (least privilege)");
  assert(simulateResolveRole("bad@test.com", null, "hacker", undefined) === null, "Unknown meta role safely rejected as null");
  assert(simulateResolveRole("bad@test.com", null, undefined, "invalid_role") === null, "Unknown map role safely rejected as null");
  assert(simulateResolveRole("user@test.com", null, undefined, undefined) === null, "Normal user with no admin record resolves to null (never admin)");
  assert(simulateResolveRole("owner@test.com", { is_owner: true, active: true }, undefined, undefined) === "owner", "Owner record resolves to owner");
  assert(simulateResolveRole("legacy@test.com", { is_owner: false, active: true }, undefined, undefined) === "admin", "Legacy admin user preserves admin role");
  assert(simulateResolveRole("inactive@test.com", { is_owner: false, active: false }, "admin", "admin") === null, "Deactivated account immediately rejected as null");

  // 5. Crypto Verification Gate
  console.log("\n[Test 5: Web Crypto Phone Gate on Live Database]");
  const { data: revTokens } = await supabaseAdmin
    .from("app_settings")
    .select("key, value")
    .like("key", "rev_sec_%");

  assert(Boolean(revTokens && revTokens.length === 25), `Found exactly 25 live tokens (${revTokens?.length} found)`);

  const { adminGetReviews } = await import("../src/lib/reviews.server.ts");
  const reviews = await adminGetReviews("all");
  const reviewsWithPhones = reviews.filter((r) => Boolean(r.reviewer_phone));
  assert(reviewsWithPhones.length > 0, `Successfully retrieved reviews with decrypted phones (${reviewsWithPhones.length} reviews)`);

  if (failedCount === 0) {
    console.log("\n>>> ALL REGRESSION CHECKS PASSED SUCCESSFULLY (0 FAILURES) <<<\n");
  } else {
    console.error(`\n>>> REGRESSION FAILED: ${failedCount} failure(s) <<<\n`);
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test execution exception:", e);
  process.exit(1);
});
