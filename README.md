# Team intranet

Static intranet for Team iDA / Enfold. Content comes from a headless CMS through an adapter that
turns it into one CMS-agnostic model; the Astro site only renders that model.

```
CMS ──► adapter (packages/plate/*) ──► core model (packages/core) ──► Astro + Tailwind (apps/site)
```

## Quick start

Requires Node 22+ and pnpm 10 (`corepack enable`).

```sh
cp .env.example .env
pnpm install
pnpm dev
```

| Script                              | What it does                                    |
| ----------------------------------- | ----------------------------------------------- |
| `pnpm dev` / `build` / `preview`    | Run, build or serve the site                    |
| `pnpm check`                        | Type-check every package (`astro check`, `tsc`) |
| `pnpm test`                         | Vitest, all packages                            |
| `pnpm lint`                         | ESLint                                          |
| `pnpm format` / `pnpm format:check` | Prettier (with the Tailwind class sorter)       |

## Structure

```
apps/site/                Astro + Tailwind: routes, layouts, blocks, ui
packages/core/            CMS-agnostic model, block schemas, ContentSource interface, site helpers
packages/plate/connector  Plate CDA transport
packages/plate/cast       Plate rich text (CAST) → HAST
packages/plate/source     ContentSource for Plate
packages/plate/editor     Plate live editor connection
packages/plate/theme      Plate theme snapshot, sync and check
```

Rules: the site imports only `@team-intranet/core`; adapters depend on core, core depends on
nothing. Workspace packages have no build step: they export their TypeScript source.

The repo is public: never commit content exported from a CMS.

The migration from `plate-intranet` follows [docs/PLAN.md](docs/PLAN.md).
