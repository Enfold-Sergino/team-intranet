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
| 4   | Build integration (encryption, search, links, report) and deploy workflows     | Deploys behind the login; webhook rebuild works |        |
| 5   | `plate/editor` + `/preview`; `plate/theme` sync and check                      | Draft preview and click-to-select work in Plate |        |
| 6   | README, `ARCHITECTURE.md` ("add a CMS adapter"), editor guide                  | Old repo archived                               |        |

## Decisions

- **Core owns the contract.** Block and item schemas are written in core, not generated from the
  Plate theme. A CMS's theme check verifies that it covers them.
- **Pages have `blocks`, not a root block.** A root container is a Plate detail; the adapter drops it.
- **Ids, not PRNs.** `id`, `pageId`, `ancestorIds`, `PageRef.id` are opaque strings.
- **`Site` replaces module-level caches.** `createSite(content, options)` indexes on first use;
  languages and sequence sections are options, not environment reads, so core stays pure.
- **CMS quirks stay in the adapter:** the `/home` alias, item languages by Plate language PRN, request
  batching (`mapLimit`).
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

Left for later phases: `useHomeAlias`, `parseItemLanguages`, `mapLimit` (phase 2, plate/source);
`url.ts`, `date.ts`, `blocks.ts` (phase 3, site); `content-report.ts`, `return-to.ts`, `session.ts`,
search index extraction (phase 4, site integrations).

## Risks

- **Licence.** The `@platecms/delta-cast*` packages are marked `UNLICENSED` and this repo is public.
  Get written permission from Plate before depending on them. Fallback: `plate/cast` keeps its own
  converter behind the same interface.
- **Packaging.** Those packages ship only `.ts` sources while `main` points to `.js`: `plate/cast`
  aliases them to their source and lets Vite compile them (`ssr.noExternal`).
- **Live preview.** It runs Astro components in the browser through Astro's internal runtime:
  `astro` stays pinned to an exact version, guarded by a renderer test.
