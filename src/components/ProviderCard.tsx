import { Link } from "@tanstack/react-router";
import { Star, MapPin, BadgeCheck, Award, Zap, Building2, Truck } from "lucide-react";
import { isPremiumActive, getCategoryUnit, getProviderProfessionTitle, getProvider24HourMessage, type PublicProvider as ProviderWithRefs } from "@/lib/directory";
import { ContactButtons } from "@/components/ContactButtons";
import { parseWorkingHours, getOpenStatus } from "@/lib/working-hours";

export function normalizeServices(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter((s) => s.length > 0);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((s) => (typeof s === "string" ? s.trim() : ""))
            .filter((s) => s.length > 0);
        }
      } catch {
        // continue
      }
    }
    return trimmed
      .split(/[,،\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
}

export function ProviderRatingBadge({
  summary,
}: {
  providerId?: string;
  summary?: { average: number; count: number };
}) {
  if (summary && summary.count > 0 && summary.average > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-lg bg-secondary/90 px-2 py-0.5 text-xs font-black text-foreground border border-border/40"
        dir="ltr"
        aria-label={`تقييم ${summary.average.toFixed(1)} من 5 من ${summary.count} تقييم`}
      >
        <Star className="size-3.5 fill-amber-500 text-amber-500 inline shrink-0" aria-hidden="true" />
        <span className="font-extrabold">{summary.average.toFixed(1)}</span>
        <span className="text-[11px] font-semibold text-muted-foreground">({summary.count})</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg bg-secondary/50 px-2 py-0.5 text-xs font-bold text-muted-foreground"
      aria-label="لا يوجد تقييم بعد"
    >
      <Star className="size-3 text-muted-foreground/60 inline shrink-0" aria-hidden="true" />
      <span className="text-[11px]">بدون تقييم</span>
    </span>
  );
}

export function PremiumBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400 border border-amber-500/25">
      <Star className="size-3 fill-current" aria-hidden="true" /> مميز
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary border border-primary/25">
      <BadgeCheck className="size-3.5" aria-hidden="true" /> موثّق
    </span>
  );
}

export function EmergencyBadge({ message }: { message?: string } = {}) {
  const label = message || "طوارئ ٢٤ ساعة";
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-xs font-black text-warning border border-warning/25"
    >
      <Zap className="size-3 fill-current" aria-hidden="true" /> طوارئ ٢٤
    </span>
  );
}

export function DeliveryBadge() {
  return (
    <span
      title="يوفر خدمة التوصيل للمنازل"
      aria-label="توصيل للمنازل"
      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/25"
    >
      <Truck className="size-3" aria-hidden="true" /> توصيل
    </span>
  );
}

export function ProviderCard({
  provider,
  ratingSummary,
}: {
  provider: ProviderWithRefs;
  ratingSummary?: { average: number; count: number };
}) {
  const premium = isPremiumActive(provider);
  const hoursData = parseWorkingHours(provider.working_hours);
  const openStatus = hoursData ? getOpenStatus(hoursData) : null;

  const count = typeof ratingSummary?.count === "number"
    ? ratingSummary.count
    : typeof provider.review_count === "number"
      ? provider.review_count
      : 0;
  const average = typeof ratingSummary?.average === "number"
    ? ratingSummary.average
    : typeof provider.average_rating === "number"
      ? Number(provider.average_rating)
      : 0;
  const computedRating = count > 0 && average > 0 ? { average, count } : undefined;

  const normalizedServices = normalizeServices(provider.services);
  const visibleServices = normalizedServices.slice(0, 3);
  const remainingServicesCount = normalizedServices.length - 3;
  const rawDesc = provider.description?.trim();
  const shortDescription = rawDesc ? rawDesc.slice(0, 70) : "";

  return (
    <article
      className={`surface-interactive p-4 sm:p-5 rounded-2xl relative ${
        premium
          ? "border-amber-400/50 bg-gradient-to-b from-amber-500/[0.03] to-card ring-1 ring-amber-400/20"
          : "hover:border-primary/40"
      }`}
    >
      <Link
        to="/provider/$id"
        params={{ id: provider.id }}
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl"
      >
        {/* Header: Name + Verification + Highlights */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-display text-lg sm:text-xl font-black text-foreground group-hover:text-primary transition-colors truncate">
              {provider.name}
            </h3>
            {provider.is_verified ? (
              <span title="صنايعي موثق من إدارة أهل الصنعة" className="inline-flex shrink-0">
                <BadgeCheck className="size-5 text-primary" aria-label="موثق" />
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
            {hoursData?.isEmergency24h ? <EmergencyBadge /> : null}
            {provider.has_delivery ? <DeliveryBadge /> : null}
            {premium ? <PremiumBadge /> : null}
          </div>
        </div>

        {/* Metadata line: Profession · Village area · Experience */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className="font-extrabold text-primary">
            {getProviderProfessionTitle(provider)}
          </span>
          <span className="text-border" aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 font-medium">
            <MapPin className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>{provider.areas?.name}</span>
          </span>
          {provider.experience_options ? (
            <>
              <span className="text-border" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-medium text-xs sm:text-sm">
                <Award className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span>خبرة: {provider.experience_options.label}</span>
              </span>
            </>
          ) : null}
        </div>

        {/* Status + Workshop + Rating Row */}
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/40 pt-2 text-xs">
          <div className="flex items-center gap-3">
            {!hoursData?.isEmergency24h && openStatus && openStatus.isOpen !== null ? (
              <span
                suppressHydrationWarning
                className={`inline-flex items-center gap-1.5 font-extrabold ${
                  openStatus.isOpen ? "text-success" : "text-muted-foreground"
                }`}
              >
                <span
                  suppressHydrationWarning
                  className={`size-2 rounded-full ${
                    openStatus.isOpen ? "bg-success animate-pulse" : "bg-muted-foreground/50"
                  }`}
                  aria-hidden="true"
                />
                <span>{openStatus.isOpen ? "متاح الآن" : "غير متاح حالياً"}</span>
              </span>
            ) : null}

            {hoursData?.workshop?.hasWorkshop ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground font-medium truncate max-w-[12rem] sm:max-w-xs">
                <Building2 className="size-3.5 text-primary shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {hoursData.workshop.workshopName || hoursData.workshop.workshopAddress || "مقر عمل ثابت"}
                </span>
              </span>
            ) : null}
          </div>

          <ProviderRatingBadge summary={computedRating} />
        </div>

        {/* Services tags OR short description */}
        {visibleServices.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-14 overflow-hidden" aria-label="الخدمات المقدمة">
            {visibleServices.map((service, index) => (
              <span
                key={index}
                className="inline-flex items-center rounded-md border border-border/50 bg-secondary/60 px-2 py-0.5 text-xs font-semibold text-secondary-foreground"
              >
                {service}
              </span>
            ))}
            {remainingServicesCount > 0 && (
              <span className="inline-flex items-center rounded-md bg-secondary/80 px-1.5 py-0.5 text-xs font-bold text-muted-foreground">
                +{remainingServicesCount}
              </span>
            )}
          </div>
        ) : shortDescription ? (
          <p className="mt-2.5 truncate text-xs sm:text-sm text-muted-foreground">
            {shortDescription}
            {rawDesc && rawDesc.length > 70 ? "…" : ""}
          </p>
        ) : null}
      </Link>

      <div className="mt-3.5 pt-1">
        <ContactButtons
          providerId={provider.id}
          hasWhatsapp={provider.has_whatsapp}
          providerInfo={{
            name: provider.name,
            categoryName: provider.categories?.name,
            categoryUnitTitle: getProviderProfessionTitle(provider),
            areaName: provider.areas?.name,
            isEmergency24h: hoursData?.isEmergency24h,
          }}
        />
      </div>
    </article>
  );
}
