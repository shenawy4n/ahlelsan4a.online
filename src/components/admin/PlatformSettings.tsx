import React, { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Palette,
  PhoneCall,
  Phone,
  FileText,
  Sliders,
  ImageIcon,
  Upload,
  Trash2,
  Loader2,
  Check,
  RotateCcw,
  ExternalLink,
  Globe,
  Info,
  Shield,
  Clock,
  MapPin,
  Mail,
  MessageCircle,
  Facebook,
  Share2,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/directory";
import { saveSettingsAdminFn } from "@/lib/admin-actions.functions";
import { ExperienceManager } from "./Lists";
import { ConfirmModal, type ConfirmState } from "./ConfirmModal";
import { AdminErrorState } from "./AdminErrorState";
import { input, btn, btnGhost } from "./shared";

type SettingsSection = "brand" | "contact" | "pages" | "general";

const CONTACT_FIELD_DEFINITIONS = [
  {
    key: "contact_phone",
    label: "رقم الهاتف الأساسي",
    group: "phones",
    dir: "ltr",
    placeholder: "01012345678",
    description: "الرقم الرئيسي للاتصال المباشر بإدارة المنصة",
  },
  {
    key: "contact_secondary_phone",
    label: "رقم هاتف إضافي (اختياري)",
    group: "phones",
    dir: "ltr",
    placeholder: "011...",
    description: "رقم بديل في حال انشغال الخط الأساسي",
  },
  {
    key: "contact_whatsapp",
    label: "رقم واتساب للتواصل والمراسلة",
    group: "phones",
    dir: "ltr",
    placeholder: "010...",
    description: "الرقم المخصص للمحادثة عبر واتساب بنقرة واحدة",
  },
  {
    key: "contact_email",
    label: "البريد الإلكتروني (اختياري)",
    group: "location",
    dir: "ltr",
    placeholder: "info@ahlelsan3a.online",
    description: "لاستقبال المراسلات الرسمية والاستفسارات",
  },
  {
    key: "contact_address",
    label: "المقر أو العنوان / القرية والمركز",
    group: "location",
    dir: "rtl",
    placeholder: "مثال: قرية كذا، مركز كذا، محافظة كذا",
    description: "النطاق الجغرافي أو مقر إدارة الدليل",
  },
  {
    key: "contact_hours",
    label: "مواعيد استقبال الاتصالات",
    group: "location",
    dir: "rtl",
    placeholder: "مثال: يومياً من ٩ صباحاً حتى ١١ مساءً",
    description: "الأوقات المناسبة لتواصل الجمهور مع الإدارة",
  },
  {
    key: "contact_facebook",
    label: "رابط صفحة أو جروب فيسبوك",
    group: "social",
    dir: "ltr",
    placeholder: "https://facebook.com/...",
    description: "رابط الصفحة أو المجتمع على فيسبوك",
  },
  {
    key: "contact_telegram",
    label: "رابط قناة أو جروب تليجرام",
    group: "social",
    dir: "ltr",
    placeholder: "https://t.me/...",
    description: "قناة التنبيهات أو جروب التواصل على تليجرام",
  },
  {
    key: "contact_custom_link",
    label: "رابط مخصص إضافي",
    group: "social",
    dir: "ltr",
    placeholder: "https://...",
    description: "أي منصة إضافية (إنستغرام، يوتيوب، إلخ)",
  },
  {
    key: "contact_custom_link_label",
    label: "اسم الرابط الإضافي",
    group: "social",
    dir: "rtl",
    placeholder: "مثال: قناتنا على يوتيوب",
    description: "النص المعروض للرابط المخصص",
  },
] as const;

interface PageDefinition {
  id: string;
  key: string;
  title: string;
  route: string;
  icon: typeof FileText;
  description: string;
  placeholder: string;
}

const PUBLIC_PAGES: PageDefinition[] = [
  {
    id: "about",
    key: "about_content",
    title: "من نحن",
    route: "/about",
    icon: Info,
    description: "التعريف بالمنصة، رؤيتها، أهدافها، وطبيعة الخدمة المجتمعية في القرية.",
    placeholder:
      "اكتب هنا نبذة مخصصة عن المنصة وفريق العمل وأهداف الخدمة...\nإذا تركت هذا الحقل فارغاً، ستعرض الصفحة المحتوى الاسترشادي الشامل تلقائياً.",
  },
  {
    id: "privacy",
    key: "privacy_content",
    title: "سياسة الخصوصية",
    route: "/privacy",
    icon: Shield,
    description: "سياسة حماية البيانات، تشفير أرقام الهواتف، وحقوق المستخدمين ومقدمي الخدمات.",
    placeholder:
      "اكتب هنا سياسة الخصوصية الخاصة بمنصتك بالتفصيل...\nإذا تركت هذا الحقل فارغاً، ستعرض الصفحة السياسة الاسترشادية الشاملة تلقائياً.",
  },
  {
    id: "terms",
    key: "terms_content",
    title: "شروط الاستخدام",
    route: "/terms",
    icon: FileText,
    description: "شروط الاستخدام، المسؤوليات القانونية، وضوابط التعامل مع الحرفيين.",
    placeholder:
      "اكتب هنا شروط وضوابط استخدام الدليل ومسؤولية الحرفيين والمستخدمين...\nإذا تركت هذا الحقل فارغاً، ستعرض الصفحة الشروط الاسترشادية الشاملة تلقائياً.",
  },
  {
    id: "contact_notes",
    key: "contact_content",
    title: "إرشادات صفحة تواصل معنا",
    route: "/contact",
    icon: PhoneCall,
    description: "ملاحظات وتعليمات تظهر في أعلى صفحة تواصل معنا (أوقات الصيانة، طريقة الإبلاغ، إلخ).",
    placeholder:
      "اكتب هنا أي ملاحظات أو تعليمات هامة تظهر للمستخدمين في أعلى صفحة تواصل معنا...",
  },
];

function fileToOptimizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 512;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const isPng = file.type === "image/png";
        const format = isPng ? "image/png" : "image/webp";
        resolve(canvas.toDataURL(format, 0.88));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PlatformSettings() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery(settingsQuery);

  const [activeSection, setActiveSection] = useState<SettingsSection>("brand");
  const [vals, setVals] = useState<Record<string, string> | null>(null);
  const v = vals ?? Object.fromEntries(Object.entries(data ?? {}).map(([k, x]) => [k, x ?? ""]));

  const [busy, setBusy] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [pagePreviewMode, setPagePreviewMode] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when data is re-fetched
  useEffect(() => {
    if (data && vals === null) {
      setVals(Object.fromEntries(Object.entries(data).map(([k, x]) => [k, x ?? ""])));
    }
  }, [data]);

  const updateVal = (key: string, value: string) => {
    setVals((prev) => ({ ...(prev ?? v), [key]: value }));
  };

  const saveKeys = async (keysToSave: string[], successMsg = "تم حفظ الإعدادات بنجاح") => {
    setBusy(true);
    // Explicitly guarantee safe, trimmed string values (never null) to satisfy non-null constraints
    const rows = keysToSave.map((key) => ({
      key,
      value: (v[key] !== undefined && v[key] !== null ? v[key] : "").trim(),
    }));

    try {
      const res = await saveSettingsAdminFn({ data: { rows } });
      if (!res.ok) {
        toast.error("تعذر حفظ الإعدادات، يرجى المحاولة مرة أخرى");
        return;
      }
      toast.success(successMsg);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["settings"] }),
        qc.invalidateQueries({ queryKey: ["homepage-data"] }),
      ]);
    } catch (err: any) {
      console.error("[saveSettings error]", err);
      toast.error(err.message || "حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setBusy(false);
    }
  };

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(file.type)) {
      toast.error("يرجى اختيار صورة بصيغة JPG أو PNG أو WEBP أو SVG");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت");
      return;
    }
    setUploadingLogo(true);
    try {
      const dataUrl = await fileToOptimizedDataUrl(file);
      let finalUrl = dataUrl;

      try {
        const ext = file.name.split(".").pop() || "png";
        const path = `platform/logo_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("provider-photos").upload(path, file, {
          cacheControl: "3600",
          upsert: true,
        });
        if (!uploadError) {
          const { data: pubData } = supabase.storage.from("provider-photos").getPublicUrl(path);
          if (pubData?.publicUrl) {
            finalUrl = pubData.publicUrl;
          }
        }
      } catch {
        // Fallback to dataUrl
      }

      updateVal("logo_url", finalUrl);
      await saveSettingsAdminFn({
        data: { rows: [{ key: "logo_url", value: finalUrl }] },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["settings"] }),
        qc.invalidateQueries({ queryKey: ["homepage-data"] }),
      ]);
      toast.success("تم تحديث وحفظ لوجو المنصة بنجاح");
    } catch (err: any) {
      toast.error(err.message || "فشل رفع اللوجو");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function applyDirectLogoUrl() {
    const url = logoUrlInput.trim();
    if (!url) return;
    setBusy(true);
    try {
      await saveSettingsAdminFn({
        data: { rows: [{ key: "logo_url", value: url }] },
      });
      updateVal("logo_url", url);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["settings"] }),
        qc.invalidateQueries({ queryKey: ["homepage-data"] }),
      ]);
      toast.success("تم حفظ رابط اللوجو بنجاح");
      setLogoUrlInput("");
    } catch (err: any) {
      toast.error(err.message || "فشل حفظ اللوجو");
    } finally {
      setBusy(false);
    }
  }

  async function removeLogo() {
    setConfirmState({
      open: true,
      title: "إزالة لوجو المنصة؟",
      description: "هل أنت متأكد من رغبتك في إزالة اللوجو المخصص والرجوع للشعار النصي الافتراضي؟",
      confirmLabel: "نعم، أزل اللوجو",
      destructive: true,
      onConfirm: async () => {
        updateVal("logo_url", "");
        try {
          await saveSettingsAdminFn({
            data: { rows: [{ key: "logo_url", value: "" }] },
          });
          await Promise.all([
            qc.invalidateQueries({ queryKey: ["settings"] }),
            qc.invalidateQueries({ queryKey: ["homepage-data"] }),
          ]);
          toast.success("تمت إزالة اللوجو والعودة للشعار الافتراضي");
        } catch {
          toast.error("فشل إزالة اللوجو");
        } finally {
          setConfirmState(null);
        }
      },
    });
  }

  if (isLoading) {
    return (
      <div className="surface p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="font-bold">جاري تحميل إعدادات المنصة...</p>
      </div>
    );
  }

  if (isError) {
    return <AdminErrorState title="تعذر تحميل إعدادات المنصة" error={error} onRetry={() => refetch()} />;
  }

  const currentLogo = v["logo_url"] || data?.["logo_url"];
  const appName = v["app_name"] || data?.["app_name"] || "أهل الصنعة";
  const tagline = v["tagline"] || data?.["tagline"] || "دليل خدمات القرية المعتمد";

  const SECTIONS = [
    {
      id: "brand" as const,
      label: "الهوية البصرية",
      icon: Palette,
      description: "اسم التطبيق، الشعار، اللوجو، والمعاينة الحية للهيدر",
    },
    {
      id: "contact" as const,
      label: "معلومات التواصل",
      icon: PhoneCall,
      description: "أرقام الهواتف، واتساب، البريد، العنوان، وقنوات التواصل الاجتماعي",
    },
    {
      id: "pages" as const,
      label: "صفحات الموقع",
      icon: FileText,
      description: "إدارة محتوى صفحات من نحن، سياسة الخصوصية، شروط الاستخدام، وتواصل معنا",
    },
    {
      id: "general" as const,
      label: "إعدادات عامة",
      icon: Sliders,
      description: "الحالة الافتراضية للصنايعي الجديد وإدارة مستويات الخبرة",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Settings Navigation Header */}
      <div className="surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="text-xl font-extrabold text-foreground">إعدادات المنصة والهوية</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              هيكل إداري منظم للهوية البصرية، قنوات التواصل، صفحات المحتوى القانوني، والإعدادات العامة.
            </p>
          </div>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline bg-primary/10 px-3.5 py-2 rounded-xl border border-primary/20 transition-colors"
          >
            <span>معاينة الموقع للجمهور</span>
            <ExternalLink className="size-3.5" />
          </a>
        </div>

        {/* Section Tabs */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  setActiveSection(sec.id);
                  setEditingPageId(null);
                }}
                className={`flex items-center gap-2.5 rounded-2xl p-3 text-start font-bold transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"
                    : "bg-card hover:bg-secondary/70 text-muted-foreground hover:text-foreground border border-border"
                }`}
              >
                <div
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                    active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm truncate font-black">{sec.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION A: Brand Identity */}
      {activeSection === "brand" && (
        <div className="space-y-6">
          {/* Logo & Visual Assets */}
          <div className="surface p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                  <ImageIcon className="size-5 text-primary" />
                  شعار وهوية المنصة (اللوجو)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  اللوجو يظهر في الهيدر، الفوتر، ومعاينات المشاركة الاجتماعية (OpenGraph).
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl border border-border bg-card">
              <div className="relative shrink-0">
                {currentLogo ? (
                  <img
                    src={currentLogo}
                    alt={appName}
                    className="size-24 rounded-2xl object-contain bg-background border border-border shadow-sm p-1.5"
                  />
                ) : (
                  <div className="size-24 rounded-2xl bg-primary text-4xl font-black text-primary-foreground grid place-items-center shadow-sm">
                    {appName.charAt(0)}
                  </div>
                )}
              </div>

              <div className="space-y-2.5 text-center sm:text-start flex-1 min-w-0">
                <div>
                  <p className="font-extrabold text-sm text-foreground">
                    {currentLogo ? "لوجو مخصص مفعّل" : "الشعار النصي الافتراضي (الحرف الأول من اسم المنصة)"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    صيغ الصور المدعومة: PNG, JPG, WEBP, SVG. يتم تحسين الصورة تلقائياً للحفاظ على سرعة التحميل على شبكات الموبايل.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload-input"
                  />
                  <label
                    htmlFor="logo-upload-input"
                    className="cursor-pointer inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-black text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-xs"
                  >
                    {uploadingLogo ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    <span>{currentLogo ? "رفع صورة بديلة من جهازك" : "رفع لوجو من جهازك"}</span>
                  </label>

                  {currentLogo && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs sm:text-sm font-bold text-destructive hover:bg-destructive/15 active:scale-95 transition-all"
                    >
                      <Trash2 className="size-4" />
                      <span>إزالة اللوجو</span>
                    </button>
                  )}
                </div>

                {/* Direct URL input fallback */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-border/60">
                  <input
                    value={logoUrlInput}
                    onChange={(e) => setLogoUrlInput(e.target.value)}
                    placeholder="أو ضع رابط صورة مباشر (https://...)"
                    className="w-full sm:max-w-xs rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={applyDirectLogoUrl}
                    disabled={!logoUrlInput.trim() || busy}
                    className="w-full sm:w-auto rounded-xl border border-border bg-secondary hover:bg-secondary/80 px-4 py-2 text-xs font-bold text-foreground disabled:opacity-50 transition-colors"
                  >
                    تطبيق الرابط
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Names & Header Live Preview */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveKeys(["app_name", "tagline"], "تم حفظ اسم المنصة والشعار بنجاح");
            }}
            className="surface p-5 sm:p-6 space-y-6"
          >
            <div className="border-b border-border pb-3">
              <h3 className="text-lg font-black text-foreground">بيانات التسمية والهوية</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                تظهر هذه النصوص في الهيدر، الفوتر، وعناوين الصفحات لمحركات البحث والروابط.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-bold text-foreground">
                <span>اسم المنصة / التطبيق</span>
                <input
                  value={v["app_name"] ?? ""}
                  onChange={(e) => updateVal("app_name", e.target.value)}
                  className={input}
                  placeholder="مثال: أهل الصنعة"
                  maxLength={100}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-bold text-foreground">
                <span>الشعار اللفظي (Tagline)</span>
                <input
                  value={v["tagline"] ?? ""}
                  onChange={(e) => updateVal("tagline", e.target.value)}
                  className={input}
                  placeholder="مثال: دليل خدمات القرية المعتمد"
                  maxLength={150}
                />
              </label>
            </div>

            {/* Live Header Simulation */}
            <div className="rounded-2xl border border-border/80 bg-background/50 p-4 space-y-2">
              <p className="text-xs font-black text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                معاينة حية لشكل الهيدر كما يظهر للجمهور
              </p>
              <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {currentLogo ? (
                    <img src={currentLogo} alt={appName} className="size-10 rounded-xl object-contain" />
                  ) : (
                    <div className="grid size-10 place-items-center rounded-xl bg-primary text-base font-black text-primary-foreground">
                      {appName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-black text-base leading-tight text-foreground">{appName}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">{tagline}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-muted-foreground bg-secondary px-2.5 py-1 rounded-lg">
                  نسخة تجريبية
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-black text-primary-foreground hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 transition-all shadow-xs cursor-pointer"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                <span>حفظ بيانات الهوية</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECTION B: Contact Information */}
      {activeSection === "contact" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const keys = CONTACT_FIELD_DEFINITIONS.map((f) => f.key);
            saveKeys(keys, "تم حفظ كافة معلومات وقنوات التواصل بنجاح");
          }}
          className="surface p-5 sm:p-6 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <PhoneCall className="size-5 text-primary" />
                معلومات وقنوات التواصل الرسمية
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                تظهر هذه البيانات في صفحة «تواصل معنا» (/contact) وفي الفوتر السفلي للموقع.
              </p>
            </div>
            <a
              href="/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20 transition-colors"
            >
              <span>معاينة صفحة تواصل معنا</span>
              <Globe className="size-3.5" />
            </a>
          </div>

          {/* Group 1: Phones & WhatsApp */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-foreground flex items-center gap-1.5 text-primary">
              <Phone className="size-4" />
              أرقام الهواتف والواتساب المباشر
            </h4>
            <div className="grid gap-3 sm:grid-cols-3">
              {CONTACT_FIELD_DEFINITIONS.filter((f) => f.group === "phones").map((f) => (
                <label key={f.key} className="grid gap-1 text-xs sm:text-sm font-bold text-foreground">
                  <span>{f.label}</span>
                  <input
                    value={v[f.key] ?? ""}
                    dir={f.dir}
                    placeholder={f.placeholder}
                    onChange={(e) => updateVal(f.key, e.target.value)}
                    className={input}
                    maxLength={30}
                  />
                  <span className="text-[11px] text-muted-foreground font-normal">{f.description}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Group 2: Location, Hours & Email */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-sm font-black text-foreground flex items-center gap-1.5 text-primary">
              <MapPin className="size-4" />
              المقر والعنوان وساعات العمل والبريد
            </h4>
            <div className="grid gap-3 sm:grid-cols-3">
              {CONTACT_FIELD_DEFINITIONS.filter((f) => f.group === "location").map((f) => (
                <label key={f.key} className="grid gap-1 text-xs sm:text-sm font-bold text-foreground">
                  <span>{f.label}</span>
                  <input
                    value={v[f.key] ?? ""}
                    dir={f.dir}
                    placeholder={f.placeholder}
                    onChange={(e) => updateVal(f.key, e.target.value)}
                    className={input}
                    maxLength={200}
                  />
                  <span className="text-[11px] text-muted-foreground font-normal">{f.description}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Group 3: Social & Communities */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-sm font-black text-foreground flex items-center gap-1.5 text-primary">
              <Share2 className="size-4" />
              قنوات ومجتمعات التواصل الاجتماعي
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {CONTACT_FIELD_DEFINITIONS.filter((f) => f.group === "social").map((f) => (
                <label key={f.key} className="grid gap-1 text-xs sm:text-sm font-bold text-foreground">
                  <span>{f.label}</span>
                  <input
                    value={v[f.key] ?? ""}
                    dir={f.dir}
                    placeholder={f.placeholder}
                    onChange={(e) => updateVal(f.key, e.target.value)}
                    className={input}
                    maxLength={300}
                  />
                  <span className="text-[11px] text-muted-foreground font-normal">{f.description}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              ملاحظة: الحقول الاختيارية التي تُترك فارغة لا تظهر للجمهور، وتُحفظ بأمان دون أي تعارض مع قاعدة البيانات.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-black text-primary-foreground hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 transition-all shadow-xs cursor-pointer"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              <span>حفظ معلومات التواصل</span>
            </button>
          </div>
        </form>
      )}

      {/* SECTION C: Public Site Pages Content Management */}
      {activeSection === "pages" && (
        <div className="space-y-6">
          {editingPageId ? (
            /* Dedicated Page Content Editor */
            (() => {
              const page = PUBLIC_PAGES.find((p) => p.id === editingPageId);
              if (!page) return null;
              const currentValue = v[page.key] ?? "";
              const charCount = currentValue.length;
              const wordCount = currentValue.trim() ? currentValue.trim().split(/\s+/).length : 0;

              return (
                <div className="surface p-5 sm:p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                        <page.icon className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-foreground">
                          تعديل محتوى صفحة «{page.title}»
                        </h3>
                        <p className="text-xs text-muted-foreground">{page.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={page.route}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20"
                      >
                        <span>معاينة الصفحة العامة</span>
                        <ExternalLink className="size-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPageId(null);
                          setPagePreviewMode(false);
                        }}
                        className="rounded-xl border border-border px-3.5 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary"
                      >
                        إغلاق المحرر
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span>عدد الكلمات: <strong className="text-foreground">{wordCount}</strong></span>
                      <span>عدد الحروف: <strong className="text-foreground">{charCount}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPagePreviewMode(!pagePreviewMode)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                    >
                      <Eye className="size-3.5" />
                      <span>{pagePreviewMode ? "الرجوع لصندوق التحرير" : "معاينة طريقة العرض للجمهور"}</span>
                    </button>
                  </div>

                  {pagePreviewMode ? (
                    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-4">
                      <div className="border-b border-border pb-3">
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                          معاينة مباشرة كما تظهر في {page.route}
                        </span>
                        <h4 className="text-xl font-black mt-2 text-foreground">{page.title}</h4>
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed text-sm sm:text-base text-foreground/90 font-medium">
                        {currentValue.trim() || (
                          <span className="text-muted-foreground italic">
                            (لا يوجد نص مخصص محفوظ؛ الصفحة ستعرض المحتوى الاسترشادي الافتراضي الشامل).
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        rows={12}
                        value={currentValue}
                        onChange={(e) => updateVal(page.key, e.target.value)}
                        placeholder={page.placeholder}
                        className={`${input} font-sans leading-relaxed text-sm sm:text-base p-4 min-h-[260px]`}
                      />
                      <p className="text-xs text-muted-foreground">
                        نصيحة: يمكنك استخدام فقرات واضحة وفواصل أسطر لتنظيم المحتوى. النصوص تُعرض كما هي للزوار بنسق أنيق ومنظم.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => {
                        updateVal(page.key, "");
                        toast.info("تم تفريغ النص للعودة إلى المحتوى الاسترشادي الافتراضي");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <RotateCcw className="size-3.5" />
                      <span>استعادة النص الافتراضي (تفريغ النص المخصص)</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPageId(null);
                          setPagePreviewMode(false);
                        }}
                        className="rounded-xl border border-border px-4 py-2 text-xs font-bold hover:bg-secondary transition-colors"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          await saveKeys([page.key], `تم حفظ محتوى صفحة «${page.title}» بنجاح`);
                          setEditingPageId(null);
                          setPagePreviewMode(false);
                        }}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-6 py-2 text-xs sm:text-sm font-black text-primary-foreground hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 transition-all shadow-xs"
                      >
                        {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        <span>حفظ التعديلات</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            /* Page Cards List */
            <div className="space-y-4">
              <div className="surface p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-foreground">صفحات المحتوى والمعلومات</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    تحكم في النصوص المعروضة في الصفحات الثابتة العامة. الصفحات الفارغة تستخدم النصوص الاسترشادية الجاهزة تلقائياً.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {PUBLIC_PAGES.map((page) => {
                  const Icon = page.icon;
                  const hasCustom = Boolean(v[page.key]?.trim());
                  const contentSnippet = v[page.key]?.trim() || "";

                  return (
                    <div
                      key={page.id}
                      className="surface p-5 rounded-2xl space-y-4 border border-border/80 hover:border-primary/40 transition-all shadow-xs flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                              <Icon className="size-5" />
                            </div>
                            <div>
                              <h4 className="font-black text-base text-foreground">{page.title}</h4>
                              <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                                {page.route}
                              </span>
                            </div>
                          </div>

                          {hasCustom ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-bold text-success">
                              <CheckCircle2 className="size-3.5" />
                              محتوى مخصص
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                              افتراضي شامل
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {page.description}
                        </p>

                        {hasCustom && (
                          <div className="rounded-xl border border-border/60 bg-background/50 p-2.5 text-xs text-muted-foreground line-clamp-2">
                            «{contentSnippet.slice(0, 140)}…»
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
                        <a
                          href={page.route}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="size-3.5" />
                          <span>معاينة الصفحة</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingPageId(page.id);
                            setPagePreviewMode(false);
                          }}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-primary/10 px-4 py-1.5 text-xs font-black text-primary hover:bg-primary/20 active:scale-95 transition-all"
                        >
                          <span>تعديل المحتوى</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION D: General Platform Settings */}
      {activeSection === "general" && (
        <div className="space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveKeys(["default_provider_status"], "تم حفظ الإعدادات العامة بنجاح");
            }}
            className="surface p-5 sm:p-6 space-y-5"
          >
            <div className="border-b border-border pb-3">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <Sliders className="size-5 text-primary" />
                الإعدادات العامة وقواعد التشغيل
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                قواعد نشر مقدمي الخدمات الافتراضية وحالة الحسابات الجديدة.
              </p>
            </div>

            <label className="grid gap-1.5 text-sm font-bold text-foreground max-w-md">
              <span>الحالة الافتراضية للصنايعي الجديد عند الإضافة أو القبول</span>
              <select
                value={v["default_provider_status"] || "active"}
                onChange={(e) => updateVal("default_provider_status", e.target.value)}
                className={input}
              >
                <option value="active">ظاهر في الدليل فوراً (نشط)</option>
                <option value="hidden">مخفي (يتطلب تفعيل يدوي من الإدارة)</option>
              </select>
              <span className="text-xs text-muted-foreground font-normal">
                عند اختيار «مخفي»، سيضاف الصنايعي في قاعدة البيانات لكنه لن يظهر في نتائج البحث حتى يقوم المشرف بتفعيله يدوياً.
              </span>
            </label>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-black text-primary-foreground hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 transition-all shadow-xs cursor-pointer"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                <span>حفظ الإعدادات العامة</span>
              </button>
            </div>
          </form>

          {/* Years of Experience List Manager */}
          <div className="surface p-5 sm:p-6 space-y-4">
            <div className="border-b border-border pb-3">
              <h3 className="text-lg font-black text-foreground">خيارات سنوات الخبرة</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                تحديد مستويات وسنوات الخبرة التي يختار منها الصنايعي أو الباحث عند التصفية.
              </p>
            </div>
            <ExperienceManager />
          </div>
        </div>
      )}

      {confirmState && <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />}
    </div>
  );
}
