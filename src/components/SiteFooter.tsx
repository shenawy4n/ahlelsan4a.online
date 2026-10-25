import { Link } from "@tanstack/react-router";
import { ShieldCheck, Info, Shield, FileText, PhoneCall } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-14 border-t border-border/80 bg-card/60 pt-8 pb-12 text-sm text-muted-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 text-center">
        <nav className="flex flex-wrap items-center justify-center gap-x-2 sm:gap-x-4 gap-y-1 font-bold text-xs sm:text-sm" aria-label="روابط الموقع">
          <Link
            to="/"
            className="inline-flex min-h-[40px] items-center px-2 py-1.5 rounded-lg hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            الرئيسية
          </Link>
          <span className="text-border hidden sm:inline" aria-hidden="true">•</span>
          <Link
            to="/contact"
            className="inline-flex min-h-[40px] items-center gap-1.5 px-2 py-1.5 rounded-lg hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <PhoneCall className="size-3.5 text-primary" aria-hidden="true" />
            <span>تواصل معنا</span>
          </Link>
          <span className="text-border hidden sm:inline" aria-hidden="true">•</span>
          <Link
            to="/about"
            className="inline-flex min-h-[40px] items-center gap-1.5 px-2 py-1.5 rounded-lg hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <Info className="size-3.5" aria-hidden="true" />
            <span>من نحن</span>
          </Link>
          <span className="text-border hidden sm:inline" aria-hidden="true">•</span>
          <Link
            to="/privacy"
            className="inline-flex min-h-[40px] items-center gap-1.5 px-2 py-1.5 rounded-lg hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <Shield className="size-3.5" aria-hidden="true" />
            <span>سياسة الخصوصية</span>
          </Link>
          <span className="text-border hidden sm:inline" aria-hidden="true">•</span>
          <Link
            to="/terms"
            className="inline-flex min-h-[40px] items-center gap-1.5 px-2 py-1.5 rounded-lg hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <FileText className="size-3.5" aria-hidden="true" />
            <span>شروط الاستخدام</span>
          </Link>
          <span className="text-border hidden sm:inline" aria-hidden="true">•</span>
          <Link
            to="/auth"
            className="inline-flex min-h-[40px] items-center gap-1.5 px-2 py-1.5 rounded-lg hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            <span>دخول المسؤول</span>
          </Link>
        </nav>
        <p className="text-xs text-muted-foreground/90 font-medium">
          أهل الصنعة — دليل الحرفيين ومقدمي الخدمات في القرى المصرية. كل صنعة عند أهلها.
        </p>
      </div>
    </footer>
  );
}
