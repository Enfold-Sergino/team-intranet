# Plan: Team intranet

The successor of `plate-intranet`: the same intranet, but no longer built around Plate. Content from
any headless CMS is turned into one CMS-agnostic model; the site renders only that model.

## Principles

- **The core model is the contract.** `apps/site` imports only `@team-intranet/core`. Each CMS is an
  adapter that produces the core model; nothing outside it names that CMS.
- **Rich text is HAST** (the standard HTML syntax tree). Every CMS rich text format (Plate CAST,
  Contentful, Sanity Portable Text, Storyblok) converts to it, so the site never sees a CMS format.
- **Dependencies point one way:** `site → core`, `plate/* → core`, `core →` nothing (zod only).
- **No build step for workspace packages:** each exports its TypeScript source; Vite compiles it.
- **Lightweight:** Astro static output, Tailwind v4 (tokens in one `@theme`), pnpm workspaces only,
  one root config for ESLint, Prettier, TypeScript and Vitest.
- **Plate's own packages over custom code** where they fit: `@platecms/delta-client` (parsers,
  editor connection) and `@platecms/delta-cast-util-to-hast` (rich text).

## Structure

```
apps/site/                 Astro + Tailwind: routes, layouts, blocks, ui
  src/integrations/        build hooks: encryption, search index, link check, content report
packages/core/             CMS-agnostic model
  model.ts                 SiteContent, Page, Block, Item, Asset, Tag, PageRef, RichText (HAST), ContentSource
  values.ts, schemas.ts    the block and item contract (zod) and its types
  validate.ts              findInvalidContent: what the site leaves out, for editors
  site.ts                  Site: page tree, navigation, languages, reading order (indexed once)
  languages, tags, table, search, text
packages/plate/
  connector/               CDA transport: fetch, retries, timeouts, zod-checked responses
  cast/                    CAST → HAST with delta-cast-util-to-hast (+ link resolving, heading offset)
  source/                  createPlateSource(env): ContentSource. Maps experiences and items to core
  editor/                  live editor: WindowConnector, origin check, draft → core Page
  theme/                   delta/ snapshot, `plate:sync`, `plate:check` (theme covers the core contract)
```

## Phases

Each phase is one pull request; `format:check`, `lint`, `check`, `test` and `build` pass.

| #   | Deliverable                                                                    | Done when                                       | Status |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------- | ------ |
| 0   | Workspace skeleton, tooling, CI, Tailwind                                      | All checks pass on an empty site                | Done   |
| 1   | `core`: model, block/item contract, validation, site helpers, with their tests | The ported tests pass                           | Done   |
| 2   | `plate/connector`, `plate/cast`, `plate/source`                                | Same pages and items as the old loader          |        |
| 3   | Site blocks and layout in Tailwind, rendering core types                       | Every block matches the old site; build passes  |        |
| 4   | Build integration (encryption, search, links, report), host-independent        | The built site works behind the login           | Done   |
| 5   | `plate/editor` + `/editor/` preview; `plate/theme` sync and check              | Draft preview and click-to-select work in Plate | Done   |
| 6   | README, `ARCHITECTURE.md` ("add a CMS adapter"), `OPERATIONS.md`, editor guide | Docs complete; old repo archived                | Done   |

## Decisions

- **Core owns the contract.** Block and item schemas are written in core, not generated from the
  Plate theme. A CMS's theme check verifies that it covers them.
- **Pages have `blocks`, not a root block.** A root container is a Plate detail; the adapter drops it.
- **Ids, not PRNs.** `id`, `pageId`, `ancestorIds`, `PageRef.id` are opaque strings.
- **`Site` replaces module-level caches.** `createSite(content, options)` indexes on first use;
  languages and sequence sections are options, not environment reads, so core stays pure.
- **CMS quirks stay in the adapter:** the `/home` alias, item languages by Plate language PRN, request
  batching (`mapLimit`).
- **Plate values are mapped by their value type.** delta-client's `parseDataFrom…` parsers drop the
  value type, which the core shapes need (smart text → HAST, asset, path part, tag, linked item), so
  `plate/source` maps the accessible format itself. delta-client still supplies the value type names,
  and will supply the editor connection and the GraphQL → accessible converter in phase 5.
- **A demo source** (`apps/site/src/content/demo.ts`, invented content) lets CI build the site and
  anyone try it without CMS secrets: `CONTENT_SOURCE=demo`.
- **Rich text is sanitized on render** (`hast-util-sanitize`), then adapted to the site: headings
  shifted below the page title, base path, external links in a new tab.
- **Dropped:** the root block's `show-sidebar` field (the root block is gone) and the hidden header
  navigation links. The sidebar shows on every page.
- **Hosting is decided later** (EU-based, for the GDPR/AVG). Until then the build stays
  host-independent: a static folder, and no requests to third parties from visitors' browsers
  (the Inter font is self-hosted with `@fontsource-variable/inter`).
- **Hosting is decided later** (EU-based, for the GDPR/AVG). Until then the build stays
  host-independent: a static folder, and no requests to third parties from visitors' browsers
  (the Inter font is self-hosted with `@fontsource-variable/inter`).
- **The live preview is CMS-agnostic:** the adapter delivers a core `Page`, and the site's `/preview`
  route renders it with the same components.

## Moved in phase 1

| From `plate-intranet`                                         | To `packages/core`                                |
| ------------------------------------------------------------- | ------------------------------------------------- |
| `plate-content/types.ts`                                      | `model.ts` (CMS-agnostic names)                   |
| `lib/schemas/values.ts`, `plate.generated.ts`, `index.ts`     | `values.ts`, `schemas.ts` (hand-written contract) |
| `findInvalidContent`                                          | `validate.ts`                                     |
| `lib/site.ts`, `navigation.ts`, `languages.ts`, `sequence.ts` | `site.ts` (`Site`), `languages.ts`                |
| `lib/coerce.ts`, `normalizePath`                              | `text.ts`                                         |
| `lib/tags.ts`, `table.ts` (without base path), `search.ts`    | `tags.ts`, `table.ts`, `search.ts`                |

## Moved in phase 2

| From `plate-intranet`                                     | To                                                |
| --------------------------------------------------------- | ------------------------------------------------- |
| `cda.ts`: requests, retries, discovery, items, `mapLimit` | `plate/connector` (`createCdaClient`)             |
| `plate-content/schemas.ts` (CDA responses)                | `plate/connector/schemas.ts`                      |
| `lib/cast.ts` (CAST → HTML)                               | `plate/cast` (CAST → HAST with Plate's converter) |
| `cda.ts`: mapping, tags, `assertUniquePaths`              | `plate/source/map.ts`, `source.ts`                |
| `lib/site.ts`: `useHomeAlias`, `parseItemLanguages`       | `plate/source/source.ts`                          |

## Moved in phase 3

| From `plate-intranet`                           | To `apps/site`                                             |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `src/blocks/*` (scoped CSS)                     | `src/blocks/*` (Tailwind), typed with `BlockProps<…>`      |
| `components/ui`, `components/layout`, `layouts` | same folders, Tailwind; `Link` handles base + new tab      |
| `components/experience/*`                       | `components/page/*` (`PageView`, `BlockRenderer`)          |
| `lib/site.ts` (`getSite`)                       | `src/content/index.ts` (picks the source)                  |
| `lib/cast.ts` (render, excerpt)                 | `lib/rich-text.ts` (sanitize + adapt), core `rich-text.ts` |
| `lib/url.ts`, `date.ts`, `blocks.ts`            | `lib/url.ts`, `date.ts`, `blocks.ts`                       |

## Moved in phase 4

| From `plate-intranet`                                            | To `apps/site`                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------ |
| `scripts/postbuild.mjs`, `check-links.mjs` (chained after build) | `src/integrations/index.ts` (one `astro:build:done` hook)    |
| `scripts/lib/protect.mjs`, `links.mjs`, `search.mjs`             | `src/integrations/protect.ts`, `links.ts`, `search-index.ts` |
| `lib/content-report.ts` + broken-link report                     | `src/integrations/report.ts` (one report for both)           |
| `lib/session.ts`, `return-to.ts`, `pages/login`, `pages/search`  | same, Tailwind; sign-out in the header                       |

## Moved in phase 5

| From `plate-intranet`                                              | To                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `plate-content/preview.ts` (draft → experience)                    | `plate/editor/draft.ts` (draft → core `Page`, via plate/source) |
| `pages/editor/index.astro` (connector, origin check)               | `plate/editor/connect.ts` + a CMS-agnostic `pages/editor/`      |
| `src/editor/render.ts`, `scripts/build-editor.mjs`, `site.json.ts` | `src/preview/*`, `scripts/build-preview.mjs`, `pages/editor/`   |
| `delta/`, `delta.config.ts`, `scripts/sync-theme.mjs`, theme-sync  | `plate/theme` (`delta/`, `scripts/sync.ts`, `src/theme.ts`)     |
| `generate-schemas.mjs`, `check-theme.mjs` (`plate:check`)          | `plate/theme/src/contract.ts`, checked by `pnpm test`           |

`pnpm plate:sync` runs a TypeScript script with Node's type stripping (Node 22.18 or newer).

Waiting for the hosting decision: deploy workflows, the publish webhook, editor notifications
(Slack/Teams; the reports in `.reports/` are ready for it) and host-specific files.

## Risks

- **Licence.** The `@platecms/delta-cast*` packages are marked `UNLICENSED` and this repo is public.
  Get written permission from Plate before depending on them. Fallback: `plate/cast` keeps its own
  converter behind the same interface.
- **Packaging.** `delta-cast-util-to-hast` ships only `.ts` sources (with `main` pointing to `.js`).
  Vite compiles them; a pnpm patch (`patches/`) adds a small `index.d.ts`, because the sources don't
  pass a strict type check. The site will also need `ssr.noExternal` for it (phase 3).
- **Live preview.** It runs Astro components in the browser through Astro's internal runtime:
  `astro` stays pinned to an exact version, guarded by a renderer test.
