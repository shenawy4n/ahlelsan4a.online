import { Zap, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/directory";
import {
  type ShortcutId,
  SHORTCUT_SETTINGS_KEY,
  LEGACY_SHORTCUT_SETTINGS_KEY,
  resolveShortcutsOrder,
} from "@/lib/shortcuts";

export type AvailabilityFilterMode = "all" | "available_now" | "emergency_now";

interface AvailabilityFilterProps {
  currentMode: AvailabilityFilterMode;
  onModeChange: (mode: AvailabilityFilterMode) => void;
  deliveryOnly?: boolean;
  onDeliveryChange?: (delivery: boolean) => void;
  shortcutOrder?: ShortcutId[];
  counts?: {
    all: number;
    availableNow: number;
    emergencyNow: number;
    delivery?: number;
  };
}

export function AvailabilityFilter({
  currentMode,
  onModeChange,
  deliveryOnly = false,
  onDeliveryChange,
  shortcutOrder: propShortcutOrder,
  counts,
}: AvailabilityFilterProps) {
  const isAllActive = currentMode === "all" && !deliveryOnly;

  const { data: settings } = useQuery({
    ...settingsQuery,
    enabled: !propShortcutOrder,
  });

  const activeOrder =
    propShortcutOrder ||
    resolveShortcutsOrder(
      settings?.[SHORTCUT_SETTINGS_KEY] || settings?.[LEGACY_SHORTCUT_SETTINGS_KEY]
    );

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="تصفية حسب التوافر والخدمة">
      {/* 1. All (Always first) */}
      <button
        type="button"
        onClick={() => {
          onModeChange("all");
          onDeliveryChange?.(false);
        }}
        aria-pressed={isAllActive}
        className={`min-h-[44px] inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black transition-all active:scale-[0.98] ${
          isAllActive
            ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/40"
            : "surface text-muted-foreground hover:text-foreground hover:border-primary/40 border border-border"
        }`}
      >
        <span>الكل</span>
        {counts !== undefined && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
              isAllActive
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {counts.all}
          </span>
        )}
      </button>

      {/* Render the 3 filter shortcuts in the resolved/configured order */}
      {activeOrder.map((id) => {
        if (id === "available_now") {
          return (
            <button
              key="available_now"
              type="button"
              onClick={() => {
                if (currentMode === "available_now") {
                  onModeChange("all");
                } else {
                  onModeChange("available_now");
                }
              }}
              aria-pressed={currentMode === "available_now"}
              className={`min-h-[44px] inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black transition-all active:scale-[0.98] ${
                currentMode === "available_now"
                  ? "bg-success text-success-foreground shadow-xs ring-2 ring-success/30"
                  : "surface text-muted-foreground hover:text-foreground hover:border-success/40 border border-border"
              }`}
            >
              <span
                className={`size-2 rounded-full shrink-0 ${
                  currentMode === "available_now" ? "bg-success-foreground animate-pulse" : "bg-success"
                }`}
                aria-hidden="true"
              />
              <span>متاح الآن</span>
              {counts !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                    currentMode === "available_now"
                      ? "bg-success-foreground/20 text-success-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {counts.availableNow}
                </span>
              )}
            </button>
          );
        }

        if (id === "emergency_now") {
          return (
            <button
              key="emergency_now"
              type="button"
              onClick={() => {
                if (currentMode === "emergency_now") {
                  onModeChange("all");
                } else {
                  onModeChange("emergency_now");
                }
              }}
              aria-pressed={currentMode === "emergency_now"}
              className={`min-h-[44px] inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black transition-all active:scale-[0.98] ${
                currentMode === "emergency_now"
                  ? "bg-warning text-warning-foreground shadow-xs ring-2 ring-warning/30"
                  : "surface text-muted-foreground hover:text-foreground hover:border-warning/40 border border-border"
              }`}
            >
              <Zap className="size-3.5 fill-current shrink-0" aria-hidden="true" />
              <span>طوارئ ٢٤ ساعة</span>
              {counts !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                    currentMode === "emergency_now"
                      ? "bg-warning-foreground/20 text-warning-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {counts.emergencyNow}
                </span>
              )}
            </button>
          );
        }

        if (id === "delivery") {
          return (
            <button
              key="delivery"
              type="button"
              onClick={() => {
                onDeliveryChange?.(!deliveryOnly);
              }}
              aria-pressed={deliveryOnly}
              className={`min-h-[44px] inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black transition-all active:scale-[0.98] ${
                deliveryOnly
                  ? "bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/30"
                  : "surface text-muted-foreground hover:text-foreground hover:border-emerald-500/40 border border-border"
              }`}
            >
              <Truck className="size-3.5 shrink-0" aria-hidden="true" />
              <span>توصيل للمنازل</span>
              {counts?.delivery !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                    deliveryOnly
                      ? "bg-white/20 text-white"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {counts.delivery}
                </span>
              )}
            </button>
          );
        }

        return null;
      })}
    </div>
  );
}
