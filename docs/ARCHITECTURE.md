# Architecture

## The idea

The site never talks to a CMS. It renders one **core model** (`packages/core`): pages made of
blocks, reusable items, assets, tags, and rich text as **HAST** (the standard HTML syntax tree). Each
CMS is an **adapter** that loads its content and maps it to that model. Changing or adding a CMS
means writing an adapter, not touching the site.

```
               ┌──────────── packages/plate/* ────────────┐
Plate CDA ──► connector ──► source (map) ──► cast (CAST→HAST)
                                │
                                ▼
                     packages/core: SiteContent ──► createSite() ──► apps/site (Astro)
                                ▲                                         │
Plate editor ──► editor (draft → Page) ─────────────────────────► /editor/ preview
```

Dependency rule: `apps/site → core`, `plate/* → core`, `core →` nothing (zod only). Workspace
packages have no build step: they export their TypeScript source and Vite compiles it.

## Core (`packages/core`)

| File                                                        | What                                                                                            |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `model.ts`                                                  | `SiteContent`, `Page`, `Block`, `Item`, `Asset`, `Tag`, `PageRef`, `RichText`, `ContentSource`  |
| `schemas.ts`                                                | **The contract**: a zod schema per block type and item type; components get their types from it |
| `values.ts`                                                 | Field value schemas: trimmed text, safe URLs, assets, page refs, tags, `one`/`many`             |
| `validate.ts`                                               | `findInvalidContent`: blocks and items the site leaves out, for the editors' report             |
| `site.ts`                                                   | `Site`: page tree, navigation, languages, language links, reading order (indexed once)          |
| `languages`, `tags`, `table`, `search`, `rich-text`, `text` | Small pure helpers                                                                              |

Ids are opaque strings (Plate PRNs today). A page has `blocks`, not a root block. `Block.editorId`
is only set on live-editor drafts.

## The site (`apps/site`)

- `src/content/index.ts` loads the content once per build from `CONTENT_SOURCE` (`plate` or the
  invented `demo`), reports invalid content and returns a `Site`.
- `src/pages/[...path].astro` makes one page per `Page`, plus redirects and a generated overview for
  a language root without a page. `PageView` renders tags, title, blocks, child pages and
  previous/next.
- `src/components/page/BlockRenderer.astro` looks up `src/blocks/<Name>Block.astro` by block type
  (`experience-list` → `ExperienceListBlock.astro`) and validates the props against the contract.
  A block that doesn't fit is left out with its children; in development it shows why.
- `src/lib/rich-text.ts` sanitizes rich text, shifts headings, prefixes the base path and opens
  external links in a new tab. Every href and src goes through `withBase` (`src/lib/url.ts`).
- Tailwind v4: the design tokens are in `src/styles/global.css` (`@theme`, light and dark). The Inter
  font is self-hosted (no requests to Google).

### Build (`src/integrations`)

After `astro build`, one integration works on `dist/`: it checks every internal link (a missing base
path fails the build, a missing page is reported), builds `search-index.json`, and with
`SITE_USERNAME` + `SITE_PASSWORD` encrypts every page, the search index and the preview data. Then
`scripts/build-preview.mjs` bundles the live editor renderer. The result is a plain static folder.

### Live editor preview

Plate loads `<site>/editor/content-experiences/<path>` in an iframe; `404.html` forwards it to
`/editor/`. That page receives the draft through `plate/editor` (origin-checked), and renders it with
`dist/editor/renderer.js`: the same Astro components, run in the browser through Astro's internal
runtime. Blocks built from other pages read the published site from `editor/site.json`. `astro` is
pinned to an exact version because of that internal API; `tests/preview.test.ts` fails if an upgrade
breaks it.

## Plate (`packages/plate/*`)

| Package     | What                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `connector` | CDA client: timeouts, retries (honouring `Retry-After`), zod-checked responses, page discovery    |
| `cast`      | CAST → HAST with Plate's `@platecms/delta-cast-util-to-hast`, plus safe links, site paths, images |
| `source`    | `createPlateSource()`: maps each field by its Plate value type, items per language, `/home` alias |
| `editor`    | `pageFromDraft`, `connectEditor`: drafts via delta-client's parser and window connector           |
| `theme`     | `delta/` snapshot, `pnpm plate:sync`, and the contract check that runs in `pnpm test`             |

Plate packages in use: `@platecms/delta-client` (value type names, the GraphQL → accessible
converter, the window connector, editor origins) and `@platecms/delta-cast-util-to-hast`. The latter
ships only TypeScript sources; a pnpm patch (`patches/`) adds type declarations, and the site compiles
it (`ssr.noExternal`). It is marked `UNLICENSED`: confirm with Plate that the public repo may use it.

## Adding a block

1. Add its schema to `blockSchemas` in `packages/core/src/schemas.ts` (props in camelCase).
2. Add `apps/site/src/blocks/<Name>Block.astro` with `type Props = BlockProps<"<type>">`.
3. Create the block in the CMS with matching field slugs (`cta-link` ↔ `ctaLink`), then
   `pnpm plate:sync && pnpm test`: the contract test fails until Plate, core and the component agree.
4. Mention it in `docs/EDITING.md` if editors will use it.

## Adding a CMS adapter

1. Create `packages/<cms>/…` with a `ContentSource`: `load()` returns `SiteContent`. Map rich text to
   HAST, assets to `{ url, alt }`, page links to `{ id, path }`, tags to `Tag`, and block and item
   fields to the props in `schemas.ts`. Test that mapped content passes `findInvalidContent`.
2. Add it to `source()` in `apps/site/src/content/index.ts` under a new `CONTENT_SOURCE` name.
3. Optional: a live editor connection exporting `connectEditor` (see `plate/editor`), picked in
   `apps/site/src/preview/connect.ts`, and a theme check like `plate/theme`.

Nothing in the blocks, layouts or build changes.
