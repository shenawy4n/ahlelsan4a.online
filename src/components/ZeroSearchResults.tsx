import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { SearchX, MapPin, Tag, Lightbulb, UserPlus, ArrowLeft, Check, Sparkles, Truck } from "lucide-react";
import { submitPublicForm, publicFormError } from "@/lib/public-forms.functions";
import { categoriesQuery, areasQuery, type Category, type Area } from "@/lib/directory";
import type { AvailabilityFilterMode } from "@/components/AvailabilityFilter";

interface ZeroSearchResultsProps {
  query?: string;
  categoryId?: string;
  areaId?: string;
  filterMode?: AvailabilityFilterMode;
  deliveryOnly?: boolean;
  onClearArea?: () => void;
  onClearFilter?: () => void;
  onClearDelivery?: () => void;
  onClearQuery?: () => void;
  categories?: Category[];
  areas?: Area[];
}

export function ZeroSearchResults({
  query = "",
  categoryId = "",
  areaId = "",
  filterMode = "all",
  deliveryOnly = false,
  onClearArea,
  onClearFilter,
  onClearDelivery,
  onClearQuery,
  categories = [],
  areas = [],
}: ZeroSearchResultsProps) {
  const qCategories = useQuery(categoriesQuery);
  const qAreas = useQuery(areasQuery);
  const resolvedCategories = categories.length > 0 ? categories : (qCategories.data ?? []);
  const resolvedAreas = areas.length > 0 ? areas : (qAreas.data ?? []);

  const [showSuggestService, setShowSuggestService] = useState(false);
  const [serviceName, setServiceName] = useState(query);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestHp, setSuggestHp] = useState("");
  const [suggestDone, setSuggestDone] = useState(false);

  const [showJoin, setShowJoin] = useState(false);
  const [joinForm, setJoinForm] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    category_id: categoryId || "",
    area_id: areaId || "",
  });
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinHp, setJoinHp] = useState("");
  const [joinDone, setJoinDone] = useState(false);

  async function handleSuggestService(e: React.FormEvent) {
    e.preventDefault();
    const val = (serviceName || query).trim();
    if (val.length < 2) {
      toast.error("يرجى كتابة اسم الخدمة المقترحة");
      return;
    }
    setSuggestBusy(true);
    try {
      const res = await submitPublicForm({
        data: {
          form: "service_suggestion",
          name: val.slice(0, 60),
          website: suggestHp,
        },
      });
      if (!res.ok) {
        toast.error(publicFormError(res.code));
      } else {
        toast.success("شكراً لك! استلمنا اقتراح الخدمة وسنعمل على إضافتها قريباً.");
        setSuggestDone(true);
      }
    } catch {
      toast.error("حدث خطأ أثناء إرسال الاقتراح، يرجى المحاولة لاحقاً");
    } finally {
      setSuggestBusy(false);
    }
  }

  async function handleJoinProvider(e: React.FormEvent) {
    e.preventDefault();
    if (!joinForm.name.trim() || !joinForm.phone.trim() || !joinForm.category_id || !joinForm.area_id) {
      toast.error("يرجى ملء الاسم والتليفون والقسم والمنطقة");
      return;
    }
    setJoinBusy(true);
    try {
      const res = await submitPublicForm({
        data: {
          form: "provider_application",
          website: joinHp,
          name: joinForm.name.trim(),
          phone: joinForm.phone.trim(),
          whatsapp: joinForm.whatsapp.trim() || undefined,
          category_id: joinForm.category_id || undefined,
          area_id: joinForm.area_id || undefined,
        },
      });
      if (!res.ok) {
        toast.error(publicFormError(res.code));
      } else {
        toast.success("شكراً لك! تم استلام طلب انضمامك وسيتم مراجعته والتواصل معك.");
        setJoinDone(true);
      }
    } catch {
      toast.error("حدث خطأ أثناء إرسال طلب الانضمام");
    } finally {
      setJoinBusy(false);
    }
  }

  const isDeliveryEmptyOnly = deliveryOnly && filterMode === "all" && !query.trim();

  return (
    <div className="surface grid gap-6 p-6 sm:p-8 text-center rounded-2xl shadow-xs">
      {/* Icon and Main Title */}
      <div className="mx-auto flex flex-col items-center">
        <div
          className={`grid size-16 place-items-center rounded-2xl shadow-xs ring-1 ${
            isDeliveryEmptyOnly
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/25"
              : "bg-primary/10 text-primary ring-primary/20"
          }`}
        >
          {isDeliveryEmptyOnly ? (
            <Truck className="size-8" aria-hidden="true" />
          ) : (
            <SearchX className="size-8" aria-hidden="true" />
          )}
        </div>
        <h3 className="mt-4 font-display text-xl sm:text-2xl font-black text-foreground">
          {isDeliveryEmptyOnly
            ? "لا توجد خدمات توصيل للمنازل مسجلة حالياً"
            : "لا يوجد صنايعية مطابقون لبحثك"}
        </h3>
        <p className="mt-1.5 text-sm sm:text-base text-muted-foreground font-medium max-w-md">
          {query.trim()
            ? `لم نعثر على صنايعية مسجلين باسم أو خدمة «${query.trim()}»${deliveryOnly ? " ويوفرون خدمة التوصيل" : ""}`
            : deliveryOnly
            ? areaId
              ? "لم نجد خدمات توفر التوصيل للمنازل مسجلة حالياً في هذه المنطقة، لكن يمكنك تصفح باقي الصنايعية أو ترشيح من يوفر التوصيل."
              : "لا توجد خدمات توفر التوصيل للمنازل مسجلة حالياً وفق هذا البحث."
            : "لم نتمكن من العثور على أي نتائج وفق الفلاتر المحددة"}
        </p>
      </div>

      {/* Action: If Delivery filter is active */}
      {deliveryOnly && onClearDelivery && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs sm:text-sm text-foreground text-start">
          <p className="font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
            <Truck className="size-4 shrink-0" aria-hidden="true" />
            <span>فلتر «توصيل للمنازل» مفعّل</span>
          </p>
          <p className="mt-1 opacity-90 font-medium">
            يوجد صنايعية ومقدمو خدمات مسجلون في هذه المنطقة، ولكنهم لم يسجلوا توفير خدمة التوصيل للمنازل في بياناتهم.
          </p>
          <button
            type="button"
            onClick={onClearDelivery}
            className="mt-2.5 inline-flex min-h-[40px] items-center gap-1 font-black text-primary underline hover:text-primary/80 transition-colors cursor-pointer"
          >
            إلغاء فلتر التوصيل وعرض كل الصنايعية المتاحين
          </button>
        </div>
      )}

      {/* Action: If Availability or Emergency filter is active */}
      {filterMode !== "all" && onClearFilter && (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-xs sm:text-sm text-foreground text-start">
          <p className="font-black text-warning-foreground">
            💡 ملاحظة: فلتر ({filterMode === "available_now" ? "متاح الآن" : "طوارئ ٢٤ ساعة"}) مفعل.
          </p>
          <p className="mt-1 opacity-90 font-medium">
            قد يكون هناك صنايعية مسجلون في هذه الخدمة ولكن مواعيد عملهم مغلقة حالياً.
          </p>
          <button
            type="button"
            onClick={onClearFilter}
            className="mt-2.5 inline-flex min-h-[40px] items-center gap-1 font-black text-primary underline hover:text-primary/80 transition-colors cursor-pointer"
          >
            إلغاء فلتر التواجد وعرض كل الصنايعية
          </button>
        </div>
      )}

      {/* Quick Suggestions Options */}
      <div className="grid gap-3 text-start">
        <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
          جرّب أحد الحلول التالية:
        </h4>

        <div className="grid gap-2.5">
          {/* Option A: Change Area */}
          {areaId && onClearArea && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-border/80 bg-card/80 p-3.5 text-xs sm:text-sm shadow-2xs">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-primary shrink-0" aria-hidden="true" />
                <span className="font-extrabold text-foreground">جرّب منطقة أخرى أو ابحث في كل القرى:</span>
              </div>
              <button
                type="button"
                onClick={onClearArea}
                className="min-h-[40px] inline-flex items-center font-black text-primary underline hover:text-primary/80 transition-colors shrink-0"
              >
                البحث في كل المناطق
              </button>
            </div>
          )}

          {/* Option B: Try Another Category */}
          {categories.length > 0 && (
            <div className="rounded-2xl border border-border/80 bg-card/80 p-3.5 text-xs sm:text-sm shadow-2xs">
              <div className="flex items-center gap-1.5 font-extrabold text-foreground mb-2.5">
                <Tag className="size-4 text-primary shrink-0" aria-hidden="true" />
                <span>جرّب تصنيفاً آخر من الخدمات الأكثر طلباً:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.slice(0, 6).map((cat) => (
                  <Link
                    key={cat.id}
                    to="/category/$id"
                    params={{ id: cat.id }}
                    className="rounded-lg border border-border bg-secondary/70 px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-secondary hover:text-primary transition-colors"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Option C: Suggest a Service */}
          <div className="rounded-xl border border-border bg-card/60 p-3 text-xs">
            {!showSuggestService ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="size-4 text-warning shrink-0" />
                  <span className="font-bold text-foreground">مش لاقي الخدمة اللي بتدور عليها؟</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSuggestService(true)}
                  className="font-extrabold text-primary underline hover:text-primary/80"
                >
                  اقترح خدمة جديدة
                </button>
              </div>
            ) : suggestDone ? (
              <div className="flex items-center gap-2 text-success font-bold py-1">
                <Check className="size-4" />
                <span>تم إرسال اقتراحك بنجاح! شكراً لمساعدتنا في تطوير الدليل.</span>
              </div>
            ) : (
              <form onSubmit={handleSuggestService} className="grid gap-2 pt-1">
                <div className="flex items-center justify-between font-bold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Lightbulb className="size-4 text-warning" /> اقترح خدمة مش موجودة:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSuggestService(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    إلغاء
                  </button>
                </div>
                <input
                  value={suggestHp}
                  onChange={(e) => setSuggestHp(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                />
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="مثال: تصليح غسالات، فني دش، فني ألوميتال..."
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  maxLength={60}
                  required
                />
                <button
                  type="submit"
                  disabled={suggestBusy}
                  className="rounded-lg bg-primary py-2 text-xs font-extrabold text-primary-foreground disabled:opacity-60"
                >
                  {suggestBusy ? "جاري الإرسال..." : "إرسال الاقتراح"}
                </button>
              </form>
            )}
          </div>

          {/* Option D: Join as Provider (ضيف نفسك) */}
          <div className="rounded-xl border border-border bg-card/60 p-3 text-xs">
            {!showJoin ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="size-4 text-primary shrink-0" />
                  <span className="font-bold text-foreground">صاحب صنعة أو حرفي في المنطقة دي؟</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowJoin(true)}
                  className="font-extrabold text-primary underline hover:text-primary/80"
                >
                  ضيف نفسك في الدليل
                </button>
              </div>
            ) : joinDone ? (
              <div className="flex items-center gap-2 text-success font-bold py-1">
                <Check className="size-4" />
                <span>تم إرسال طلب انضمامك بنجاح! سنقوم بمراجعته والتواصل معك لنشر بياناتك.</span>
              </div>
            ) : (
              <form onSubmit={handleJoinProvider} className="grid gap-2 pt-1">
                <div className="flex items-center justify-between font-bold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <UserPlus className="size-4 text-primary" /> سجّل بياناتك كصنايعي:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowJoin(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    إلغاء
                  </button>
                </div>
                <input
                  value={joinHp}
                  onChange={(e) => setJoinHp(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                />
                <input
                  type="text"
                  value={joinForm.name}
                  onChange={(e) => setJoinForm({ ...joinForm, name: e.target.value })}
                  placeholder="اسمك أو اسم الورشة *"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  maxLength={80}
                  required
                />
                <input
                  type="tel"
                  dir="ltr"
                  value={joinForm.phone}
                  onChange={(e) => setJoinForm({ ...joinForm, phone: e.target.value })}
                  placeholder="رقم تليفونك للتواصل *"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary text-end"
                  maxLength={30}
                  required
                />
                {resolvedCategories.length > 0 && (
                  <select
                    value={joinForm.category_id}
                    onChange={(e) => setJoinForm({ ...joinForm, category_id: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground outline-none"
                    required
                  >
                    <option value="">اختار الصنعة / المهنة *</option>
                    {resolvedCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                {resolvedAreas.length > 0 && (
                  <select
                    value={joinForm.area_id}
                    onChange={(e) => setJoinForm({ ...joinForm, area_id: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground outline-none"
                    required
                  >
                    <option value="">اختار المنطقة / القرية *</option>
                    {resolvedAreas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="submit"
                  disabled={joinBusy}
                  className="rounded-lg bg-primary py-2 text-xs font-extrabold text-primary-foreground disabled:opacity-60"
                >
                  {joinBusy ? "جاري الإرسال..." : "إرسال طلب الانضمام للدليل"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
