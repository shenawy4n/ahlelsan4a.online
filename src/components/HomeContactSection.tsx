import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Facebook,
  MessageCircle,
  Phone,
  PhoneCall,
  Mail,
  MapPin,
  Clock,
  Send,
  Globe,
  ExternalLink,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { settingsQuery, normalizeEgPhone } from "@/lib/directory";

function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^(?:https?:)?\/\//i.test(trimmed)) {
    return trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  }
  return `https://${trimmed}`;
}

export function HomeContactSection({
  settings: propSettings,
}: {
  settings?: Record<string, string | null | undefined>;
}) {
  const { data: qSettings } = useQuery(settingsQuery);
  const settings = propSettings || qSettings || {};

  const appName = settings["app_name"] || "أهل الصنعة";
  const facebook = settings["contact_facebook"]?.trim() || "";
  const whatsapp = settings["contact_whatsapp"]?.trim() || "";
  const phone = settings["contact_phone"]?.trim() || "";
  const secPhone = settings["contact_secondary_phone"]?.trim() || "";
  const email = settings["contact_email"]?.trim() || "";
  const address = settings["contact_address"]?.trim() || "";
  const hours = settings["contact_hours"]?.trim() || "";
  const telegram = settings["contact_telegram"]?.trim() || "";
  const customLink = settings["contact_custom_link"]?.trim() || "";
  const customLinkLabel = settings["contact_custom_link_label"]?.trim() || "رابط إضافي";
  const contactContent = settings["contact_content"]?.trim() || "";

  const hasAnyContactMethod = Boolean(
    facebook ||
      whatsapp ||
      phone ||
      secPhone ||
      email ||
      telegram ||
      customLink ||
      address ||
      hours ||
      contactContent
  );

  return (
    <section id="contact-us" aria-label="تواصل معنا" className="surface mt-8 overflow-hidden rounded-2xl border border-border p-4 sm:p-6 shadow-xs transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary mb-1">
            <PhoneCall className="size-3.5" /> تواصل معنا
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-foreground">
            تواصل مع إدارة {appName}
          </h3>
          <p className="mt-1 text-[14px] sm:text-[15px] text-muted-foreground">
            نسعد باستقبال استفساراتك واقتراحاتك أو الإبلاغ عن أي مشكلة عبر وسائل التواصل الرسمية.
          </p>
        </div>

        <Link
          to="/contact"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-sm font-extrabold text-primary-foreground hover:bg-primary/90 transition-all shadow-xs shrink-0"
        >
          <MessageSquare className="size-4" />
          <span>أرسل رسالة للإدارة</span>
        </Link>
      </div>

      {/* Admin Announcement / Notes */}
      {contactContent && (
        <div className="mt-4 surface p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-1 text-xs text-foreground/90">
          <p className="font-extrabold text-primary flex items-center gap-1.5">
            <HelpCircle className="size-3.5" /> ملاحظات هامة:
          </p>
          <p className="whitespace-pre-wrap leading-relaxed">{contactContent}</p>
        </div>
      )}

      {/* Contact Channels Grid */}
      {hasAnyContactMethod && (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Facebook Link */}
          {facebook && (
            <a
              href={safeExternalUrl(facebook) || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="surface group flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-border hover:border-[#1877F2]/50 hover:bg-[#1877F2]/5 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid size-10 place-items-center rounded-xl bg-[#1877F2]/10 text-[#1877F2] group-hover:scale-105 transition-transform shrink-0">
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
              className="surface group flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-border hover:border-success/50 hover:bg-success/5 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid size-10 place-items-center rounded-xl bg-success/10 text-success group-hover:scale-105 transition-transform shrink-0">
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
              className="surface group flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform shrink-0">
                  <Phone className="size-5" />
                </span>
                <div className="min-w-0 text-start">
                  <p className="text-sm font-extrabold text-foreground">الاتصال الهاتفي المباشر</p>
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
              className="surface group flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform shrink-0">
                  <Phone className="size-5" />
                </span>
                <div className="min-w-0 text-start">
                  <p className="text-sm font-extrabold text-foreground">هاتف إضافي</p>
                  <p className="text-xs font-bold text-muted-foreground" dir="ltr">
                    {secPhone}
                  </p>
                </div>
              </div>
              <PhoneCall className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </a>
          )}

          {/* Telegram Channel */}
          {telegram && (
            <a
              href={safeExternalUrl(telegram) || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="surface group flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-border hover:border-sky-500/50 hover:bg-sky-500/5 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid size-10 place-items-center rounded-xl bg-sky-500/10 text-sky-500 group-hover:scale-105 transition-transform shrink-0">
                  <Send className="size-5" />
                </span>
                <div className="min-w-0 text-start">
                  <p className="text-sm font-extrabold text-foreground">قناة تليجرام</p>
                  <p className="text-xs text-muted-foreground truncate" dir="ltr">
                    {telegram.replace(/^https?:\/\/(t\.me\/)?/i, "@") || "Telegram Channel"}
                  </p>
                </div>
              </div>
              <ExternalLink className="size-4 text-muted-foreground group-hover:text-sky-500 transition-colors shrink-0" />
            </a>
          )}

          {/* Email */}
          {email && (
            <a
              href={`mailto:${email}`}
              className="surface group flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-border hover:border-amber-500/50 hover:bg-amber-500/5 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-500 group-hover:scale-105 transition-transform shrink-0">
                  <Mail className="size-5" />
                </span>
                <div className="min-w-0 text-start">
                  <p className="text-sm font-extrabold text-foreground">البريد الإلكتروني</p>
                  <p className="text-xs text-muted-foreground truncate" dir="ltr">
                    {email}
                  </p>
                </div>
              </div>
              <ExternalLink className="size-4 text-muted-foreground group-hover:text-amber-500 transition-colors shrink-0" />
            </a>
          )}

          {/* Custom Link */}
          {customLink && (
            <a
              href={safeExternalUrl(customLink) || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="surface group flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform shrink-0">
                  <Globe className="size-5" />
                </span>
                <div className="min-w-0 text-start">
                  <p className="text-sm font-extrabold text-foreground">{customLinkLabel}</p>
                  <p className="text-xs text-muted-foreground truncate" dir="ltr">
                    {customLink}
                  </p>
                </div>
              </div>
              <ExternalLink className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </a>
          )}
        </div>
      )}

      {/* Address & Working Hours row if available */}
      {(address || hours) && (
        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3.5 rounded-xl border border-border bg-card/50 text-xs text-muted-foreground">
          {address && (
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-primary shrink-0" />
              <span className="font-bold text-foreground">{address}</span>
            </div>
          )}
          {hours && (
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary shrink-0" />
              <span>مواعيد التواصل: <strong className="text-foreground">{hours}</strong></span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
