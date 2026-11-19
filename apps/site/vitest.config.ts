/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// Astro's Vite config, so tests can render .astro components.
const root = import.meta.dirname;
export default getViteConfig({ test: { name: "site", root } }, { root });
