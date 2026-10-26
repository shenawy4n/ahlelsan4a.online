import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { ArrowRight, MapPin, Clock, Wallet, Wrench, Flag, Award, Briefcase, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isPremiumActive, providerQuery, getCategoryUnit, getProviderProfessionTitle, getProvider24HourMessage, sanitizeExternalUrl } from "@/lib/directory";
import { PremiumBadge, VerifiedBadge, ProviderRatingBadge, EmergencyBadge, DeliveryBadge } from "@/components/ProviderCard";
import { parseWorkingHours } from "@/lib/working-hours";
import { ContactButtons } from "@/components/ContactButtons";
import { SiteHeader } from "@/components/SiteHeader";
import { track } from "@/lib/track";
import { submitPublicForm, publicFormError } from "@/lib/public-forms.functions";
import { ProviderReviews } from "@/components/ProviderReviews";
import { WorkingHoursView } from "@/components/WorkingHoursView";
import { SiteFooter } from "@/components/SiteFooter";

function ProviderErrorComponent() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <SiteHeader />
      <main className="mx-auto w-full max-w-md p-6 text-center space-y-4">
        <h1 className="text-xl font-extrabold">تعذر تحميل بيانات العامل</h1>
        <p className="text-sm text-muted-foreground">ربما تم حذف هذا الحساب أو حدث خطأ أثناء الاتصال.</p>
        <Link to="/" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground">
          <ArrowRight className="size-3.5" /> الرئيسية
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/provider/$id")({
  head: () => ({
    meta: [
      { title: "ملف العامل — أهل الصنعة" },
      { name: "description", content: "بيانات العامل ورقم التليفون والواتساب للتواصل المباشر." },
      { property: "og:title", content: "ملف العامل — أهل الصنعة" },
      { property: "og:description", content: "اتصل بالعامل مباشرة من أهل الصنعة." },
    ],
  }),
  errorComponent: ProviderErrorComponent,
  component: ProviderPage,
});

function Row({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 border-t border-border py-3.5">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
      <div>
        <p className="text-sm font-bold text-muted-foreground">{label}</p>
        <p className="whitespace-pre-line text-base">{value}</p>
      </div>
    </div>
  );
}

function ProviderPage() {
  const { id } = Route.useParams();
  const { data: p, isLoading } = useQuery(providerQuery(id));
  const pid = p?.id;
  const pcat = p?.category_id;
  const trackedProviderRef = useRef<string | null>(null);

  useEffect(() => {
    // Only record once valid provider data has resolved
    if (!pid) return;

    // Guard against repeated query state transitions or re-renders for the same provider visit
    if (trackedProviderRef.current === pid) return;
    trackedProviderRef.current = pid;

    track("profile_view", { provider_id: pid, category_id: pcat });
  }, [pid, pcat]);

  return (
    <div className="min-h-screen bg-background pb-12">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pt-5">
        <Link
          to="/"
          className="mb-4 inline-flex min-h-[44px] items-center gap-1.5 text-xs sm:text-sm font-extrabold text-primary hover:underline"
        >
          <ArrowRight className="size-4" aria-hidden="true" />
          <span>الرجوع للرئيسية</span>
        </Link>
        {isLoading ? (
          <div className="surface p-8 rounded-2xl animate-pulse space-y-4">
            <div className="h-7 w-48 bg-muted rounded-md" />
            <div className="h-5 w-32 bg-muted/70 rounded-md" />
            <div className="h-14 bg-muted/80 rounded-xl" />
          </div>
        ) : !p ? (
          <p className="surface p-6 text-center text-lg font-bold rounded-2xl">مقدم الخدمة هذا غير موجود.</p>
        ) : (
          <>
            <section className="surface p-5 sm:p-6 rounded-2xl">
              {p.photo_url ? (
                <img
                  src={p.photo_url}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                  className="mb-4 aspect-video w-full rounded-xl object-cover border border-border/60 shadow-xs"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="font-display text-2xl sm:text-3xl font-black text-foreground truncate">
                    {p.name}
                  </h1>
                  {p.is_verified ? (
                    <VerifiedBadge />
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                  {parseWorkingHours(p.working_hours)?.isEmergency24h ? <EmergencyBadge /> : null}
                  {p.has_delivery ? <DeliveryBadge /> : null}
                  {isPremiumActive(p) ? <PremiumBadge /> : null}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-base text-muted-foreground">
                  <span className="font-bold text-primary">
                    {getProviderProfessionTitle(p)}
                  </span>
                  <span className="mx-1.5">·</span>
                  <MapPin className="inline size-4 align-[-2px]" /> {p.areas?.name}
                </p>
                <ProviderRatingBadge
                  summary={
                    p.review_count !== undefined && p.average_rating !== undefined && p.review_count > 0 && p.average_rating > 0
                      ? { average: Number(p.average_rating), count: Number(p.review_count) }
                      : undefined
                  }
                />
              </div>
              <div className="mt-5">
                <ContactButtons
                  providerId={p.id}
                  hasWhatsapp={p.has_whatsapp}
                  big
                  providerInfo={{
                    name: p.name,
                    categoryName: p.categories?.name,
                    categoryUnitTitle: getProviderProfessionTitle(p),
                    areaName: p.areas?.name,
                    isEmergency24h: parseWorkingHours(p.working_hours)?.isEmergency24h,
                  }}
                />
              </div>
              <div className="mt-5">
                {p.description ? <p className="mb-3 whitespace-pre-line text-base">{p.description}</p> : null}
                <Row icon={Award} label="سنوات الخبرة" value={p.experience_options?.label ?? null} />
                <Row icon={Wrench} label="الخدمات" value={Array.isArray(p.services) ? (p.services as string[]).join("، ") : (p.services as unknown as string)} />
                <Row icon={Wallet} label="الأسعار" value={p.price_description} />
                {p.portfolio_url && sanitizeExternalUrl(p.portfolio_url) ? (
                  <div className="mt-3.5 mb-2">
                    <a
                      href={sanitizeExternalUrl(p.portfolio_url)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-primary/10 active:brightness-95"
                    >
                      <Briefcase className="size-4 shrink-0" />
                      <span>شاهد الأعمال</span>
                      <ExternalLink className="size-3.5 opacity-70 shrink-0" />
                    </a>
                  </div>
                ) : null}
                <WorkingHoursView workingHoursRaw={p.working_hours} provider={p} professionTitle={getProviderProfessionTitle(p)} />
              </div>
            </section>
            <ProviderReviews providerId={p.id} providerName={p.name} />
            <ReportBox providerId={p.id} />
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function ReportBox({ providerId }: { providerId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<"رقم الهاتف لا يعمل" | "البيانات غير صحيحة" | "الصنايعي لا يعمل بهذه الصنعة" | "البيانات قديمة" | "سبب آخر">("رقم الهاتف لا يعمل");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [hp, setHp] = useState("");

  async function submit() {
    setBusy(true);
    const res = await submitPublicForm({ data: { form: "report", provider_id: providerId, reason, details: details.trim().slice(0, 500), website: hp } }).catch(() => ({ ok: false as const, code: "error" as const }));
    setBusy(false);
    if (!res.ok) { toast.error(publicFormError(res.code)); return; }
    toast.success("شكراً! وصلنا البلاغ");
    setOpen(false);
    setDetails("");
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mt-4 flex w-full items-center justify-center gap-2 py-3 font-bold text-muted-foreground">
        <Flag className="size-4" /> الإبلاغ عن مشكلة
      </button>
    );

  return (
    <section className="surface mt-4 grid gap-3 p-5" suppressHydrationWarning>
      <h2 className="text-lg font-extrabold">الإبلاغ عن مشكلة</h2>
      <input value={hp} onChange={(e) => setHp(e.target.value)} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" suppressHydrationWarning />
      <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="rounded-xl border border-border bg-card px-3 py-3 text-base" suppressHydrationWarning>
        <option>رقم الهاتف لا يعمل</option>
        <option>البيانات غير صحيحة</option>
        <option>الصنايعي لا يعمل بهذه الصنعة</option>
        <option>البيانات قديمة</option>
        <option>سبب آخر</option>
      </select>
      <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={3} placeholder="تفاصيل (اختياري)" className="rounded-xl border border-border bg-card px-3 py-3 text-base" suppressHydrationWarning />
      <div className="grid grid-cols-2 gap-2">
        <button disabled={busy} onClick={submit} className="rounded-xl bg-primary py-3 font-extrabold text-primary-foreground disabled:opacity-60">إرسال</button>
        <button onClick={() => setOpen(false)} className="rounded-xl border border-border py-3 font-bold">إلغاء</button>
      </div>
    </section>
  );
}
