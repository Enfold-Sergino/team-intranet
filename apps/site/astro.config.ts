import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Fully static output; fresh content arrives through publish-triggered rebuilds.
// The deploy workflow sets SITE_URL and SITE_BASE; locally both are unset.
export default defineConfig({
  output: "static",
  site: process.env.SITE_URL || undefined,
  base: process.env.SITE_BASE || "/",
  trailingSlash: "ignore",
  build: { format: "directory" },
  vite: { plugins: [tailwindcss()] },
});
