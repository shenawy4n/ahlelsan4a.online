import React, { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { track } from "@/lib/track";
import { ArrowRight, Search as SearchIcon, Loader2, X, AlertCircle } from "lucide-react";
import {
  areasQuery,
  categoriesQuery,
  experienceQuery,
  providersQuery,
  settingsQuery,
  getCategoryUnit,
} from "@/lib/directory";
import { ProviderCard } from "@/components/ProviderCard";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AvailabilityFilter, type AvailabilityFilterMode } from "@/components/AvailabilityFilter";
import { isProviderAvailableNow, isProviderEmergency24h } from "@/lib/working-hours";
import { ZeroSearchResults } from "@/components/ZeroSearchResults";

function CategoryErrorComponent() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <SiteHeader />
      <main className="mx-auto w-full max-w-md p-6 text-center space-y-4">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-6" />
        </div>
        <h1 className="text-xl font-extrabold">تعذر تحميل بيانات الخدمة</h1>
        <p className="text-sm text-muted-foreground">
          ربما تم تغيير معرف الخدمة أو حدث خطأ أثناء التحميل.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all"
        >
          <ArrowRight className="size-3.5" />
          <span>الرجوع للرئيسية</span>
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/category/$id")({
  validateSearch: (
    s: Record<string, unknown>
  ): { area?: string; filter?: AvailabilityFilterMode; delivery?: boolean } => ({
    ...(typeof s["area"] === "string" && s["area"] ? { area: s["area"] } : {}),
    ...(s["filter"] === "available_now" || s["filter"] === "emergency_now" || s["filter"] === "all"
      ? { filter: s["filter"] }
      : s["filter"] === "delivery"
        ? { filter: "all", delivery: true }
        : {}),
    ...(s["delivery"] === true || s["delivery"] === "true" || s["delivery"] === "1" || s["delivery"] === 1
      ? { delivery: true }
      : {}),
  }),
  loader: async ({ context, params, location }) => {
    const areaId = (location.search as any)?.area;
    try {
      await Promise.all([
        context.queryClient.ensureQueryData(categoriesQuery),
        context.queryClient.ensureQueryData(areasQuery),
        context.queryClient.ensureQueryData(settingsQuery),
        context.queryClient.ensureQueryData(
          providersQuery({
            categoryId: params.id || undefined,
            areaId: areaId || undefined,
            limit: 20,
          })
        ),
      ]);
    } catch {
      // Fall through to component
    }
  },
  head: () => ({
    meta: [
      { title: "خدمة — أهل الصنعة" },
      { name: "description", content: "قائمة العمال والمهنيين المتاحين في هذه الخدمة داخل قريتك." },
      { property: "og:title", content: "خدمة — أهل الصنعة" },
      { property: "og:description", content: "قائمة العمال والمهنيين المتاحين في هذه الخدمة." },
    ],
  }),
  errorComponent: CategoryErrorComponent,
  component: CategoryPage,
});

function CategoryPage() {
  const { id } = Route.useParams();
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [area, setArea] = useState(searchParams.area ?? "");
  const [exp, setExp] = useState("");
  const [filterMode, setFilterMode] = useState<AvailabilityFilterMode>(searchParams.filter || "all");
  const [deliveryOnly, setDeliveryOnly] = useState<boolean>(Boolean(searchParams.delivery));
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Inlined safe debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  // Synchronize URL query parameters
  useEffect(() => {
    navigate({
      search: (prev) => ({
        ...prev,
        area: area || undefined,
        filter: filterMode !== "all" ? filterMode : undefined,
        delivery: deliveryOnly ? true : undefined,
      }),
      replace: true,
    });
  }, [area, filterMode, deliveryOnly, navigate]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, area, exp, filterMode, deliveryOnly]);

  const experience = useQuery(experienceQuery);
  const categories = useQuery(categoriesQuery);
  const areas = useQuery(areasQuery);

  useEffect(() => {
    if (id) {
      track("category_view", { category_id: id });
    }
  }, [id]);

  const results = useQuery(
    providersQuery({
      categoryId: id || undefined,
      search: debouncedQ || undefined,
      areaId: area || undefined,
      experienceId: exp || undefined,
      filterMode,
      deliveryOnly,
      limit: page * PAGE_SIZE,
    })
  );

  const category = useMemo(() => {
    return (categories.data ?? []).find((c) => c.id === id);
  }, [categories.data, id]);

  const isDebouncing = q !== debouncedQ;
  const isSearching = isDebouncing || results.isFetching;

  const allProviders = results.data?.items ?? [];
  const totals = results.data?.totals ?? {
    all: 0,
    openNow: 0,
    closedNow: 0,
    hoursNotSet: 0,
    emergency24: 0,
    delivery: 0,
  };

  const counts = useMemo(() => {
    return {
      all: totals.all,
      availableNow: totals.openNow,
      emergencyNow: totals.emergency24,
      delivery: totals.delivery ?? 0,
    };
  }, [totals]);

  const filteredProviders = allProviders;

  return (
    <div className="min-h-screen bg-background pb-12 text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pt-5">
        <Link
          to="/"
          className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-xs sm:text-sm font-extrabold text-primary hover:underline"
        >
          <ArrowRight className="size-4" aria-hidden="true" />
          <span>الرجوع للرئيسية</span>
        </Link>

        <h1 className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight">
          {category?.name ?? "الخدمة"}
        </h1>
        <p className="mb-4 text-xs sm:text-sm text-muted-foreground font-medium">
          {results.data
            ? `${filteredProviders.length} ${getCategoryUnit(category?.name ?? "", category?.unit_title)} معروض في الدليل`
            : "جاري التحميل…"}
        </p>

        <div className="surface mb-3 flex items-center gap-2.5 px-3.5 h-12 rounded-2xl border border-border/80 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-xs">
          {isSearching ? (
            <Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
          ) : (
            <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={60}
            className="w-full bg-transparent text-[15px] sm:text-base outline-none placeholder:text-[15px] placeholder:text-muted-foreground text-foreground"
            placeholder="ابحث داخل هذه الخدمة..."
          />
          {q.trim() && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors"
              aria-label="مسح البحث"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative surface h-12 rounded-2xl border border-border/80 bg-card shadow-xs">
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              aria-label="اختر القرية أو المنطقة"
              className="h-full w-full appearance-none bg-transparent px-3.5 text-[15px] font-bold text-foreground outline-none cursor-pointer focus:border-primary truncate"
            >
              <option value="">كل القرى والمناطق</option>
              {(areas.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="relative surface h-12 rounded-2xl border border-border/80 bg-card shadow-xs">
            <select
              value={exp}
              onChange={(e) => setExp(e.target.value)}
              aria-label="اختر مستوى الخبرة"
              className="h-full w-full appearance-none bg-transparent px-3.5 text-[15px] font-bold text-foreground outline-none cursor-pointer focus:border-primary truncate"
            >
              <option value="">أي خبرة</option>
              {(experience.data ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Availability / Emergency / Delivery Filters */}
        <div className="mb-5">
          <AvailabilityFilter
            currentMode={filterMode}
            onModeChange={setFilterMode}
            deliveryOnly={deliveryOnly}
            onDeliveryChange={setDeliveryOnly}
            counts={counts}
          />
        </div>

        {results.isLoading ? (
          <div className="space-y-3.5 py-2" aria-label="جاري تحميل النتائج">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="surface p-4 sm:p-5 rounded-2xl animate-pulse space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="h-6 w-36 bg-muted rounded-md" />
                  <div className="h-5 w-16 bg-muted/60 rounded-md" />
                </div>
                <div className="h-4 w-48 bg-muted/70 rounded-md" />
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <div className="h-11 bg-muted/80 rounded-xl" />
                  <div className="h-11 bg-muted/80 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : results.isError ? (
          <div className="py-12 text-center space-y-4">
            <p className="text-base font-extrabold text-destructive">حدث خطأ أثناء تحميل البيانات</p>
            <p className="text-sm text-muted-foreground">تعذر الاتصال بالخادم، يرجى المحاولة مرة أخرى.</p>
            <button
              type="button"
              onClick={() => results.refetch()}
              className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-primary px-6 py-2.5 text-base font-extrabold text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
            >
              حاول تاني
            </button>
          </div>
        ) : filteredProviders.length === 0 ? (
          <ZeroSearchResults
            query={debouncedQ}
            categoryId={id}
            areaId={area}
            filterMode={filterMode}
            deliveryOnly={deliveryOnly}
            onClearArea={() => setArea("")}
            onClearFilter={() => setFilterMode("all")}
            onClearDelivery={() => setDeliveryOnly(false)}
            onClearQuery={() => setQ("")}
            categories={categories.data ?? []}
            areas={areas.data ?? []}
          />
        ) : (
          <>
            <div className="space-y-3">
              {filteredProviders.map((p) => (
                <ProviderCard key={p.id} provider={p} />
              ))}
            </div>

            {allProviders.length <
              (filterMode === "emergency_now"
                ? totals.emergency24
                : filterMode === "available_now"
                  ? totals.openNow
                  : totals.all) && (
              <div className="pt-4 text-center">
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={results.isFetching}
                  className="min-h-[48px] rounded-2xl border border-border bg-card px-6 py-2.5 text-base font-extrabold text-foreground hover:bg-secondary active:scale-[0.98] transition-all shadow-xs disabled:opacity-60"
                >
                  {results.isFetching ? "جاري التحميل..." : "عرض المزيد من الصنايعية"}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
