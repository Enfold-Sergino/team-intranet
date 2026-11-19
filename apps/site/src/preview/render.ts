/**
 * Browser build of the page renderer for the live editor (bundled into dist/editor/renderer.js by
 * scripts/build-preview.mjs). It runs the *same* Astro components as the static pages, so a draft
 * looks exactly like the published page.
 *
 * Astro has no public API for rendering in the browser, so this uses its internal runtime with a
 * minimal render "result". If an Astro upgrade breaks it, tests/preview.test.ts fails: astro is
 * pinned to an exact version for that reason.
 */
import {
  createSite,
  languageOf,
  type Page,
  type SiteContent,
  type SiteOptions,
} from "@team-intranet/core";
import { renderComponentToString } from "astro/runtime/server/render/component.js";
import PageView from "../components/page/PageView.astro";

const href = () => (typeof location === "undefined" ? "http://localhost/" : location.href);

// The part of Astro's SSRResult that server-only components (no islands, no scripts) touch.
const createResult = () => ({
  styles: new Set(),
  scripts: new Set(),
  links: new Set(),
  componentMetadata: new Map(),
  inlinedScripts: new Map(),
  renderers: [],
  clientDirectives: new Map(),
  directives: new Map(),
  serverIslandNameMap: new Map(),
  compressHTML: true,
  partial: true,
  pathname: "/",
  base: "/",
  trailingSlash: "ignore",
  createAstro: (props: Record<string, unknown>, slots: unknown) => ({
    props,
    slots,
    self: null,
    params: {},
    site: undefined,
    generator: "",
    url: new URL(href()),
    request: new Request(href()),
  }),
  resolve: async (specifier: string) => specifier,
  response: { status: 200, headers: new Headers() },
  request: new Request(href()),
  _metadata: {
    hasHydrationScript: false,
    rendererSpecificHydrationScripts: new Set(),
    hasRenderedHead: true,
    renderedScripts: new Set(),
    hasDirectives: new Set(),
    hasRenderedServerIslandRuntime: false,
    headInTree: false,
    extraHead: [],
    extraStyleHashes: [],
    extraScriptHashes: [],
    propagators: new Set(),
  },
});

/** HTML of a draft page's body, with the published site around it for overviews and links. */
export function renderPage(
  page: Page,
  content: SiteContent,
  options: SiteOptions,
): Promise<string> {
  const site = createSite(content, options);
  // A draft has no primary item of its own: take the published page's.
  const draft = {
    ...page,
    primaryItem: page.primaryItem ?? site.pages.find((p) => p.id === page.id)?.primaryItem ?? null,
  };
  return renderComponentToString(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see createResult()
    createResult() as any,
    "PageView",
    PageView,
    {
      page: draft,
      site: site.forLanguage(languageOf(draft.path, options.languages)),
      dev: false,
      editor: true,
    },
    {},
  );
}

export { connectEditor } from "./connect";
