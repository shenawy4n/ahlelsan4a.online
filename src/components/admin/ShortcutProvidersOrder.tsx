import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Save,
  RotateCcw,
  Search,
  Filter,
  Truck,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Phone,
  MapPin,
  Tag,
} from "lucide-react";
import { settingsQuery, isPremiumActive, type ProviderWithRefs } from "@/lib/directory";
import { isProviderEmergency24h, isOpenNow } from "@/lib/working-hours";
import { useAll, input } from "./shared";
import { saveShortcutProviderOrderAdminFn } from "@/lib/admin-actions.functions";

type ShortcutKey = "available_now" | "emergency_now" | "delivery";

interface ShortcutMeta {
  key: ShortcutKey;
  label: string;
  badgeLabel: string;
  icon: typeof Zap;
  color: string;
  description: string;
  eligibilityRule: string;
}

const SHORTCUTS: ShortcutMeta[] = [
  {
    key: "available_now",
    label: "متاح الآن",
    badgeLabel: "متاح الآن",
    icon: Clock,
    color: "bg-success/15 text-success border-success/30",
    description: "قائمة الصنايعية المتاحين للعمل حالياً ومواعيدهم مفتوحة أو يقدمون طوارئ ٢٤ ساعة.",
    eligibilityRule: "يظهر في الترتيب الصنايعية أصحاب المواعيد المفتوحة أو الطوارئ، يليهم باقي الصنايعية.",
  },
  {
    key: "emergency_now",
    label: "طوارئ ٢٤ ساعة",
    badgeLabel: "خدمة طوارئ ٢٤ ساعة",
    icon: Zap,
    color: "bg-warning/15 text-warning border-warning/30",
    description: "قائمة الصنايعية المفعل لديهم خدمة طوارئ ٢٤ ساعة فقط (لا يظهر غيرهم مطلقاً).",
    eligibilityRule: "الصنايعية المفعّل لديهم خيار الطوارئ ٢٤ ساعة في بياناتهم فقط.",
  },
  {
    key: "delivery",
    label: "توصيل للمنازل",
    badgeLabel: "توصيل للمنازل",
    icon: Truck,
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    description: "قائمة مقدمي الخدمات والصنايعية الذين يوفرون خدمة التوصيل للمنازل فقط.",
    eligibilityRule: "الصنايعية ومقدمو الخدمات المفعّل لديهم خيار التوصيل للمنازل فقط.",
  },
];

export function ShortcutProvidersOrder() {
  const qc = useQueryClient();
  const { providers, categories, areas } = useAll();
  const settings = useQuery(settingsQuery);

  const [activeShortcut, setActiveShortcut] = useState<ShortcutKey>("available_now");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [busy, setBusy] = useState(false);

  // Settings map
  const rawSettings = settings.data || {};

  // All active providers
  const allActiveProviders = useMemo(() => {
    const list = Array.isArray(providers.data) ? providers.data : [];
    return list.filter((p) => p.status === "active");
  }, [providers.data]);

  // Determine eligible providers for the selected shortcut
  const eligibleProviders = useMemo(() => {
    if (activeShortcut === "emergency_now") {
      return allActiveProviders.filter(
        (p) => Boolean(p.is_emergency_24h || isProviderEmergency24h(p.working_hours))
      );
    }
    if (activeShortcut === "delivery") {
      return allActiveProviders.filter((p) => {
        const flag = Boolean((p as any).has_delivery || rawSettings[`prov_deliv_${p.id}`] === "true");
        return flag;
      });
    }
    // "available_now": All active providers eligible, but open/emergency ones prioritized in preview
    return allActiveProviders;
  }, [allActiveProviders, activeShortcut, rawSettings]);

  // Saved order from settings
  const savedIds = useMemo(() => {
    const raw = rawSettings[`shortcut_prov_order_${activeShortcut}`];
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [rawSettings, activeShortcut]);

  // Merge saved order with remaining eligible providers
  const initialOrderedList = useMemo(() => {
    const map = new Map(eligibleProviders.map((p) => [p.id, p]));
    const list: ProviderWithRefs[] = [];

    // Add items that exist in savedIds first
    for (const id of savedIds) {
      const p = map.get(id);
      if (p) {
        list.push(p);
        map.delete(id);
      }
    }

    // Append remaining eligible providers using default deterministic tiebreaker
    const remaining = Array.from(map.values()).sort((a, b) => {
      const aPrem = isPremiumActive(a) ? 1 : 0;
      const bPrem = isPremiumActive(b) ? 1 : 0;
      if (aPrem !== bPrem) return bPrem - aPrem;
      const dateDiff = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.id.localeCompare(b.id);
    });

    return [...list, ...remaining];
  }, [eligibleProviders, savedIds]);

  // Local state for reordering
  const [orderedItems, setOrderedItems] = useState<ProviderWithRefs[]>([]);

  // Synchronize when shortcut or underlying data changes
  useEffect(() => {
    setOrderedItems(initialOrderedList);
  }, [initialOrderedList]);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (orderedItems.length !== initialOrderedList.length) return true;
    for (let i = 0; i < orderedItems.length; i++) {
      if (orderedItems[i].id !== initialOrderedList[i].id) return true;
    }
    return false;
  }, [orderedItems, initialOrderedList]);

  // Move helpers
  const move = (currentIdx: number, direction: -1 | 1) => {
    const targetIdx = currentIdx + direction;
    if (targetIdx < 0 || targetIdx >= orderedItems.length) return;
    const next = [...orderedItems];
    const [item] = next.splice(currentIdx, 1);
    next.splice(targetIdx, 0, item);
    setOrderedItems(next);
  };

  const moveToExtreme = (currentIdx: number, toTop: boolean) => {
    if (toTop && currentIdx === 0) return;
    if (!toTop && currentIdx === orderedItems.length - 1) return;
    const next = [...orderedItems];
    const [item] = next.splice(currentIdx, 1);
    if (toTop) {
      next.unshift(item);
    } else {
      next.push(item);
    }
    setOrderedItems(next);
  };

  // Save handler
  const handleSave = async () => {
    setBusy(true);
    try {
      const providerIds = orderedItems.map((p) => p.id);
      await saveShortcutProviderOrderAdminFn({
        data: {
          shortcutId: activeShortcut,
          providerIds,
        },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["settings"] }),
        qc.invalidateQueries({ queryKey: ["providers"] }),
        qc.invalidateQueries({ queryKey: ["homepage-data"] }),
        qc.invalidateQueries({ queryKey: ["admin"] }),
      ]);
      toast.success(`تم حفظ ترتيب صنايعية اختصار «${SHORTCUTS.find((s) => s.key === activeShortcut)?.label}» بنجاح`);
    } catch (err: any) {
      toast.error(err?.message || "فشل حفظ الترتيب");
    } finally {
      setBusy(false);
    }
  };

  // Reset handler (revert to automatic default ranking)
  const handleResetToDefault = async () => {
    if (!confirm("هل أنت متأكد من استعادة الترتيب التلقائي وإلغاء الترتيب المخصص لهذا الاختصار؟")) {
      return;
    }
    setBusy(true);
    try {
      await saveShortcutProviderOrderAdminFn({
        data: {
          shortcutId: activeShortcut,
          providerIds: [],
        },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["settings"] }),
        qc.invalidateQueries({ queryKey: ["providers"] }),
        qc.invalidateQueries({ queryKey: ["homepage-data"] }),
        qc.invalidateQueries({ queryKey: ["admin"] }),
      ]);
      toast.success(`تمت استعادة الترتيب التلقائي لاختصار «${SHORTCUTS.find((s) => s.key === activeShortcut)?.label}»`);
    } catch (err: any) {
      toast.error(err?.message || "فشل استعادة الترتيب");
    } finally {
      setBusy(false);
    }
  };

  // Filtered view for presentation (retaining original index for move actions)
  const displayedItems = useMemo(() => {
    return orderedItems
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => {
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchName = item.name.toLowerCase().includes(q);
          const matchPhone = item.phone.includes(q);
          const matchTitle = (item.profession_title || "").toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchTitle) return false;
        }
        if (selectedCategory && item.category_id !== selectedCategory) {
          const assigned = (item as any).assigned_category_ids || [];
          if (!assigned.includes(selectedCategory)) return false;
        }
        if (selectedArea && item.area_id !== selectedArea) {
          return false;
        }
        return true;
      });
  }, [orderedItems, searchQuery, selectedCategory, selectedArea]);

  const activeMeta = SHORTCUTS.find((s) => s.key === activeShortcut)!;

  return (
    <div className="space-y-4">
      {/* Top Banner & Explanation */}
      <div className="surface p-4 sm:p-5 rounded-2xl border border-border shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                <ArrowUpDown className="size-4" />
              </span>
              <h3 className="text-lg sm:text-xl font-extrabold text-foreground">
                ترتيب صنايعية الاختصارات
              </h3>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              تحكّم في أولوية ظهور الصنايعية المؤهلين داخل كل اختصار من الاختصارات الثلاثة الرئيسية.
            </p>
          </div>

          {/* Action buttons (Save & Reset) */}
          <div className="flex items-center gap-2 shrink-0">
            {hasUnsavedChanges && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                <AlertCircle className="size-3.5" />
                <span>تغييرات غير محفوظة</span>
              </span>
            )}

            <button
              type="button"
              onClick={handleResetToDefault}
              disabled={busy || savedIds.length === 0}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-extrabold text-foreground hover:bg-secondary disabled:opacity-40 transition-all cursor-pointer shadow-xs"
              title="إلغاء الترتيب اليدوي والعودة للترتيب التلقائي"
            >
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">استعادة التلقائي</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={busy || !hasUnsavedChanges}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs sm:text-sm font-extrabold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all cursor-pointer shadow-xs"
            >
              <Save className="size-4" />
              <span>{busy ? "جاري الحفظ..." : "حفظ الترتيب"}</span>
            </button>
          </div>
        </div>

        {/* Shortcut selector tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
          {SHORTCUTS.map((s) => {
            const Icon = s.icon;
            const isSelected = activeShortcut === s.key;
            const count =
              s.key === "emergency_now"
                ? allActiveProviders.filter((p) => Boolean(p.is_emergency_24h || isProviderEmergency24h(p.working_hours))).length
                : s.key === "delivery"
                ? allActiveProviders.filter((p) => Boolean((p as any).has_delivery || rawSettings[`prov_deliv_${p.id}`] === "true")).length
                : allActiveProviders.length;

            return (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  if (hasUnsavedChanges) {
                    if (!confirm("لديك تعديلات غير محفوظة للاختصار الحالي. هل تريد الانتقال بدون حفظ؟")) {
                      return;
                    }
                  }
                  setActiveShortcut(s.key);
                }}
                className={`flex items-center justify-between p-3.5 rounded-xl border text-start transition-all cursor-pointer min-h-[56px] ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-xs ring-2 ring-primary/20"
                    : "border-border bg-card hover:bg-secondary/60 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`grid size-9 place-items-center rounded-xl shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                    <Icon className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm text-foreground truncate">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{s.badgeLabel}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-black text-foreground">
                  {count} صنايعي
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Shortcut Info Banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-border/80 bg-secondary/30 text-xs text-muted-foreground">
          <HelpCircle className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-foreground">
              معيار الأهلية: {activeMeta.eligibilityRule}
            </p>
            <p>{activeMeta.description}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="surface p-3 sm:p-4 rounded-2xl border border-border shadow-xs flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الهاتف..."
            className="w-full min-h-[44px] rounded-xl border border-border bg-card pr-9 pl-3 text-xs text-foreground outline-none focus:border-primary"
          />
        </div>

        {/* Category filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="min-h-[44px] rounded-xl border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-primary cursor-pointer"
        >
          <option value="">كل الأقسام</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Area filter */}
        <select
          value={selectedArea}
          onChange={(e) => setSelectedArea(e.target.value)}
          className="min-h-[44px] rounded-xl border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-primary cursor-pointer"
        >
          <option value="">كل القرى والمناطق</option>
          {(areas.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        {(searchQuery || selectedCategory || selectedArea) && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("");
              setSelectedArea("");
            }}
            className="min-h-[44px] px-3 text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            مسح الفلاتر
          </button>
        )}
      </div>

      {/* Providers List for Ordering */}
      <div className="surface p-3 sm:p-4 rounded-2xl border border-border shadow-xs space-y-2">
        <div className="flex items-center justify-between px-1 pb-2 border-b border-border text-xs text-muted-foreground font-bold">
          <span>قائمة الصنايعية ({displayedItems.length} من {orderedItems.length})</span>
          <span>استخدم الأسهم لتحريك الصنايعي لأعلى أو لأسفل</span>
        </div>

        {displayedItems.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-muted-foreground">
            لا يوجد صنايعية مطابقون لمعايير البحث في هذا الاختصار.
          </div>
        ) : (
          <div className="space-y-2">
            {displayedItems.map(({ item, originalIndex }) => {
              const categoryName = (item.categories as any)?.name || "قسم عام";
              const areaName = (item.areas as any)?.name || "كل القرى";
              const isEmerg = Boolean(item.is_emergency_24h || isProviderEmergency24h(item.working_hours));
              const hasDelivery = Boolean((item as any).has_delivery || rawSettings[`prov_deliv_${item.id}`] === "true");
              const isFirst = originalIndex === 0;
              const isLast = originalIndex === orderedItems.length - 1;

              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl border transition-all ${
                    isPremiumActive(item)
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-border bg-card hover:bg-secondary/40"
                  }`}
                >
                  {/* Provider Order Number & Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid size-8 place-items-center rounded-xl bg-secondary text-foreground text-xs font-black shrink-0 border border-border">
                      {originalIndex + 1}
                    </span>

                    <div className="min-w-0 text-start space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-foreground truncate">
                          {item.name}
                        </span>
                        {isPremiumActive(item) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.2 text-[10px] font-black text-amber-600 dark:text-amber-400 shrink-0">
                            <Sparkles className="size-2.5" />
                            <span>مميز</span>
                          </span>
                        )}
                        {hasDelivery && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.2 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                            <Truck className="size-2.5" />
                            <span>توصيل</span>
                          </span>
                        )}
                        {isEmerg && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 border border-warning/30 px-2 py-0.2 text-[10px] font-bold text-warning shrink-0">
                            <Zap className="size-2.5" />
                            <span>طوارئ</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Tag className="size-3 text-primary" />
                          <span>{categoryName}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3 text-primary" />
                          <span>{areaName}</span>
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[11px]" dir="ltr">
                          <Phone className="size-3 text-muted-foreground" />
                          <span>{item.phone}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ordering Controls (Buttons >= 44px touch targets) */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Move to Top */}
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => moveToExtreme(originalIndex, true)}
                      className="grid size-10 sm:size-9 place-items-center rounded-xl border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-30 transition-all cursor-pointer shadow-xs"
                      title="تحريك لأول القائمة"
                      aria-label={`تحريك ${item.name} لأول القائمة`}
                    >
                      <ChevronsUp className="size-4" />
                    </button>

                    {/* Move Up */}
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => move(originalIndex, -1)}
                      className="grid size-10 sm:size-9 place-items-center rounded-xl border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-30 transition-all cursor-pointer shadow-xs"
                      title="تحريك لأعلى"
                      aria-label={`تحريك ${item.name} لأعلى`}
                    >
                      <ArrowUp className="size-4" />
                    </button>

                    {/* Move Down */}
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => move(originalIndex, 1)}
                      className="grid size-10 sm:size-9 place-items-center rounded-xl border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-30 transition-all cursor-pointer shadow-xs"
                      title="تحريك لأسفل"
                      aria-label={`تحريك ${item.name} لأسفل`}
                    >
                      <ArrowDown className="size-4" />
                    </button>

                    {/* Move to Bottom */}
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => moveToExtreme(originalIndex, false)}
                      className="grid size-10 sm:size-9 place-items-center rounded-xl border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-30 transition-all cursor-pointer shadow-xs"
                      title="تحريك لآخر القائمة"
                      aria-label={`تحريك ${item.name} لآخر القائمة`}
                    >
                      <ChevronsDown className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
