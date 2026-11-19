import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import intranet from "./src/integrations";

// Fully static output; fresh content arrives through publish-triggered rebuilds.
// SITE_URL and SITE_BASE come from the environment the site is built for; locally both are unset.
export default defineConfig({
  output: "static",
  site: process.env.SITE_URL || undefined,
  base: process.env.SITE_BASE || "/",
  trailingSlash: "ignore",
  build: { format: "directory" },
  // Link check, search index and the shared login (encryption), after every build.
  integrations: [intranet()],
  vite: {
    plugins: [tailwindcss()],
    // Ships TypeScript sources only (see patches/): Vite must compile it instead of Node loading it.
    ssr: { noExternal: ["@platecms/delta-cast-util-to-hast"] },
  },
});
