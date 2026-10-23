// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabasePublishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
const supabaseProjectId = process.env.VITE_SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID || "";

if (process.env.NODE_ENV === "production" && (!supabaseUrl || !supabasePublishableKey)) {
  const missing = [
    !supabaseUrl && "VITE_SUPABASE_URL (or SUPABASE_URL)",
    !supabasePublishableKey && "VITE_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_PUBLISHABLE_KEY)",
  ]
    .filter(Boolean)
    .join(", ");
  throw new Error(`[vite.config.ts] Missing required production configuration: ${missing}`);
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
    },
    server: {
      host: "0.0.0.0",
      port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
      allowedHosts: true,
    },
  },
});
