import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { isDark, toggleTheme, isMounted } = useTheme();

  // During SSR or before client hydration, render a stable button with matching dimensions
  const label = !isMounted
    ? "تفعيل الوضع الداكن"
    : isDark
      ? "تفعيل الوضع الفاتح"
      : "تفعيل الوضع الداكن";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border/80 bg-card p-2 text-foreground hover:bg-secondary/80 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98] transition-all shadow-xs cursor-pointer shrink-0 ${className}`}
    >
      {isMounted && isDark ? (
        <Sun className="size-4.5 sm:size-5 text-amber-400 transition-transform duration-200" aria-hidden="true" />
      ) : (
        <Moon className="size-4.5 sm:size-5 text-foreground transition-transform duration-200" aria-hidden="true" />
      )}
    </button>
  );
}
