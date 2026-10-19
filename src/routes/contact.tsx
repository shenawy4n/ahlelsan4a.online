import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Send,
  Phone,
  User,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  HelpCircle,
  Facebook,
  MessageCircle,
  Mail,
  ExternalLink,
  Globe,
  PhoneCall,
  MapPin,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { settingsQuery, normalizeEgPhone } from "@/lib/directory";
import { sendContactMessage } from "@/lib/messages.functions";

function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^(?:https?:)?\/\//i.test(trimmed)) {
    return trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  }
  return `https://${trimmed}`;
}

export const Route = createFileRoute("/contact")({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(settingsQuery);
    } catch {
      // Non-blocking loader fallback
    }
  },
  head: () => ({
    meta: [
      { title: "تواصل معنا — أهل الصنعة" },
      {
        name: "description",
        content: "قنوات التواصل الرسمية ونموذج المراسلة المباشر لإدارة منصة أهل الصنعة.",
      },
      { property: "og:title", content: "تواصل معنا — أهل الصنعة" },
      {
        property: "og:description",
        content: "تواصل مع إدارة أهل الصنعة عبر فيسبوك، واتساب، الهاتف أو أرسل رسالتك مباشرة.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data: settings } = useQuery(settingsQuery);
  const appName = settings?.["app_name"] || "أهل الصنعة";
  const customContent = settings?.["contact_content"]?.trim() || "";

  const facebook = settings?.["contact_facebook"]?.trim() || "";
  const whatsapp = settings?.["contact_whatsapp"]?.trim() || "";
  const phone = settings?.["contact_phone"]?.trim() || "";
  const secPhone = settings?.["contact_secondary_phone"]?.trim() || "";
  const email = settings?.["contact_email"]?.trim() || "";
  const address = settings?.["contact_address"]?.trim() || "";
  const hours = settings?.["contact_hours"]?.trim() || "";
  const telegram = settings?.["contact_telegram"]?.trim() || "";
  const customLink = settings?.["contact_custom_link"]?.trim() || "";
  const customLinkLabel = settings?.["contact_custom_link_label"]?.trim() || "رابط إضافي";

  const hasAnyChannels = Boolean(
    facebook ||
      whatsapp ||
      phone ||
      secPhone ||
      email ||
      address ||
      hours ||
      telegram ||
      customLink
  );

  const sendFn = useServerFn(sendContactMessage);

  const [name, setName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [subject, setSubject] = useState("استفسار عام");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [lastPhone, setLastPhone] = useState("");

  const SUBJECT_OPTIONS = [
    "استفسار عام",
    "طلب إضافة مهنة أو خدمة جديدة",
    "مشكلة في رقم أو بيانات صنايعي",
    "اقتراح لتطوير المنصة",
    "شكوى أو ملاحظة",
    "أخرى",
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("يرجى إدخال اسمك");
      return;
    }

    const cleanPhone = senderPhone.replace(/[^\d+]/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("يرجى إدخال رقم هاتف صحيح للتواصل (١٠ إلى ١١ رقم)");
      return;
    }

    if (!message.trim() || message.trim().length < 5) {
      toast.error("يرجى كتابة نص الرسالة (٥ أحرف على الأقل)");
      return;
    }

    setBusy(true);
    try {
      const res = await sendFn({
        data: {
          name: name.trim(),
          phone: cleanPhone,
          subject: subject,
          message: message.trim(),
        },
      });

      if (!res.ok) {
        toast.error("تعذر إرسال الرسالة حالياً، يرجى المحاولة لاحقاً");
        return;
      }

      setLastPhone(cleanPhone);
      setSentSuccess(true);
      setName("");
      setSenderPhone("");
      setMessage("");
      toast.success("تم إرسال رسالتك بنجاح للإدارة");
    } catch {
      toast.error("حدث خطأ أثناء إرسال الرسالة، تأكد من اتصالك وحاول مجدداً");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <div>
        <SiteHeader />

        <main className="mx-auto w-full max-w-3xl px-4 py-8 space-y-8">
          {/* Breadcrumb / Nav */}
          <nav aria-label="مسار التنقل" className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">
              الرئيسية
            </Link>
            <span>/</span>
            <span className="text-foreground">تواصل معنا</span>
          </nav>

          {/* Header */}
          <div className="text-center space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
              <PhoneCall className="size-3.5" /> قنوات التواصل الرسمية
            </span>
            <h1 className="text-2xl font-extrabold sm:text-3xl text-foreground tracking-tight">
              تواصل مع إدارة {appName}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
              نسعد دائماً باستقبال استفساراتك واقتراحاتك وملاحظاتك حول الخدمات والصنايعية، أو طلبات الانضمام للدليل.
            </p>
          </div>

          {/* Admin Announcement / Notes */}
          {customContent && (
            <div className="surface p-4 sm:p-5 rounded-2xl border border-primary/25 bg-primary/5 space-y-1.5 text-sm text-foreground/90">
              <p className="font-extrabold text-primary flex items-center gap-1.5">
                <HelpCircle className="size-4 shrink-0" /> ملاحظات هامة من الإدارة:
              </p>
              <p className="whitespace-pre-wrap leading-relaxed">{customContent}</p>
            </div>
          )}

          {/* Contact Channels Grid */}
          {hasAnyChannels && (
            <section aria-label="وسائل التواصل المباشرة" className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <h2 className="text-base sm:text-lg font-extrabold text-foreground flex items-center gap-2">
                  <span>وسائل التواصل المباشرة</span>
                </h2>
                <span className="text-xs text-muted-foreground">اختر الوسيلة المناسبة لك</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Facebook Link */}
                {facebook && (
                  <a
                    href={safeExternalUrl(facebook) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="surface group flex items-center justify-between gap-3 p-4 rounded-2xl border border-border hover:border-[#1877F2]/50 hover:bg-[#1877F2]/5 transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="grid size-11 place-items-center rounded-2xl bg-[#1877F2]/10 text-[#1877F2] group-hover:scale-105 transition-transform shrink-0">
                        <Facebook className="size-5" />
                      </span>
                      <div className="min-w-0 text-start">
                        <p className="text-sm font-extrabold text-foreground">صفحتنا على فيسبوك</p>
                        <p className="text-xs text-muted-foreground truncate" dir="ltr">
                          {facebook.replace(/^https?:\/\/(www\.)?facebook\.com\/?/i, "") || "Facebook Page"}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="size-4 text-muted-foreground group-hover:text-[#1877F2] transition-colors shrink-0" />
                  </a>
                )}

                {/* WhatsApp Link */}
                {whatsapp && (
                  <a
                    href={`https://wa.me/${normalizeEgPhone(whatsapp) || whatsapp.replace(/[^\d+]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="surface group flex items-center justify-between gap-3 p-4 rounded-2xl border border-border hover:border-success/50 hover:bg-success/5 transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="grid size-11 place-items-center rounded-2xl bg-success/10 text-success group-hover:scale-105 transition-transform shrink-0">
                        <MessageCircle className="size-5" />
                      </span>
                      <div className="min-w-0 text-start">
                        <p className="text-sm font-extrabold text-foreground">واتساب للتواصل والمراسلة</p>
                        <p className="text-xs font-bold text-muted-foreground" dir="ltr">
                          {whatsapp}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="size-4 text-muted-foreground group-hover:text-success transition-colors shrink-0" />
                  </a>
                )}

                {/* Primary Phone */}
                {phone && (
                  <a
                    href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                    className="surface group flex items-center justify-between gap-3 p-4 rounded-2xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary group-hover:scale-105 transition-transform shrink-0">
                        <Phone className="size-5" />
                      </span>
                      <div className="min-w-0 text-start">
                        <p className="text-sm font-extrabold text-foreground">الاتصال الهاتفي الأساسي</p>
                        <p className="text-xs font-bold text-muted-foreground" dir="ltr">
                          {phone}
                        </p>
                      </div>
                    </div>
                    <PhoneCall className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </a>
                )}

                {/* Secondary Phone */}
                {secPhone && (
                  <a
                    href={`tel:${secPhone.replace(/[^\d+]/g, "")}`}
                    className="surface group flex items-center justify-between gap-3 p-4 rounded-2xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary group-hover:scale-105 transition-transform shrink-0">
                        <Phone className="size-5" />
                      </span>
                      <div className="min-w-0 text-start">
                        <p className="text-sm font-extrabold text-foreground">رقم هاتف إضافي</p>
                        <p className="text-xs font-bold text-muted-foreground" dir="ltr">
                          {secPhone}
                        </p>
                      </div>
                    </div>
                    <PhoneCall className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </a>
                )}

                {/* Email */}
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="surface group flex items-center justify-between gap-3 p-4 rounded-2xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary group-hover:scale-105 transition-transform shrink-0">
                        <Mail className="size-5" />
                      </span>
                      <div className="min-w-0 text-start">
                        <p className="text-sm font-extrabold text-foreground">البريد الإلكتروني</p>
                        <p className="text-xs text-muted-foreground truncate" dir="ltr">
                          {email}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </a>
                )}

                {/* Telegram */}
                {telegram && (
                  <a
                    href={safeExternalUrl(telegram) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="surface group flex items-center justify-between gap-3 p-4 rounded-2xl border border-border hover:border-[#229ED9]/50 hover:bg-[#229ED9]/5 transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="grid size-11 place-items-center rounded-2xl bg-[#229ED9]/10 text-[#229ED9] group-hover:scale-105 transition-transform shrink-0">
                        <Send className="size-5" />
                      </span>
                      <div className="min-w-0 text-start">
                        <p className="text-sm font-extrabold text-foreground">تليجرام</p>
                        <p className="text-xs text-muted-foreground truncate" dir="ltr">
                          {telegram.replace(/^https?:\/\/(t\.me|telegram\.me)\/?/i, "@")}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="size-4 text-muted-foreground group-hover:text-[#229ED9] transition-colors shrink-0" />
                  </a>
                )}

                {/* Custom Link */}
                {customLink && (
                  <a
                    href={safeExternalUrl(customLink) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="surface group flex items-center justify-between gap-3 p-4 rounded-2xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary group-hover:scale-105 transition-transform shrink-0">
                        <Globe className="size-5" />
                      </span>
                      <div className="min-w-0 text-start">
                        <p className="text-sm font-extrabold text-foreground">{customLinkLabel}</p>
                        <p className="text-xs text-muted-foreground truncate" dir="ltr">
                          {customLink.replace(/^https?:\/\//i, "")}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </a>
                )}

                {/* Working Hours */}
                {hours && (
                  <div className="surface flex items-center gap-3.5 p-4 rounded-2xl border border-border shadow-2xs">
                    <span className="grid size-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                      <Clock className="size-5" />
                    </span>
                    <div className="min-w-0 text-start">
                      <p className="text-sm font-extrabold text-foreground">مواعيد استقبال الاتصالات</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{hours}</p>
                    </div>
                  </div>
                )}

                {/* Address */}
                {address && (
                  <div className="surface flex items-center gap-3.5 p-4 rounded-2xl border border-border shadow-2xs sm:col-span-2">
                    <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary shrink-0">
                      <MapPin className="size-5" />
                    </span>
                    <div className="min-w-0 text-start">
                      <p className="text-sm font-extrabold text-foreground">العنوان والمقر</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{address}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Direct Message Form Section */}
          <section aria-label="نموذج مراسلة الإدارة" className="space-y-4 pt-2">
            {sentSuccess ? (
              /* Success State */
              <div className="surface p-6 sm:p-8 rounded-3xl border border-success/30 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
                <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-success/10 text-success">
                  <CheckCircle2 className="size-9" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-extrabold text-foreground">
                    تم استلام رسالتك بنجاح!
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                    شكراً لتواصلك مع إدارة <strong className="text-foreground">{appName}</strong>. تم تحويل رسالتك إلى قسم الطلبات والوارد، وسيقوم فريق العمل بالتواصل معك على الرقم:
                  </p>
                  <p className="text-base font-extrabold text-primary" dir="ltr">
                    {lastPhone}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSentSuccess(false)}
                    className="w-full sm:w-auto rounded-xl bg-secondary px-5 py-2.5 text-xs font-bold text-foreground hover:bg-secondary/80 transition-colors"
                  >
                    إرسال رسالة أخرى
                  </button>
                  <Link
                    to="/"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-extrabold text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
                  >
                    <span>الرجوع للرئيسية</span>
                    <ArrowRight className="size-3.5 rotate-180" />
                  </Link>
                </div>
              </div>
            ) : (
              /* Contact Form */
              <div className="space-y-4">
                <div className="border-b border-border pb-2.5">
                  <h2 className="text-base sm:text-lg font-extrabold text-foreground flex items-center gap-2">
                    <MessageSquare className="size-4 text-primary" />
                    <span>أرسل رسالة مباشرة للإدارة</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    املأ البيانات وسيقوم فريق العمل بمتابعة رسالتك والتواصل معك هاتفياً في أقرب وقت.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="surface p-5 sm:p-7 rounded-3xl border border-border shadow-xs space-y-4">
                  {/* Sender Name */}
                  <label className="block space-y-1.5">
                    <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                      <User className="size-3.5 text-primary" />
                      الاسم بالكامل *
                    </span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="مثال: أحمد عبد الله"
                      maxLength={100}
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary transition-colors"
                    />
                  </label>

                  {/* Sender Phone (Required) */}
                  <label className="block space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                        <Phone className="size-3.5 text-primary" />
                        رقم الهاتف للتواصل *
                      </span>
                      <span className="text-[11px] font-bold text-primary">مطلوب للاتصال بك</span>
                    </div>
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      inputMode="tel"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="01012345678"
                      maxLength={20}
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-foreground outline-none focus:border-primary transition-colors"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      سيتم استخدام هذا الرقم للاتصال بك أو مراسلتك للرد على استفسارك.
                    </p>
                  </label>

                  {/* Subject / Type */}
                  <label className="block space-y-1.5">
                    <span className="text-xs font-extrabold text-foreground">
                      موضوع الرسالة
                    </span>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-foreground outline-none focus:border-primary transition-colors"
                    >
                      {SUBJECT_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Message Body */}
                  <label className="block space-y-1.5">
                    <span className="text-xs font-extrabold text-foreground">
                      نص الرسالة أو تفاصيل الاستفسار *
                    </span>
                    <textarea
                      required
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="اكتب هنا كافة تفاصيل استفسارك أو مشكلتك أو طلبك بالتفصيل..."
                      maxLength={2000}
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary transition-colors leading-relaxed"
                    />
                  </label>

                  {/* Submit Button */}
                  <button
                    disabled={busy}
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-xs active:scale-[0.99]"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>جاري إرسال الرسالة...</span>
                      </>
                    ) : (
                      <>
                        <Send className="size-4" />
                        <span>إرسال الرسالة للإدارة</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </section>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
