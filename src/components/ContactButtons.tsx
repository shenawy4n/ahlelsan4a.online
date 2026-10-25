import { useState } from "react";
import { toast } from "sonner";
import { PhoneCall, MessageCircle, Share2, Loader2 } from "lucide-react";
import { callProvider, whatsappProvider, shareProvider, RateLimitError } from "@/lib/contact";

export interface ProviderShareInfo {
  name: string;
  categoryName?: string | null | undefined;
  categoryUnitTitle?: string | null | undefined;
  areaName?: string | null | undefined;
  isEmergency24h?: boolean | undefined;
}

export function ContactButtons({
  providerId,
  hasWhatsapp,
  big = false,
  providerInfo,
}: {
  providerId: string;
  hasWhatsapp: boolean;
  big?: boolean;
  providerInfo?: ProviderShareInfo;
}) {
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"phone" | "whatsapp" | null>(null);
  const [noPhone, setNoPhone] = useState(false);
  const h = big ? "min-h-[52px] text-base sm:text-lg" : "min-h-[48px] text-[15px] sm:text-base";

  async function run(fn: () => Promise<unknown>, isPhone = true) {
    if (busy) return;
    setBusy(true);
    setBusyAction(isPhone ? "phone" : "whatsapp");
    try {
      await fn();
    } catch (err: unknown) {
      if (err instanceof RateLimitError || (err instanceof Error && err.message === "rate_limited")) {
        toast.error("طلبات اتصال كثيرة في وقت قصير، يرجى المحاولة بعد قليل");
      } else {
        if (isPhone) setNoPhone(true);
        toast.error(isPhone ? "رقم الهاتف غير متاح حالياً" : "واتساب غير متاح حالياً");
      }
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  async function handleShare() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await shareProvider({
        id: providerId,
        name: providerInfo?.name || "مقدم خدمة",
        categoryName: providerInfo?.categoryName,
        categoryUnitTitle: providerInfo?.categoryUnitTitle,
        areaName: providerInfo?.areaName,
        isEmergency24h: providerInfo?.isEmergency24h,
      });
      if (res === "copied") {
        toast.success("تم نسخ رابط صفحة مقدم الخدمة بنجاح");
      }
    } catch {
      toast.error("تعذر نسخ أو مشاركة الرابط");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className={`grid gap-2 sm:gap-2.5 ${hasWhatsapp ? "grid-cols-2" : "grid-cols-1"}`}>
        <button
          type="button"
          disabled={busy || noPhone}
          onClick={() => run(() => callProvider(providerId), true)}
          aria-label={`اتصال هاتفي بمقدم الخدمة ${providerInfo?.name ?? ""}`}
          className={`group flex ${h} items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground hover:bg-primary/95 active:scale-[0.98] disabled:opacity-60 transition-all shadow-xs`}
        >
          {busyAction === "phone" ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <PhoneCall className="size-4.5 group-hover:scale-110 transition-transform" aria-hidden="true" />
          )}
          <span>{busyAction === "phone" ? "جاري الاتصال..." : "اتصال"}</span>
        </button>

        {hasWhatsapp ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => whatsappProvider(providerId), false)}
            aria-label={`مراسلة واتساب لمقدم الخدمة ${providerInfo?.name ?? ""}`}
            className={`group flex ${h} items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 py-3 font-black text-whatsapp-foreground hover:brightness-105 active:scale-[0.98] disabled:opacity-60 transition-all shadow-xs`}
          >
            {busyAction === "whatsapp" ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <MessageCircle className="size-4.5 group-hover:scale-110 transition-transform fill-current" aria-hidden="true" />
            )}
            <span>{busyAction === "whatsapp" ? "جاري الفتح..." : "واتساب"}</span>
          </button>
        ) : null}
      </div>

      {noPhone && (
        <p className="text-center text-xs sm:text-sm font-bold text-destructive">
          رقم الهاتف غير متاح حالياً
        </p>
      )}

      {providerInfo && (
        <div className="flex items-center justify-end pt-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={handleShare}
            aria-label="مشاركة رابط صفحة مقدم الخدمة"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-border/80 bg-secondary/60 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-secondary hover:border-primary/30 active:scale-[0.98] transition-all"
          >
            <Share2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>مشاركة الرابط</span>
          </button>
        </div>
      )}
    </div>
  );
}
