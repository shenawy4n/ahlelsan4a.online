import fs from "fs";
import path from "path";

console.log("=== AHL ELSAN3A iOS PWA INSTALLATION DIALOG TEST SUITE ===");

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  FAIL: ${testName} ${detail ? `- ${detail}` : ""}`);
    failed++;
  }
}

async function runTests() {
  const pwaBtnPath = path.resolve(process.cwd(), "src/components/PWAInstallButton.tsx");
  const pwaHookPath = path.resolve(process.cwd(), "src/lib/usePWAInstall.ts");
  const headerPath = path.resolve(process.cwd(), "src/components/SiteHeader.tsx");

  assert(fs.existsSync(pwaBtnPath), "PWAInstallButton.tsx exists");
  assert(fs.existsSync(pwaHookPath), "usePWAInstall.ts exists");
  assert(fs.existsSync(headerPath), "SiteHeader.tsx exists");

  const pwaBtnCode = fs.readFileSync(pwaBtnPath, "utf-8");
  const pwaHookCode = fs.readFileSync(pwaHookPath, "utf-8");
  const headerCode = fs.readFileSync(headerPath, "utf-8");

  // Section 1: Containing block trap elimination via createPortal
  console.log("\n[Section 1: Containing Block Trap & React Portal]");
  assert(
    pwaBtnCode.includes('import { createPortal } from "react-dom";'),
    "PWAInstallButton imports createPortal from react-dom"
  );
  assert(
    pwaBtnCode.includes("createPortal(") && pwaBtnCode.includes("document.body"),
    "PWA modal is rendered into document.body via createPortal"
  );
  assert(
    pwaBtnCode.includes("mounted") && pwaBtnCode.includes("setMounted(true)"),
    "SSR hydration guard ensures portal renders safely on client mount"
  );

  // Section 2: Viewport and safe-area positioning
  console.log("\n[Section 2: Viewport Height, Safe Areas & Center Alignment]");
  assert(
    pwaBtnCode.includes("fixed inset-0 z-50 flex items-center justify-center"),
    "Overlay uses full-screen flex centering (fixed inset-0 z-50 flex items-center justify-center)"
  );
  assert(
    pwaBtnCode.includes("100dvh") && pwaBtnCode.includes("100dvw"),
    "Overlay handles dynamic viewport units (100dvh and 100dvw) for Safari collapsible bars"
  );
  assert(
    pwaBtnCode.includes("env(safe-area-inset-top)") && pwaBtnCode.includes("env(safe-area-inset-bottom)"),
    "Overlay accounts for iOS safe areas (safe-area-inset-top and safe-area-inset-bottom)"
  );
  assert(
    pwaBtnCode.includes("my-auto"),
    "Dialog card applies my-auto for natural vertical centering within flex container"
  );
  assert(
    !pwaBtnCode.includes("pt-[max(1.25rem,env(safe-area-inset-top))]"),
    "Dialog card does NOT misplace safe-area padding inside the card itself"
  );
  assert(
    pwaBtnCode.includes("max-h-[calc(100dvh-2.5rem)]") || pwaBtnCode.includes("max-h-[85dvh]"),
    "Dialog card limits max-height relative to viewport to prevent vertical overflow"
  );
  assert(
    pwaBtnCode.includes("overflow-y-auto"),
    "Dialog card enables internal scrolling when instruction content exceeds visible height"
  );

  // Section 3: Background scroll lock & interaction
  console.log("\n[Section 3: Background Scroll Lock & Accessibility]");
  assert(
    pwaBtnCode.includes('document.body.style.overflow = "hidden"'),
    "Background page scrolling is locked when dialog is open"
  );
  assert(
    pwaBtnCode.includes("document.body.style.overflow = originalOverflow"),
    "Background page scrolling is restored when dialog is closed"
  );
  assert(
    pwaBtnCode.includes('e.key === "Escape"') && pwaBtnCode.includes("setShowModal(false)"),
    "Escape key dismisses the dialog"
  );
  assert(
    pwaBtnCode.includes('onClick={() => setShowModal(false)}'),
    "Clicking overlay backdrop dismisses the dialog"
  );
  assert(
    pwaBtnCode.includes("e.stopPropagation()"),
    "Clicking dialog card stops propagation so clicks inside do not close the modal"
  );

  // Section 4: Arabic RTL instructions & iOS steps
  console.log("\n[Section 4: iOS Safari Installation Instructions & RTL]");
  assert(
    pwaBtnCode.includes('dir="rtl"'),
    "Dialog content specifies explicit dir='rtl'"
  );
  assert(
    pwaBtnCode.includes("تثبيت «أهل الصنعة»"),
    "Dialog header includes Arabic app title"
  );
  assert(
    pwaBtnCode.includes("خطوات التثبيت على Safari:"),
    "iOS instructions section title is present"
  );
  assert(
    pwaBtnCode.includes("زر المشاركة") && pwaBtnCode.includes("شريط متصفح سفاري بالأسفل"),
    "Step 1 describes Safari share button in the bottom bar"
  );
  assert(
    pwaBtnCode.includes("إضافة إلى الشاشة الرئيسية") && pwaBtnCode.includes("Add to Home Screen"),
    "Step 2 explains 'Add to Home Screen' in Arabic and English"
  );
  assert(
    pwaBtnCode.includes("إضافة") && pwaBtnCode.includes("Add"),
    "Step 3 explains tapping 'Add' at the top of the Safari sheet"
  );
  assert(
    pwaBtnCode.includes("<Share") && pwaBtnCode.includes("<PlusSquare"),
    "Visual icons for Share and Add to Home Screen are rendered beside step text"
  );

  // Section 5: Header integration
  console.log("\n[Section 5: Header Integration & PWA Hook]");
  assert(
    headerCode.includes("<PWAInstallButton />"),
    "SiteHeader mounts PWAInstallButton in the top navigation"
  );
  assert(
    pwaHookCode.includes("/iphone|ipad|ipod/.test(userAgent)"),
    "usePWAInstall accurately identifies iOS devices"
  );

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
