# Team intranet

Static intranet for Team iDA / Enfold. Editors build pages in a headless CMS (now Plate); an adapter
turns the content into one CMS-agnostic model, and an Astro + Tailwind site renders that model to
plain HTML behind a shared team login.

```
CMS ──► adapter (packages/plate/*) ──► core model (packages/core) ──► Astro + Tailwind (apps/site) ──► static files
```

## Quick start

Requires Node 22.18+ and pnpm 10 (`corepack enable`).

```sh
cp .env.example .env   # set PLATE_DELIVERY_TOKEN, or CONTENT_SOURCE=demo to try it without a CMS
pnpm install
pnpm dev               # http://localhost:4321
```

| Script                              | What it does                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm dev` / `build` / `preview`    | Run, build (to `apps/site/dist/`) or serve the build                             |
| `pnpm check`                        | Type-check every package                                                         |
| `pnpm test`                         | Vitest, all packages, including the Plate theme against the core contract        |
| `pnpm lint`                         | ESLint                                                                           |
| `pnpm format` / `pnpm format:check` | Prettier (with the Tailwind class sorter)                                        |
| `pnpm plate:sync`                   | Refresh the Plate theme snapshot ([plate/theme](packages/plate/theme/README.md)) |

CI runs `format:check`, `lint`, `check`, `test` and a demo `build` on every pull request: run them
before pushing.

## Structure

```
apps/site/                 Astro + Tailwind: pages, layouts, blocks, ui, build integration, live preview
packages/core/             CMS-agnostic model, block and item contract, site helpers
packages/plate/connector   Plate Content Delivery API transport
packages/plate/cast        Plate rich text (CAST) → HAST
packages/plate/source      Plate as a ContentSource
packages/plate/editor      Plate's live editor: drafts and click-to-select
packages/plate/theme       Plate theme snapshot, sync and contract check
```

The site imports only `@team-intranet/core` (plus one line each to pick the content source and the
live editor). Adapters depend on core; core depends on nothing but zod.

## Documentation

| Document                                     | For                                                              |
| -------------------------------------------- | ---------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Developers: how it fits together, adding a block, adding a CMS   |
| [docs/OPERATIONS.md](docs/OPERATIONS.md)     | Building, login, settings, search, reports, troubleshooting      |
| [docs/EDITING.md](docs/EDITING.md)           | Editors: which block to use, overviews, tables, after publishing |
| [docs/PLAN.md](docs/PLAN.md)                 | How the project moved from `plate-intranet`, and its decisions   |

The repo is public: never commit content exported from a CMS. Content only enters the site at build
time.
