import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";
import intranet from "./src/integrations";

// apps/site/.env plus the process environment (CI secrets and variables win over the file).
const env = loadEnv(process.env.NODE_ENV ?? "production", import.meta.dirname, "");

// Fully static output; fresh content arrives through publish-triggered rebuilds.
// SITE_URL and SITE_BASE come from the environment the site is built for; locally both are unset.
export default defineConfig({
  output: "static",
  site: env.SITE_URL || undefined,
  base: env.SITE_BASE || "/",
  trailingSlash: "ignore",
  build: { format: "directory" },
  // Link check, search index and the shared login (encryption), after every build.
  integrations: [
    intranet({
      username: env.SITE_USERNAME,
      password: env.SITE_PASSWORD,
      sessionHours: env.SESSION_HOURS,
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    // Ships TypeScript sources only (see patches/): Vite must compile it instead of Node loading it.
    ssr: { noExternal: ["@platecms/delta-cast-util-to-hast"] },
  },
});
