import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Zap,
  Truck,
  ArrowUp,
  ArrowDown,
  GripVertical,
  RotateCcw,
  Check,
  Loader2,
  Info,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { settingsQuery } from "@/lib/directory";
import { saveSettingsAdminFn } from "@/lib/admin-actions.functions";
import {
  type ShortcutId,
  SHORTCUT_DEFINITIONS,
  SHORTCUT_SETTINGS_KEY,
  LEGACY_SHORTCUT_SETTINGS_KEY,
  DEFAULT_SHORTCUTS_ORDER,
  resolveShortcutsOrder,
  validateShortcutsOrder,
} from "@/lib/shortcuts";
import { ConfirmModal, type ConfirmState } from "./ConfirmModal";

export function ServiceShortcutsOrder() {
  const qc = useQueryClient();
  const { data: settings, isLoading, isError, refetch } = useQuery(settingsQuery);

  const savedOrder = resolveShortcutsOrder(
    settings?.[SHORTCUT_SETTINGS_KEY] || settings?.[LEGACY_SHORTCUT_SETTINGS_KEY]
  );

  const [order, setOrder] = useState<ShortcutId[]>(savedOrder);
  const [busy, setBusy] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Sync state whenever settings query data updates
  useEffect(() => {
    if (settings) {
      setOrder(
        resolveShortcutsOrder(
          settings[SHORTCUT_SETTINGS_KEY] || settings[LEGACY_SHORTCUT_SETTINGS_KEY]
        )
      );
    }
  }, [settings]);

  // Check if current working order differs from server-saved order
  const hasChanges = JSON.stringify(order) !== JSON.stringify(savedOrder);
  const isDefault = JSON.stringify(order) === JSON.stringify(DEFAULT_SHORTCUTS_ORDER);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const [removed] = next.splice(index, 1);
    next.splice(target, 0, removed);
    setOrder(next);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const next = [...order];
    const [removed] = next.splice(draggedIndex, 1);
    next.splice(index, 0, removed);
    setDraggedIndex(index);
    setOrder(next);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleReset = () => {
    if (hasChanges) {
      setConfirmState({
        open: true,
        title: "استعادة الترتيب الافتراضي؟",
        description:
          "هل أنت متأكد من رغبتك في إلغاء التغييرات والرجوع للترتيب الافتراضي: (متاح الآن ← طوارئ ٢٤ ساعة ← توصيل للمنازل)؟",
        confirmLabel: "نعم، استعد الترتيب الافتراضي",
        onConfirm: () => {
          setOrder([...DEFAULT_SHORTCUTS_ORDER]);
          setConfirmState(null);
        },
      });
    } else {
      setOrder([...DEFAULT_SHORTCUTS_ORDER]);
      toast.info("تمت استعادة الترتيب الافتراضي في واجهة التحكم");
    }
  };

  const handleSave = async () => {
    const validation = validateShortcutsOrder(order);
    if (!validation.valid) {
      toast.error(validation.error || "ترتيب غير صالح");
      return;
    }

    setBusy(true);
    try {
      const serialized = JSON.stringify(validation.order);
      const res = await saveSettingsAdminFn({
        data: {
          rows: [
            { key: SHORTCUT_SETTINGS_KEY, value: serialized },
            { key: LEGACY_SHORTCUT_SETTINGS_KEY, value: serialized },
          ],
        },
      });

      if (!res.ok) {
        toast.error("فشل حفظ الترتيب، يرجى المحاولة مرة أخرى");
        return;
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["settings"] }),
        qc.invalidateQueries({ queryKey: ["homepage-data"] }),
      ]);

      toast.success("تم حفظ ترتيب اختصارات الخدمات بنجاح");
    } catch (err: any) {
      console.error("[saveShortcutsOrder error]", err);
      toast.error(err.message || "حدث خطأ أثناء حفظ الترتيب");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="surface p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="font-bold text-sm">جاري تحميل إعدادات الاختصارات...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="surface p-6 text-center space-y-3 border border-destructive/20 bg-destructive/5">
        <p className="font-extrabold text-destructive text-sm">تعذر تحميل إعدادات اختصارات الخدمات</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          حاول تاني
        </button>
      </div>
    );
  }

  const arabicNumbers = ["١", "٢", "٣", "٤", "٥"];

  return (
    <div className="surface p-5 sm:p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-foreground">ترتيب اختصارات الخدمات</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              تحكم في ترتيب ظهور شارات الفلترة السريعة في الصفحة الرئيسية للمستخدمين (متاح الآن، طوارئ ٢٤ ساعة، توصيل للمنازل).
            </p>
          </div>
          {hasChanges && (
            <span className="inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              تغييرات غير محفوظة
            </span>
          )}
        </div>
      </div>

      {/* Info notice */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
        <Info className="size-4 text-primary shrink-0 mt-0.5" />
        <div>
          <span>
            هذا الإعداد يتحكم فقط في <strong className="text-foreground">ترتيب العرض البصري</strong> للاختصارات في الصفحة الرئيسية للمستخدمين، دون أي تغيير في طريقة البحث، الفلترة، أو قواعد الحساب.
          </span>
        </div>
      </div>

      {/* Ordering List */}
      <div className="space-y-2.5" role="list" aria-label="قائمة ترتيب اختصارات الخدمات">
        {order.map((id, index) => {
          const item = SHORTCUT_DEFINITIONS[id];
          const isFirst = index === 0;
          const isLast = index === order.length - 1;

          return (
            <div
              key={id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border transition-all ${
                draggedIndex === index
                  ? "border-primary bg-primary/10 shadow-md scale-[1.01]"
                  : "border-border/80 bg-card hover:border-primary/40 shadow-xs"
              }`}
            >
              {/* Left side: Drag handle + Index + Icon + Label */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none"
                  title="سحب وإفلات لإعادة الترتيب"
                  aria-label={`سحب وإفلات لإعادة ترتيب ${item.label}`}
                >
                  <GripVertical className="size-4 shrink-0" />
                </button>

                {/* Position Badge */}
                <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-secondary text-xs font-black text-foreground">
                  {arabicNumbers[index] || index + 1}
                </span>

                {/* Icon */}
                <div
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                    id === "available_now"
                      ? "bg-success/15 text-success"
                      : id === "emergency_now"
                      ? "bg-warning/15 text-warning"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {id === "available_now" ? (
                    <Sparkles className="size-4.5" />
                  ) : id === "emergency_now" ? (
                    <Zap className="size-4.5 fill-current" />
                  ) : (
                    <Truck className="size-4.5" />
                  )}
                </div>

                {/* Text details */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-sm sm:text-base text-foreground truncate">
                      {item.label}
                    </p>
                    <span className="hidden sm:inline-block text-[11px] font-bold text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded-full">
                      {item.badgeLabel}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate hidden sm:block">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Right side: Accessible Move Up / Down Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={isFirst || busy}
                  onClick={() => move(index, -1)}
                  title={`تحريك ${item.label} لأعلى`}
                  aria-label={`تحريك ${item.label} لأعلى`}
                  className="grid size-9 place-items-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-25 transition-all"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={isLast || busy}
                  onClick={() => move(index, 1)}
                  title={`تحريك ${item.label} لأسفل`}
                  aria-label={`تحريك ${item.label} لأسفل`}
                  className="grid size-9 place-items-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-25 transition-all"
                >
                  <ArrowDown className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer controls: Save, Reset, Saving status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <button
          type="button"
          disabled={busy || isDefault}
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:underline transition-colors disabled:opacity-30 cursor-pointer"
        >
          <RotateCcw className="size-3.5" />
          <span>استعادة الترتيب الافتراضي</span>
        </button>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setOrder(savedOrder)}
              className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary transition-colors"
            >
              تراجع عن التعديل
            </button>
          )}

          <button
            type="button"
            disabled={busy || !hasChanges}
            onClick={handleSave}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs sm:text-sm font-black text-primary-foreground hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 transition-all shadow-xs cursor-pointer"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <Check className="size-4" />
                <span>حفظ ترتيب الاختصارات</span>
              </>
            )}
          </button>
        </div>
      </div>

      {confirmState && (
        <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      )}
    </div>
  );
}
