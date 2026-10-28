import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PhoneCall } from "lucide-react";
import { settingsQuery } from "@/lib/directory";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteHeader() {
  const { data } = useQuery(settingsQuery);
  const [imgFailed, setImgFailed] = useState(false);
  const name = data?.["app_name"] || "أهل الصنعة";
  const tagline = data?.["tagline"] || "كل صنعة عند أهلها";
  const logo = !imgFailed ? data?.["logo_url"] : null;

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 backdrop-blur-md shadow-xs transition-colors">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-2 sm:py-2.5">
        <Link
          to="/"
          className="group flex items-center gap-2.5 min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 py-1"
          aria-label={`${name} — ${tagline}`}
        >
          {logo ? (
            <img
              src={logo}
              alt={name}
              loading="eager"
              decoding="async"
              onError={() => setImgFailed(true)}
              className="size-10 sm:size-11 rounded-xl object-contain bg-background border border-border/60 shrink-0 shadow-xs"
            />
          ) : (
            <span className="grid size-10 sm:size-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/85 text-xl sm:text-2xl font-extrabold text-primary-foreground shrink-0 shadow-xs ring-1 ring-primary/30 group-hover:scale-105 transition-transform">
              {name.charAt(0)}
            </span>
          )}
          <span className="leading-tight truncate">
            <span className="block font-display text-base sm:text-lg font-black text-foreground tracking-tight truncate group-hover:text-primary transition-colors">
              {name}
            </span>
            <span className="block text-xs font-medium text-muted-foreground truncate">{tagline}</span>
          </span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <ThemeToggle />
          <Link
            to="/contact"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-extrabold text-foreground hover:bg-secondary/80 hover:border-primary/40 active:scale-[0.98] transition-all shadow-xs"
            aria-label="تواصل مع إدارة أهل الصنعة"
          >
            <PhoneCall className="size-4 text-primary shrink-0" aria-hidden="true" />
            <span className="hidden xs:inline sm:inline">تواصل معنا</span>
          </Link>
          <PWAInstallButton />
        </div>
      </div>
    </header>
  );
}
