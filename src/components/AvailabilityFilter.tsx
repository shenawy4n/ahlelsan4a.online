import { Zap, Clock, CheckCircle2 } from "lucide-react";

export type AvailabilityFilterMode = "all" | "available_now" | "emergency_now";

interface AvailabilityFilterProps {
  currentMode: AvailabilityFilterMode;
  onModeChange: (mode: AvailabilityFilterMode) => void;
  counts?: {
    all: number;
    availableNow: number;
    emergencyNow: number;
  };
}

export function AvailabilityFilter({
  currentMode,
  onModeChange,
  counts,
}: AvailabilityFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="تصفية حسب التوافر">
      <button
        type="button"
        onClick={() => onModeChange("all")}
        aria-pressed={currentMode === "all"}
        className={`min-h-[44px] inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-black transition-all active:scale-[0.98] ${
          currentMode === "all"
            ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/40"
            : "surface text-muted-foreground hover:text-foreground hover:border-primary/40 border border-border"
        }`}
      >
        <span>الكل</span>
        {counts !== undefined && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
              currentMode === "all"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {counts.all}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onModeChange("available_now")}
        aria-pressed={currentMode === "available_now"}
        className={`min-h-[44px] inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-black transition-all active:scale-[0.98] ${
          currentMode === "available_now"
            ? "bg-success text-success-foreground shadow-xs ring-2 ring-success/30"
            : "surface text-muted-foreground hover:text-foreground hover:border-success/40 border border-border"
        }`}
      >
        <span className={`size-2 rounded-full ${currentMode === "available_now" ? "bg-success-foreground animate-pulse" : "bg-success"}`} aria-hidden="true" />
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

      <button
        type="button"
        onClick={() => onModeChange("emergency_now")}
        aria-pressed={currentMode === "emergency_now"}
        className={`min-h-[44px] inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-black transition-all active:scale-[0.98] ${
          currentMode === "emergency_now"
            ? "bg-warning text-warning-foreground shadow-xs ring-2 ring-warning/30"
            : "surface text-muted-foreground hover:text-foreground hover:border-warning/40 border border-border"
        }`}
      >
        <Zap className="size-3.5 fill-current" aria-hidden="true" />
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
    </div>
  );
}
