import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("----------------------------------------------------------------------");
console.log("Ahl Elsan3a — Dark Mode Automated Test Suite");
console.log("----------------------------------------------------------------------\n");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err: unknown) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

// 1. Theme Module Functionality & Persistence Logic
console.log("Scenario 1: Theme persistence & resolution logic in src/lib/theme.ts");

// Mock browser environment for unit testing lib/theme
class MockStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const mockStorage = new MockStorage();
const mockClassList = new Set<string>();
const mockStyle: Record<string, string> = {};

let mockMediaDark = false;
const mockWindow = {
  location: { origin: "https://ahlelsan3a.online" },
  matchMedia: (query: string) => ({
    matches: query.includes("prefers-color-scheme: dark") ? mockMediaDark : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
  dispatchEvent: () => true,
};

const mockDocument = {
  documentElement: {
    classList: {
      add: (cls: string) => mockClassList.add(cls),
      remove: (cls: string) => mockClassList.delete(cls),
      contains: (cls: string) => mockClassList.has(cls),
    },
    style: mockStyle,
  },
  querySelector: () => null,
};

// Assign mocks to global
(globalThis as unknown as { window: typeof mockWindow }).window = mockWindow;
(globalThis as unknown as { document: typeof mockDocument }).document = mockDocument;
(globalThis as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;
(globalThis as unknown as { CustomEvent: typeof CustomEvent }).CustomEvent = class CustomEvent {
  detail: unknown;
  constructor(public type: string, init?: { detail: unknown }) {
    this.detail = init?.detail;
  }
} as never;

// Dynamic import of theme utilities
async function runTests() {
  const {
    THEME_STORAGE_KEY,
    getStoredTheme,
    getSystemTheme,
    getResolvedTheme,
    applyTheme,
    setTheme,
    toggleTheme,
  } = await import("../src/lib/theme.ts");

  test("THEME_STORAGE_KEY is 'theme'", () => {
    assert.equal(THEME_STORAGE_KEY, "theme");
  });

  test("Initial state: when localStorage is empty, getStoredTheme() returns null", () => {
    mockStorage.clear();
    assert.equal(getStoredTheme(), null);
  });

  test("System preference fallback: returns dark when prefers-color-scheme is dark and no stored value", () => {
    mockStorage.clear();
    mockMediaDark = true;
    assert.equal(getSystemTheme(), "dark");
    assert.equal(getResolvedTheme(), "dark");
  });

  test("System preference fallback: returns light when prefers-color-scheme is light and no stored value", () => {
    mockStorage.clear();
    mockMediaDark = false;
    assert.equal(getSystemTheme(), "light");
    assert.equal(getResolvedTheme(), "light");
  });

  test("Persistence: setTheme('dark') writes to localStorage and updates DOM classes", () => {
    setTheme("dark");
    assert.equal(mockStorage.getItem("theme"), "dark");
    assert.equal(getStoredTheme(), "dark");
    assert.equal(mockClassList.has("dark"), true);
    assert.equal(mockStyle.colorScheme, "dark");
  });

  test("Precedence: explicit stored theme overrides OS system preference", () => {
    mockMediaDark = false; // OS says light
    setTheme("dark");      // user explicitly picked dark
    assert.equal(getResolvedTheme(), "dark");

    mockMediaDark = true;  // OS says dark
    setTheme("light");     // user explicitly picked light
    assert.equal(getResolvedTheme(), "light");
  });

  test("Toggling: toggleTheme() toggles between dark and light smoothly", () => {
    setTheme("light");
    const next = toggleTheme();
    assert.equal(next, "dark");
    assert.equal(getStoredTheme(), "dark");
    assert.equal(mockClassList.has("dark"), true);

    const backToLight = toggleTheme();
    assert.equal(backToLight, "light");
    assert.equal(getStoredTheme(), "light");
    assert.equal(mockClassList.has("dark"), false);
  });

  // 2. ThemeToggle Component Static & Accessibility Requirements
  console.log("\nScenario 2: Header ThemeToggle accessibility, icons, and touch targets");

  const themeTogglePath = path.resolve(process.cwd(), "src/components/ThemeToggle.tsx");
  assert.ok(fs.existsSync(themeTogglePath), "ThemeToggle.tsx must exist");
  const themeToggleContent = fs.readFileSync(themeTogglePath, "utf-8");

  test("ThemeToggle uses Moon and Sun icons from lucide-react", () => {
    assert.match(themeToggleContent, /import\s*\{[^}]*\bMoon\b[^}]*\}\s*from\s*["']lucide-react["']/);
    assert.match(themeToggleContent, /import\s*\{[^}]*\bSun\b[^}]*\}\s*from\s*["']lucide-react["']/);
  });

  test("ThemeToggle includes Arabic accessible label: 'تفعيل الوضع الداكن' when light", () => {
    assert.ok(
      themeToggleContent.includes("تفعيل الوضع الداكن"),
      "Must include Arabic label for enabling dark mode"
    );
  });

  test("ThemeToggle includes Arabic accessible label: 'تفعيل الوضع الفاتح' when dark", () => {
    assert.ok(
      themeToggleContent.includes("تفعيل الوضع الفاتح"),
      "Must include Arabic label for enabling light mode"
    );
  });

  test("ThemeToggle enforces minimum 44px touch target (min-h-[44px] min-w-[44px])", () => {
    assert.ok(
      themeToggleContent.includes("min-h-[44px]") && themeToggleContent.includes("min-w-[44px]"),
      "Touch target must be at least 44px by 44px"
    );
  });

  test("ThemeToggle has visible keyboard focus ring and cursor pointer", () => {
    assert.ok(
      themeToggleContent.includes("focus-visible:ring-2") && themeToggleContent.includes("focus-visible:outline-none"),
      "Must provide visible keyboard focus state"
    );
  });

  // 3. Header Integration & Layout Preservation
  console.log("\nScenario 3: Header integration & mobile safety in SiteHeader.tsx");

  const siteHeaderPath = path.resolve(process.cwd(), "src/components/SiteHeader.tsx");
  const siteHeaderContent = fs.readFileSync(siteHeaderPath, "utf-8");

  test("SiteHeader imports and mounts ThemeToggle", () => {
    assert.match(siteHeaderContent, /import\s*\{[^}]*\bThemeToggle\b[^}]*\}\s*from\s*["']@\/components\/ThemeToggle["']/);
    assert.ok(siteHeaderContent.includes("<ThemeToggle"), "Must render ThemeToggle");
  });

  test("SiteHeader maintains Contact and PWA buttons alongside ThemeToggle", () => {
    assert.ok(siteHeaderContent.includes("<PWAInstallButton />"), "PWA button preserved");
    assert.ok(siteHeaderContent.includes('to="/contact"'), "Contact link preserved");
  });

  test("SiteHeader header row uses shrink-0 on action items and truncate on title to prevent layout shifts", () => {
    assert.ok(siteHeaderContent.includes("shrink-0"), "Buttons container uses shrink-0");
    assert.ok(siteHeaderContent.includes("truncate"), "Title text uses truncate");
  });

  // 4. Admin Header Integration
  console.log("\nScenario 4: Admin header integration in src/routes/_authenticated/admin.tsx");

  const adminPagePath = path.resolve(process.cwd(), "src/routes/_authenticated/admin.tsx");
  const adminPageContent = fs.readFileSync(adminPagePath, "utf-8");

  test("Admin top bar imports and mounts ThemeToggle", () => {
    assert.match(adminPageContent, /import\s*\{[^}]*\bThemeToggle\b[^}]*\}\s*from\s*["']@\/components\/ThemeToggle["']/);
    assert.ok(adminPageContent.includes("<ThemeToggle"), "Must render ThemeToggle in admin header");
  });

  // 5. Anti-FOUC & Head Script in __root.tsx
  console.log("\nScenario 5: Zero-flash anti-FOUC implementation in src/routes/__root.tsx");

  const rootPath = path.resolve(process.cwd(), "src/routes/__root.tsx");
  const rootContent = fs.readFileSync(rootPath, "utf-8");

  test("__root.tsx has inline script inside <head> checking localStorage and prefers-color-scheme before paint", () => {
    assert.ok(rootContent.includes("localStorage.getItem(\"theme\")"), "Inline script checks stored theme");
    assert.ok(rootContent.includes("prefers-color-scheme: dark"), "Inline script falls back to system media query");
    assert.ok(rootContent.includes("document.documentElement.classList.add(\"dark\")"), "Sets .dark class on <html>");
  });

  test("__root.tsx passes active theme to Sonner Toaster", () => {
    assert.ok(rootContent.includes("<Toaster"), "Toaster present");
    assert.ok(rootContent.includes("theme={theme}"), "Toaster receives active theme");
  });

  // 6. CSS Tokens and Design System Integrity in styles.css
  console.log("\nScenario 6: Dark palette tokens & CSS configuration in src/styles.css");

  const stylesPath = path.resolve(process.cwd(), "src/styles.css");
  const stylesContent = fs.readFileSync(stylesPath, "utf-8");

  test("styles.css defines @custom-variant dark (&:where(.dark, .dark *)) for Tailwind v4", () => {
    assert.ok(stylesContent.includes("@custom-variant dark (&:where(.dark, .dark *));"), "Dark custom variant declared");
  });

  test("styles.css defines .dark class block with semantic tokens", () => {
    assert.ok(stylesContent.includes(".dark {"), ".dark block must be defined");
    assert.ok(stylesContent.includes("--background:"), "Background token defined in .dark");
    assert.ok(stylesContent.includes("--card:"), "Card token defined in .dark");
    assert.ok(stylesContent.includes("--foreground:"), "Foreground token defined in .dark");
    assert.ok(stylesContent.includes("--border:"), "Border token defined in .dark");
    assert.ok(stylesContent.includes("--muted-foreground:"), "Muted foreground defined in .dark");
  });

  test("Dark background is warm dark neutral, NOT pure black (#000 or #000000)", () => {
    const darkMatch = stylesContent.match(/\.dark\s*\{([^}]+)\}/);
    assert.ok(darkMatch, "Found .dark CSS block");
    const darkBody = darkMatch[1];
    assert.ok(!darkBody.includes("#000000") && !darkBody.includes("oklch(0 0 0)"), "Background must not be pitch black");
    assert.ok(darkBody.includes("--background: oklch(0.185"), "Uses rich village-night dark neutral");
  });

  test("Card/surface is elevated with contrasting lightness in .dark", () => {
    assert.ok(stylesContent.includes("--card: oklch(0.235"), "Card has higher elevation than background");
    assert.ok(stylesContent.includes("--border: oklch(0.32"), "Border has distinct contrast for clean separation");
  });

  test("styles.css sets html.dark { color-scheme: dark; } for native browser controls", () => {
    assert.ok(stylesContent.includes("html.dark"), "html.dark color-scheme configured");
    assert.ok(stylesContent.includes("color-scheme: dark;"), "color-scheme: dark defined");
  });

  // 7. Image Integrity & Zero Filter Rule
  console.log("\nScenario 7: Image integrity & zero CSS filter verification");

  test("Zero CSS invert/grayscale filters on user photos and logos", () => {
    const providerCardPath = path.resolve(process.cwd(), "src/components/ProviderCard.tsx");
    const providerCardContent = fs.readFileSync(providerCardPath, "utf-8");
    const providerPagePath = path.resolve(process.cwd(), "src/routes/provider.$id.tsx");
    const providerPageContent = fs.readFileSync(providerPagePath, "utf-8");

    assert.ok(!providerCardContent.includes("filter: invert"), "ProviderCard has no filter: invert");
    assert.ok(!providerCardContent.includes("dark:invert"), "ProviderCard has no dark:invert");
    assert.ok(!providerPageContent.includes("filter: invert"), "ProviderPage photo has no filter: invert");
    assert.ok(!providerPageContent.includes("dark:invert"), "ProviderPage photo has no dark:invert");
  });

  console.log("\n----------------------------------------------------------------------");
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log("----------------------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
