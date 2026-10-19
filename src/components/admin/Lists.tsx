import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Pencil,
  Eye,
  EyeOff,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  ListOrdered,
  RotateCcw,
  Loader2,
  ArrowUpToLine,
  ArrowDownToLine,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CategoryIcon, ICON_NAMES } from "@/components/CategoryIcon";
import { type Category, getCategoryUnit, settingsQuery, getProviderProfessionTitle } from "@/lib/directory";
import { input, btn, useAll } from "./shared";
import { ConfirmModal, type ConfirmState } from "./ConfirmModal";
import { AdminErrorState } from "./AdminErrorState";
import {
  deleteCategoryAdminFn,
  deleteAreaAdminFn,
  deleteExperienceAdminFn,
  saveCategoryProviderOrderAdminFn,
} from "@/lib/admin-actions.functions";

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState("");
  const filtered = ICON_NAMES.filter((n) => !q.trim() || n.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-2 rounded-xl border border-border/80 bg-card/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted-foreground">
          اختر أيقونة للقسم ({ICON_NAMES.length} أيقونة متوفرة)
        </span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث في الأيقونات..."
          className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs max-w-[160px]"
        />
      </div>
      <div className="grid max-h-56 grid-cols-8 gap-1.5 overflow-y-auto p-1 sm:grid-cols-12 rounded-lg bg-background/50 border border-border/40">
        {filtered.map((n) => (
          <button
            type="button"
            key={n}
            title={n}
            onClick={() => onChange(n)}
            className={`grid aspect-square place-items-center rounded-lg transition-transform hover:scale-105 ${
              value === n ? "bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/40" : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
          >
            <CategoryIcon name={n} className="size-5" />
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryProviderOrderModal({
  category,
  allProviders,
  settings,
  onClose,
}: {
  category: Category;
  allProviders: any[];
  settings: Record<string, string | null | undefined>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  // 1. Providers assigned to this category (primary or multi-category)
  const catProviders = useMemo(() => {
    return allProviders.filter((p) => {
      const assigned = Array.isArray(p.assigned_category_ids) && p.assigned_category_ids.length > 0
        ? p.assigned_category_ids
        : (p.category_id ? [p.category_id] : []);
      return assigned.includes(category.id);
    });
  }, [allProviders, category.id]);

  // 2. Initial order from settings
  const initialOrdered = useMemo(() => {
    const rawSaved = settings[`cat_prov_order_${category.id}`];
    let savedIds: string[] = [];
    if (rawSaved) {
      try {
        const parsed = JSON.parse(rawSaved);
        if (Array.isArray(parsed)) savedIds = parsed;
      } catch {
        // ignore malformed
      }
    }

    const map = new Map(catProviders.map((p) => [p.id, p]));
    const list: any[] = [];

    // Add in saved order first
    for (const id of savedIds) {
      const p = map.get(id);
      if (p) {
        list.push(p);
        map.delete(id);
      }
    }

    // Add remaining providers in deterministic default order (premium then newest then id)
    const remaining = Array.from(map.values()).sort((a, b) => {
      const aPrem = a.is_premium ? 1 : 0;
      const bPrem = b.is_premium ? 1 : 0;
      if (aPrem !== bPrem) return bPrem - aPrem;
      const dateDiff = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.id.localeCompare(b.id);
    });

    return [...list, ...remaining];
  }, [catProviders, settings, category.id]);

  const [items, setItems] = useState<any[]>(initialOrdered);

  const move = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    setItems(next);
  };

  const moveToExtremity = (idx: number, toStart: boolean) => {
    if (toStart && idx === 0) return;
    if (!toStart && idx === items.length - 1) return;
    const next = [...items];
    const [moved] = next.splice(idx, 1);
    if (toStart) {
      next.unshift(moved);
    } else {
      next.push(moved);
    }
    setItems(next);
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const providerIds = items.map((p) => p.id);
      await saveCategoryProviderOrderAdminFn({
        data: {
          categoryId: category.id,
          providerIds,
        },
      });
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["homepage-data"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success(`تم حفظ ترتيب صنايعية قسم "${category.name}" بنجاح`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "فشل حفظ الترتيب");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    try {
      await saveCategoryProviderOrderAdminFn({
        data: {
          categoryId: category.id,
          providerIds: [],
        },
      });
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["homepage-data"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success(`تمت استعادة الترتيب التلقائي لقسم "${category.name}"`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "فشل استعادة الترتيب");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="surface w-full max-w-2xl rounded-3xl border border-border p-5 sm:p-6 shadow-xl space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <CategoryIcon name={category.icon} className="size-6" />
            </span>
            <div>
              <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <span>ترتيب صنايعية قسم {category.name}</span>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                  {items.length} صنايعي
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                رتّب الصنايعية داخل هذا القسم مستقلاً. هذا الترتيب يحدد ظهورهم في دليل هذا القسم للمستخدمين.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content list */}
        {items.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground space-y-2">
            <p className="font-bold">لا يوجد صنايعية مسجلين في هذا القسم حالياً.</p>
            <p className="text-xs">سجّل صنايعية في هذا القسم أو حدده كقسم إضافي لهم لتتمكن من ترتيبهم.</p>
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto space-y-2 p-1">
            {items.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-card/70 hover:border-primary/40 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground font-black text-xs shadow-2xs">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-foreground flex items-center gap-2 truncate">
                      <span>{p.name}</span>
                      {p.is_premium ? (
                        <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold">
                          مميز
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {getProviderProfessionTitle(p)} · {p.areas?.name || "المحافظة"} · <span dir="ltr">{p.phone}</span>
                    </p>
                  </div>
                </div>

                {/* Move Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0 || busy}
                    onClick={() => moveToExtremity(idx, true)}
                    title="نقل إلى أول القائمة"
                    aria-label="نقل إلى أول القائمة"
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-25 transition-colors"
                  >
                    <ArrowUpToLine className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === 0 || busy}
                    onClick={() => move(idx, -1)}
                    title="تحريك لأعلى خطوة واحدة"
                    aria-label="تحريك لأعلى"
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-25 transition-colors"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === items.length - 1 || busy}
                    onClick={() => move(idx, 1)}
                    title="تحريك لأسفل خطوة واحدة"
                    aria-label="تحريك لأسفل"
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-25 transition-colors"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === items.length - 1 || busy}
                    onClick={() => moveToExtremity(idx, false)}
                    title="نقل إلى آخر القائمة"
                    aria-label="نقل إلى آخر القائمة"
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-25 transition-colors"
                  >
                    <ArrowDownToLine className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            disabled={busy || items.length === 0}
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
          >
            <RotateCcw className="size-3.5" />
            <span>استعادة الترتيب الافتراضي (التلقائي)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-bold hover:bg-secondary transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={busy || items.length === 0}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-extrabold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-xs"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              <span>حفظ الترتيب</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type CatForm = { id?: string; name: string; icon: string; sort_order: number; status: string; unit_title: string };

export function Categories({
  prefill,
  isModerator,
  onPrefillUsed,
}: {
  prefill?: string | null;
  isModerator?: boolean;
  onPrefillUsed?: () => void;
}) {
  const qc = useQueryClient();
  const { categories, providers } = useAll();
  const settings = useQuery(settingsQuery);
  const rows = categories.data ?? [];
  const [form, setForm] = useState<CatForm | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [orderingCategory, setOrderingCategory] = useState<Category | null>(null);

  if (prefill && !form) {
    setForm({ name: prefill, icon: "Wrench", sort_order: rows.length + 1, status: "active", unit_title: "" });
    onPrefillUsed?.();
  }

  const count = (id: string) =>
    (Array.isArray(providers.data) ? providers.data : []).filter(
      (p) => p.category_id === id || ((p as any).assigned_category_ids && (p as any).assigned_category_ids.includes(id))
    ).length;

  if (categories.isLoading) return <p className="p-8 text-center text-muted-foreground font-bold">جاري تحميل الأقسام...</p>;
  if (categories.isError) return <AdminErrorState title="تعذر تحميل الأقسام" error={categories.error} onRetry={() => categories.refetch()} />;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !form.name.trim()) return;
    const trimmedName = form.name.trim();
    const row: any = { name: trimmedName, icon: form.icon, sort_order: Number(form.sort_order) || 0, status: form.status };
    
    let savedId = form.id;
    if (form.id) {
      const { error } = await supabase.from("categories").update(row).eq("id", form.id);
      if (error) { toast.error(error.message.includes("duplicate") ? "الاسم موجود بالفعل" : error.message); return; }
    } else {
      const { data, error } = await supabase.from("categories").insert(row).select("id").single();
      if (error) { toast.error(error.message.includes("duplicate") ? "الاسم موجود بالفعل" : error.message); return; }
      savedId = data?.id;
    }

    // Save custom unit into app_settings (cat_unit_{id})
    if (savedId) {
      const customUnit = form.unit_title.trim();
      const settingKey = `cat_unit_${savedId}`;
      if (customUnit) {
        await supabase.from("app_settings").upsert({ key: settingKey, value: customUnit, updated_at: new Date().toISOString() });
      } else {
        await supabase.from("app_settings").delete().eq("key", settingKey);
      }
    }

    try {
      const { invalidateCategoryCacheServerFn } = await import("@/lib/directory.functions");
      await invalidateCategoryCacheServerFn();
    } catch {
      // Non-blocking
    }

    toast.success("تم حفظ القسم بنجاح");
    setForm(null);
    qc.invalidateQueries();
  }

  function deleteCategory(c: Category) {
    const cnt = count(c.id);
    if (cnt > 0) {
      toast.error(`لا يمكن حذف قسم "${c.name}" لوجود ${cnt} صنايعي مسجلين به. يمكنك إخفاؤه بدلاً من ذلك أو نقل الصنايعية.`);
      return;
    }
    setConfirmState({
      open: true,
      title: "تأكيد حذف القسم",
      description: `هل أنت متأكد من حذف قسم "${c.name}" نهائياً؟ لن يمكن التراجع بعد الحذف.`,
      confirmLabel: "نعم، احذف القسم",
      destructive: true,
      onConfirm: async () => {
        try {
          const res = await deleteCategoryAdminFn({ data: { id: c.id } });
          if (!(res as any)?.ok) {
            toast.error((res as any)?.message || "تعذر حذف القسم");
            return;
          }
          toast.success(`تم حذف قسم "${c.name}" بنجاح`);
          qc.invalidateQueries();
        } catch (err: any) {
          toast.error(err.message || "حدث خطأ أثناء الحذف");
        }
      },
    });
  }

  async function move(c: Category, dir: -1 | 1) {
    const i = rows.findIndex((r) => r.id === c.id);
    const other = rows[i + dir];
    if (!other) return;
    await supabase.from("categories").update({ sort_order: other.sort_order }).eq("id", c.id);
    await supabase.from("categories").update({ sort_order: c.sort_order === other.sort_order ? c.sort_order + dir : c.sort_order }).eq("id", other.id);
    qc.invalidateQueries();
  }

  async function toggle(c: Category) {
    const { error } = await supabase.from("categories").update({ status: c.status === "active" ? "hidden" : "active" }).eq("id", c.id);
    if (error) toast.error(error.message);
    qc.invalidateQueries();
  }

  if (form) {
    const detectedUnit = getCategoryUnit(form.name);
    return (
      <form onSubmit={save} className="surface grid gap-3 p-5">
        <h2 className="text-xl font-extrabold">{form.id ? "تعديل قسم" : "إضافة قسم"}</h2>
        <div className="flex items-center gap-3">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CategoryIcon name={form.icon} className="size-7" /></span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم القسم (مثال: طب، تعليم، سباك، نجار)" maxLength={60} required className={input} />
        </div>

        <label className="grid gap-1 text-sm font-bold">
          مسمى مقدم الخدمة / اللقب
          <input
            value={form.unit_title}
            onChange={(e) => setForm({ ...form, unit_title: e.target.value })}
            placeholder={`تلقائي حالياً: ${detectedUnit} (مثلاً: طبيب، مدرس، مهندس، فني)`}
            className={input}
            maxLength={40}
          />
          <span className="text-xs text-muted-foreground">
            يظهر في الصفحة الرئيسية على شكل: «متاح ١ {form.unit_title.trim() || detectedUnit}». يُستنتج تلقائياً مسمى المهنة لكل تخصص (مثل «كهربائي»، «سباك»، «طبيب»)، والافتراضي العام «مقدم خدمة».
          </span>
        </label>

        <p className="text-sm font-bold">اختار الأيقونة</p>
        <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-sm font-bold">ترتيب العرض<input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className={input} /></label>
          <label className="grid gap-1 text-sm font-bold">الحالة<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={input}><option value="active">مفعل</option><option value="hidden">مخفي</option></select></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className={btn}>حفظ</button>
          <button type="button" onClick={() => setForm(null)} className="rounded-xl border border-border py-3 font-bold">إلغاء</button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-3">
      <button onClick={() => setForm({ name: "", icon: "Wrench", sort_order: rows.length + 1, status: "active", unit_title: "" })} className={btn}>+ إضافة قسم جديد</button>
      {rows.map((c, i) => {
        const customUnit = settings.data?.[`cat_unit_${c.id}`] ?? c.unit_title;
        const currentUnit = getCategoryUnit(c.name, customUnit);
        const cnt = count(c.id);
        return (
          <div key={c.id} className="surface flex items-center gap-3 p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CategoryIcon name={c.icon} className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-bold flex items-center gap-2">
                <span>{c.name}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-bold">
                  {currentUnit}
                </span>
                {c.status !== "active" ? <span className="text-xs text-destructive">(مخفي)</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">{cnt} مسجل · ترتيب {c.sort_order}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setOrderingCategory(c)}
                className="flex items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-all shadow-2xs"
                title={`ترتيب صنايعية قسم ${c.name}`}
              >
                <ListOrdered className="size-3.5" />
                <span>ترتيب الصنايعية ({cnt})</span>
              </button>

              <div className="flex items-center gap-0.5 border-r border-border pr-1">
                <button aria-label="لأعلى" title="لأعلى" disabled={i === 0} onClick={() => move(c, -1)} className="rounded-lg p-2 hover:bg-secondary disabled:opacity-30"><ArrowUp className="size-4" /></button>
                <button aria-label="لأسفل" title="لأسفل" disabled={i === rows.length - 1} onClick={() => move(c, 1)} className="rounded-lg p-2 hover:bg-secondary disabled:opacity-30"><ArrowDown className="size-4" /></button>
                <button
                  aria-label="تعديل"
                  title="تعديل"
                  onClick={() => setForm({
                    id: c.id,
                    name: c.name,
                    icon: c.icon ?? "Wrench",
                    sort_order: c.sort_order,
                    status: c.status,
                    unit_title: customUnit ?? "",
                  })}
                  className="rounded-lg p-2 hover:bg-secondary"
                >
                  <Pencil className="size-5" />
                </button>
                <button aria-label="إخفاء/إظهار" title="إخفاء/إظهار" onClick={() => toggle(c)} className="rounded-lg p-2 hover:bg-secondary">
                  {c.status === "active" ? <EyeOff className="size-5" /> : <Eye className="size-5 text-muted-foreground" />}
                </button>
                {!isModerator && (
                  <button
                    aria-label="حذف"
                    title={cnt > 0 ? "لا يمكن الحذف لوجود صنايعية" : "حذف القسم"}
                    onClick={() => deleteCategory(c)}
                    className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {confirmState ? <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} /> : null}
      {orderingCategory ? (
        <CategoryProviderOrderModal
          category={orderingCategory}
          allProviders={providers.data ?? []}
          settings={settings.data ?? {}}
          onClose={() => setOrderingCategory(null)}
        />
      ) : null}
    </div>
  );
}

export function Areas({ isModerator }: { isModerator?: boolean } = {}) {
  const qc = useQueryClient();
  const { areas, providers } = useAll();
  const rows = areas.data ?? [];
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const count = (id: string) => (Array.isArray(providers.data) ? providers.data : []).filter((p) => p.area_id === id).length;

  if (areas.isLoading) return <p className="p-8 text-center text-muted-foreground font-bold">جاري تحميل المناطق...</p>;
  if (areas.isError) return <AdminErrorState title="تعذر تحميل المناطق" error={areas.error} onRetry={() => areas.refetch()} />;

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("areas").insert({ name: name.trim() });
    if (error) { toast.error(error.message.includes("duplicate") ? "الاسم موجود بالفعل" : error.message); return; }
    setName("");
    qc.invalidateQueries();
  }

  async function saveEdit() {
    if (!edit?.name.trim()) return;
    const { error } = await supabase.from("areas").update({ name: edit.name.trim() }).eq("id", edit.id);
    if (error) toast.error(error.message);
    setEdit(null);
    qc.invalidateQueries();
  }

  async function toggle(id: string, status: string) {
    const { error } = await supabase.from("areas").update({ status: status === "active" ? "hidden" : "active" }).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries();
  }

  function deleteArea(id: string, areaName: string) {
    const cnt = count(id);
    if (cnt > 0) {
      toast.error(`لا يمكن حذف منطقة "${areaName}" لوجود ${cnt} صنايعي مسجلين بها. يمكنك إخفاؤها أو تعديل منطقة الصنايعية أولاً.`);
      return;
    }
    setConfirmState({
      open: true,
      title: "تأكيد حذف المنطقة",
      description: `هل أنت متأكد من حذف منطقة "${areaName}" نهائياً؟`,
      confirmLabel: "نعم، احذف المنطقة",
      destructive: true,
      onConfirm: async () => {
        try {
          const res = await deleteAreaAdminFn({ data: { id } });
          if (!(res as any)?.ok) {
            toast.error((res as any)?.message || "تعذر حذف المنطقة");
            return;
          }
          toast.success(`تم حذف منطقة "${areaName}" بنجاح`);
          qc.invalidateQueries();
        } catch (err: any) {
          toast.error(err.message || "حدث خطأ أثناء الحذف");
        }
      },
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم منطقة أو قرية جديدة" maxLength={60} className={input} />
        <button onClick={add} className={`${btn} shrink-0`}>إضافة</button>
      </div>
      {rows.map((r) => {
        const cnt = count(r.id);
        return (
          <div key={r.id} className="surface flex items-center justify-between p-3">
            {edit?.id === r.id ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  className={input}
                  autoFocus
                />
                <button aria-label="حفظ" onClick={saveEdit} className="rounded-lg p-2 text-primary hover:bg-secondary">
                  <Check className="size-5" />
                </button>
                <button aria-label="إلغاء" onClick={() => setEdit(null)} className="rounded-lg p-2 hover:bg-secondary">
                  <X className="size-5" />
                </button>
              </div>
            ) : (
              <>
                <div>
                  <p className="font-bold">{r.name} {r.status !== "active" ? <span className="text-xs text-destructive">(مخفي)</span> : null}</p>
                  <p className="text-xs text-muted-foreground">{cnt} صنايعي مسجل</p>
                </div>
                <div className="flex gap-1">
                  <button aria-label="تعديل" title="تعديل" onClick={() => setEdit({ id: r.id, name: r.name })} className="rounded-lg p-2 hover:bg-secondary"><Pencil className="size-5" /></button>
                  <button aria-label="إخفاء/إظهار" title="إخفاء/إظهار" onClick={() => toggle(r.id, r.status)} className="rounded-lg p-2 hover:bg-secondary">{r.status === "active" ? <EyeOff className="size-5" /> : <Eye className="size-5 text-muted-foreground" />}
                  </button>
                  {!isModerator && (
                    <button
                      aria-label="حذف"
                      title={cnt > 0 ? "لا يمكن الحذف لوجود صنايعية" : "حذف المنطقة"}
                      onClick={() => deleteArea(r.id, r.name)}
                      className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-5" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
      {confirmState ? <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} /> : null}
    </div>
  );
}

export function ExperienceManager() {
  const qc = useQueryClient();
  const { experience } = useAll();
  const rows = experience.data ?? [];
  const [label, setLabel] = useState("");
  const [edit, setEdit] = useState<{ id: string; label: string } | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const done = () => qc.invalidateQueries();

  if (experience.isLoading) return <p className="p-8 text-center text-muted-foreground font-bold">جاري تحميل خيارات سنوات الخبرة...</p>;
  if (experience.isError) return <AdminErrorState title="تعذر تحميل خيارات سنوات الخبرة" error={experience.error} onRetry={() => experience.refetch()} />;

  async function add() {
    if (!label.trim()) return;
    const max = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
    const { error } = await supabase.from("experience_options").insert({ label: label.trim(), sort_order: max + 1 });
    if (error) { toast.error(error.message); return; }
    setLabel("");
    done();
  }
  async function saveEdit() {
    if (!edit?.label.trim()) return;
    await supabase.from("experience_options").update({ label: edit.label.trim() }).eq("id", edit.id);
    setEdit(null);
    done();
  }
  async function move(i: number, dir: -1 | 1) {
    const a = rows[i], b = rows[i + dir];
    if (!a || !b) return;
    await supabase.from("experience_options").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("experience_options").update({ sort_order: a.sort_order === b.sort_order ? a.sort_order + dir : a.sort_order }).eq("id", b.id);
    done();
  }
  function del(id: string, optLabel: string) {
    setConfirmState({
      open: true,
      title: "تأكيد حذف خيار الخبرة",
      description: `هل أنت متأكد من حذف خيار "${optLabel}"؟ الصنايعية المرتبطين بهذا الخيار ستصبح خبرتهم غير محددة دون حذف بياناتهم.`,
      confirmLabel: "نعم، احذف",
      destructive: true,
      onConfirm: async () => {
        try {
          const res = await deleteExperienceAdminFn({ data: { id } });
          if (!(res as any)?.ok) {
            toast.error((res as any)?.message || "تعذر حذف خيار الخبرة");
            return;
          }
          toast.success("تم الحذف بنجاح");
          done();
        } catch (err: any) {
          toast.error(err.message || "حدث خطأ أثناء الحذف");
        }
      },
    });
  }
  async function toggle(id: string, status: string) {
    await supabase.from("experience_options").update({ status: status === "active" ? "hidden" : "active" }).eq("id", id);
    done();
  }

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="مثال: 3 - 5 سنوات" maxLength={40} className={input} />
        <button onClick={add} className={`${btn} shrink-0`}>إضافة</button>
      </div>
      {rows.map((r, i) => (
        <div key={r.id} className="surface flex items-center gap-2 p-2.5">
          {edit?.id === r.id ? (
            <>
              <input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} className={input} />
              <button aria-label="حفظ" onClick={saveEdit} className="rounded-lg p-2 text-primary"><Check className="size-5" /></button>
              <button aria-label="إلغاء" onClick={() => setEdit(null)} className="rounded-lg p-2"><X className="size-5" /></button>
            </>
          ) : (
            <>
              <p className="flex-1 font-bold">{r.label} {r.status !== "active" ? <span className="text-xs text-destructive">(غير مفعل)</span> : null}</p>
              <button aria-label="لأعلى" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-lg p-2 disabled:opacity-30"><ArrowUp className="size-4" /></button>
              <button aria-label="لأسفل" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="rounded-lg p-2 disabled:opacity-30"><ArrowDown className="size-4" /></button>
              <button aria-label="تعديل" onClick={() => setEdit({ id: r.id, label: r.label })} className="rounded-lg p-2"><Pencil className="size-4" /></button>
              <button aria-label="تفعيل/إلغاء" onClick={() => toggle(r.id, r.status)} className="rounded-lg p-2">{r.status === "active" ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
              <button aria-label="حذف" onClick={() => del(r.id, r.label)} className="rounded-lg p-2 text-destructive"><Trash2 className="size-4" /></button>
            </>
          )}
        </div>
      ))}
      {confirmState ? <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} /> : null}
    </div>
  );
}
