// Bundles src/preview/render.ts (the page components and the editor connection) for the browser,
// into dist/editor/renderer.js. Runs after `astro build`, with Astro's own Vite config, so the
// components compile exactly as in the static build.
import { getViteConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const outDir = fileURLToPath(new URL("../dist/editor/", import.meta.url));
const config = await getViteConfig(
  {
    publicDir: false,
    logLevel: "warn",
    build: {
      ssr: "src/preview/render.ts",
      outDir,
      emptyOutDir: false,
      minify: true,
      rollupOptions: { output: { entryFileNames: "renderer.js" } },
    },
    // "ssr" only means "render to strings" here: target the browser and bundle every dependency.
    ssr: { target: "webworker", noExternal: true },
    resolve: { conditions: ["browser"] },
  },
  { logLevel: "warn" },
)({ mode: "production", command: "build" });

await build({ ...config, configFile: false });
console.log("[build-preview] dist/editor/renderer.js");
