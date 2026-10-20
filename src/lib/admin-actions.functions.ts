import { createServerFn } from "@tanstack/react-start";
import { requireAdminAuth, requireModeratorAuth } from "./auth-middleware";
import { PROVIDER_SELECT, PUBLIC_PROVIDER_SELECT, type ProviderWithRefs } from "./directory";

/** Fetch all providers with full details (Admin & Moderator only) */
export const getAdminProvidersServerFn = createServerFn({ method: "GET" })
  .middleware([requireModeratorAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    let { data, error } = await supabaseAdmin
      .from("providers")
      .select(PROVIDER_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      // Fallback if column-level security blocks sensitive columns
      const fallback = await supabaseAdmin
        .from("providers")
        .select(PUBLIC_PROVIDER_SELECT)
        .order("created_at", { ascending: false });

      if (!fallback.error && Array.isArray(fallback.data)) {
        data = fallback.data as any;
      } else {
        console.error("[getAdminProvidersServerFn error]", error);
        throw new Response(
          JSON.stringify({ ok: false, message: error.message || "Failed to load providers" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const { data: unitSettings } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .or("key.like.cat_unit_%,key.like.prov_unit_%,key.like.prov_cats_%,key.like.prov_deliv_%,key.like.prov_portfolio_%");
    const unitsMap: Record<string, string> = {};
    const provUnitsMap: Record<string, string> = {};
    const provCatsMap: Record<string, string[]> = {};
    const provDelivMap: Record<string, boolean> = {};
    const provPortfolioMap: Record<string, string> = {};
    for (const u of (unitSettings ?? []) as { key: string; value: string }[]) {
      if (u.key && u.value) {
        if (u.key.startsWith("cat_unit_")) {
          unitsMap[u.key] = u.value;
        } else if (u.key.startsWith("prov_unit_")) {
          provUnitsMap[u.key] = u.value;
        } else if (u.key.startsWith("prov_cats_")) {
          try {
            const parsed = JSON.parse(u.value);
            if (Array.isArray(parsed)) {
              provCatsMap[u.key] = parsed;
            }
          } catch {
            // ignore malformed
          }
        } else if (u.key.startsWith("prov_deliv_")) {
          provDelivMap[u.key] = u.value === "true" || u.value === "1";
        } else if (u.key.startsWith("prov_portfolio_")) {
          provPortfolioMap[u.key] = u.value.trim();
        }
      }
    }
    const list = (data ?? []) as unknown as ProviderWithRefs[];
    for (const p of list) {
      const catId = (p as any).category_id || (p as any).categories?.id;
      const customUnit = catId ? unitsMap[`cat_unit_${catId}`]?.trim() : undefined;
      if ((p as any).categories) {
        (p as any).categories.unit_title = customUnit || (p as any).categories.unit_title || null;
      }
      p.profession_title = provUnitsMap[`prov_unit_${p.id}`]?.trim() || null;
      p.portfolio_url = provPortfolioMap[`prov_portfolio_${p.id}`]?.trim() || null;
      (p as any).assigned_category_ids =
        provCatsMap[`prov_cats_${p.id}`] || ((p as any).category_id ? [(p as any).category_id] : []);
      p.has_delivery = Boolean(provDelivMap[`prov_deliv_${p.id}`]);
    }
    return list;
  });

function normalizeArabicCategory(str: string): string {
  return str
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // remove tashkeel & tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ى]/g, "ي")
    .replace(/[ة]/g, "ه")
    .replace(/[ؤئ]/g, "ء")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Delete one or multiple providers (Admin only) */
export const deleteProvidersAdminFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d: { ids: string[] }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    if (!data.ids || data.ids.length === 0) {
      throw new Response(
        JSON.stringify({ ok: false, message: "لا يوجد معرفات محددة للحذف" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Delete reviews, reports, and custom settings associated with providers
    await Promise.all([
      supabaseAdmin.from("reviews").delete().in("provider_id", data.ids),
      supabaseAdmin.from("reports").delete().in("provider_id", data.ids),
      supabaseAdmin.from("app_settings").delete().in("key", data.ids.map((id) => `prov_unit_${id}`)),
      supabaseAdmin.from("app_settings").delete().in("key", data.ids.map((id) => `prov_cats_${id}`)),
      supabaseAdmin.from("app_settings").delete().in("key", data.ids.map((id) => `prov_deliv_${id}`)),
      supabaseAdmin.from("app_settings").delete().in("key", data.ids.map((id) => `prov_portfolio_${id}`)),
    ]);

    const { error } = await supabaseAdmin.from("providers").delete().in("id", data.ids);
    if (error) {
      throw new Response(
        JSON.stringify({ ok: false, message: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const { invalidateCategoryUnitsCache } = await import("./directory.functions");
      invalidateCategoryUnitsCache();
    } catch {
      // non-blocking
    }

    return { ok: true as const, count: data.ids.length };
  });

/** Delete category with safety check on referenced providers (Admin only) */
export const deleteCategoryAdminFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    // Check if category has any providers
    const { count } = await supabaseAdmin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .eq("category_id", data.id);

    if (count && count > 0) {
      throw new Response(
        JSON.stringify({
          ok: false,
          message: `لا يمكن حذف هذا القسم لأنه يحتوي على ${count} صنايعي مسجل. يرجى نقلهم لقسم آخر أو إخفاء القسم بدلاً من حذفه.`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Clean up custom unit setting if exists
    await supabaseAdmin.from("app_settings").delete().eq("key", `cat_unit_${data.id}`);

    const { error } = await supabaseAdmin.from("categories").delete().eq("id", data.id);
    if (error) {
      throw new Response(
        JSON.stringify({ ok: false, message: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return { ok: true as const };
  });

/** Delete area with safety check on referenced providers (Admin only) */
export const deleteAreaAdminFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .eq("area_id", data.id);

    if (count && count > 0) {
      throw new Response(
        JSON.stringify({
          ok: false,
          message: `لا يمكن حذف هذه المنطقة لأنها تحتوي على ${count} صنايعي مسجل. يرجى نقلهم لمنطقة أخرى أو إخفاء المنطقة.`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { error } = await supabaseAdmin.from("areas").delete().eq("id", data.id);
    if (error) {
      throw new Response(
        JSON.stringify({ ok: false, message: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return { ok: true as const };
  });

/** Delete experience option safely by nullifying provider references first (Admin only) */
export const deleteExperienceAdminFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    await supabaseAdmin
      .from("providers")
      .update({ experience_id: null })
      .eq("experience_id", data.id);

    const { error } = await supabaseAdmin.from("experience_options").delete().eq("id", data.id);
    if (error) {
      throw new Response(
        JSON.stringify({ ok: false, message: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return { ok: true as const };
  });

/** Delete review (Admin only) */
export const deleteReviewAdminFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("reviews").delete().eq("id", data.id);
    if (error) {
      throw new Response(
        JSON.stringify({ ok: false, message: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return { ok: true as const };
  });

/** Delete contact message (Admin only) */
export const deleteMessageAdminFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("service_suggestions").delete().eq("id", data.id);
    if (error) {
      throw new Response(
        JSON.stringify({ ok: false, message: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return { ok: true as const };
  });

/** Get all service suggestions (Admin & Moderator) */
export const getSuggestionsAdminFn = createServerFn({ method: "GET" })
  .middleware([requireModeratorAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("service_suggestions")
      .select("id, name, status, created_at")
      .not("name", "ilike", "[رسالة تواصل]%")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getSuggestionsAdminFn error]", error);
      throw new Response(
        JSON.stringify({ ok: false, message: error.message || "Failed to load suggestions" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return (data ?? []) as {
      id: string;
      name: string;
      status: string;
      created_at: string;
    }[];
  });

/** Get single service suggestion detail (Admin & Moderator) */
export const getSuggestionDetailAdminFn = createServerFn({ method: "POST" })
  .middleware([requireModeratorAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    const { data: suggestion, error } = await supabaseAdmin
      .from("service_suggestions")
      .select("id, name, status, created_at")
      .eq("id", data.id)
      .maybeSingle();

    if (error) {
      console.error("[getSuggestionDetailAdminFn error]", error);
      throw new Response(
        JSON.stringify({ ok: false, message: error.message || "Failed to load suggestion detail" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!suggestion) {
      throw new Response(
        JSON.stringify({ ok: false, message: "الاقتراح غير موجود" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    return suggestion;
  });

/** Update service suggestion status (Admin & Moderator) */
export const updateSuggestionStatusAdminFn = createServerFn({ method: "POST" })
  .middleware([requireModeratorAuth])
  .validator((d: { id: string; status: "new" | "approved" | "rejected" | "dismissed" }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("service_suggestions")
      .update({ status: data.status })
      .eq("id", data.id);

    if (error) {
      throw new Response(
        JSON.stringify({ ok: false, message: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return { ok: true as const };
  });

/** Approve service suggestion and create category as inactive for review (Admin & Moderator) */
export const approveSuggestionAndCreateCategoryAdminFn = createServerFn({ method: "POST" })
  .middleware([requireModeratorAuth])
  .validator((d: { id: string; categoryName: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    const raw = data.categoryName || "";
    // Clean name: strip control characters, collapse whitespace, limit to 50 characters
    const cleanName = raw
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50);

    if (cleanName.length < 2) {
      throw new Response(
        JSON.stringify({ ok: false, message: "اسم القسم المقترح قصير جداً (حرفان على الأقل)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const normInput = normalizeArabicCategory(cleanName);

    // 1. Check for normalized duplicate among all existing categories
    const { data: allCategories, error: listErr } = await supabaseAdmin
      .from("categories")
      .select("id, name");

    if (listErr) {
      throw new Response(
        JSON.stringify({ ok: false, message: listErr.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const existingMatch = (allCategories ?? []).find(
      (c) => normalizeArabicCategory(c.name) === normInput
    );

    if (existingMatch) {
      throw new Response(
        JSON.stringify({
          ok: false,
          message: `يوجد قسم بنفس الاسم بالفعل («${existingMatch.name}»)`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Determine highest sort_order
    const { data: topOrder } = await supabaseAdmin
      .from("categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (topOrder?.sort_order ?? 0) + 1;

    // 3. Insert category as inactive for review
    const { error: catErr } = await supabaseAdmin
      .from("categories")
      .insert({
        name: cleanName,
        icon: "Wrench",
        sort_order: nextOrder,
        status: "inactive",
      });

    if (catErr) {
      throw new Response(
        JSON.stringify({ ok: false, message: catErr.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Mark suggestion as approved
    const { error: suggErr } = await supabaseAdmin
      .from("service_suggestions")
      .update({ status: "approved" })
      .eq("id", data.id);

    if (suggErr) {
      throw new Response(
        JSON.stringify({ ok: false, message: suggErr.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return { ok: true as const, name: cleanName };
  });

/** Delete service suggestion (Admin only) */
export const deleteSuggestionAdminFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("service_suggestions")
      .delete()
      .eq("id", data.id);

    if (error) {
      throw new Response(
        JSON.stringify({ ok: false, message: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return { ok: true as const };
  });

/** Fetch pending provider applications / recommendations (Moderator & Admin) */
export const getAdminApplicationsServerFn = createServerFn({ method: "GET" })
  .middleware([requireModeratorAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("provider_applications")
      .select("id,name,phone,whatsapp,description,services,created_at,categories(name),areas(name)")
      .eq("status", "pending")
      .order("created_at");

    if (error) {
      throw new Response(
        JSON.stringify({ ok: false, message: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return (data ?? []) as any[];
  });

/** Approve or reject provider application / recommendation (Moderator & Admin) */
export const actApplicationAdminFn = createServerFn({ method: "POST" })
  .middleware([requireModeratorAuth])
  .validator((d: { id: string; approve: boolean; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    const { normalizeEgPhone } = await import("./directory");

    const { data: app, error: appErr } = await supabaseAdmin
      .from("provider_applications")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    if (appErr || !app) {
      throw new Response(
        JSON.stringify({ ok: false, message: "طلب الترشيح غير موجود في النظام" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (app.status !== "pending") {
      throw new Response(
        JSON.stringify({ ok: false, message: `الطلب تمت معالجته بالفعل (الحالة: ${app.status})` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const a = app as any;

    if (data.approve) {
      const normPhone = normalizeEgPhone(a.phone);
      if (!normPhone) {
        throw new Response(
          JSON.stringify({ ok: false, message: "رقم الهاتف غير صالح" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      const normWa = a.whatsapp ? normalizeEgPhone(a.whatsapp) : null;
      const normSec = a.secondary_phone ? normalizeEgPhone(a.secondary_phone) : null;

      // Check if phone already active
      const { data: existing } = await supabaseAdmin
        .from("providers")
        .select("id, phone, secondary_phone")
        .eq("status", "active");

      const isDupe = (existing ?? []).some(
        (p) =>
          normalizeEgPhone(p.phone) === normPhone ||
          (p.secondary_phone && normalizeEgPhone(p.secondary_phone) === normPhone)
      );

      if (isDupe) {
        throw new Response(
          JSON.stringify({ ok: false, message: "يوجد صنايعي نشط بنفس رقم الهاتف بالفعل" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Insert provider
      const { data: newProv, error: insErr } = await supabaseAdmin
        .from("providers")
        .insert({
          name: a.name,
          phone: normPhone,
          secondary_phone: normSec,
          whatsapp: normWa,
          has_whatsapp: Boolean(normWa),
          category_id: a.category_id,
          area_id: a.area_id,
          experience_id: a.experience_id || null,
          description: a.description || null,
          services: a.services || null,
          price_description: a.price_description || null,
          working_hours: a.working_hours || null,
          photo_url: a.photo_url || null,
          is_emergency_24h: Boolean(a.is_emergency_24h),
          has_workshop: Boolean(a.has_workshop),
          workshop_name: a.workshop_name || null,
          workshop_address: a.workshop_address || null,
          status: "active",
        })
        .select("id")
        .single();

      if (insErr) {
        throw new Response(
          JSON.stringify({ ok: false, message: insErr.message || "تعذر إضافة الصنايعي" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      // Mark application approved
      await supabaseAdmin
        .from("provider_applications")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: context.userId,
          provider_id: newProv?.id || null,
        })
        .eq("id", data.id);

      return { ok: true as const, providerId: newProv?.id };
    } else {
      const reason = data.reason?.trim() || "تم رفض الطلب بواسطة الإدارة";
      const { error: rejErr } = await supabaseAdmin
        .from("provider_applications")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
          reviewed_by: context.userId,
        })
        .eq("id", data.id);

      if (rejErr) {
        throw new Response(
          JSON.stringify({ ok: false, message: rejErr.message || "تعذر رفض الطلب" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return { ok: true as const };
    }
  });

/** Save platform & contact settings (Admin only) */
export const saveSettingsAdminFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d: { rows: Array<{ key: string; value: string | null }> }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    if (!data.rows || !Array.isArray(data.rows) || data.rows.length === 0) {
      throw new Response(
        JSON.stringify({ ok: false, message: "لا توجد إعدادات للحفظ" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const payload = data.rows.map((r) => ({
      key: String(r.key).trim(),
      value: r.value !== null && r.value !== undefined ? String(r.value).trim() : "",
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin.from("app_settings").upsert(payload);

    if (error) {
      console.error("[saveSettingsAdminFn error]", error);
      throw new Response(
        JSON.stringify({ ok: false, message: error.message || "فشل حفظ الإعدادات" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const { invalidateCategoryUnitsCache } = await import("./directory.functions");
      invalidateCategoryUnitsCache();
    } catch {
      // non-blocking
    }

    return { ok: true as const, count: payload.length };
  });

/** Save category-specific provider order (Admin only) */
export const saveCategoryProviderOrderAdminFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d: { categoryId: string; providerIds: string[] }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    if (!data.categoryId) {
      throw new Response(
        JSON.stringify({ ok: false, message: "معرف القسم مطلوب" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const key = `cat_prov_order_${data.categoryId.trim()}`;
    const value = JSON.stringify(Array.isArray(data.providerIds) ? data.providerIds : []);

    const { error } = await supabaseAdmin.from("app_settings").upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[saveCategoryProviderOrderAdminFn error]", error);
      throw new Response(
        JSON.stringify({ ok: false, message: error.message || "فشل حفظ ترتيب الصنايعية" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const { invalidateCategoryUnitsCache } = await import("./directory.functions");
      invalidateCategoryUnitsCache();
    } catch {
      // non-blocking
    }

    return { ok: true as const };
  });



