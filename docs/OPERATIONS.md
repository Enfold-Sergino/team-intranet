# Operations

Building, the shared login, settings, search and reports. Hosting is not chosen yet (it will be
EU-based, for the GDPR/AVG); the build is host-independent until then.

## Build

```sh
pnpm build   # → apps/site/dist/, a plain static folder
```

Content is loaded once per build. Publishing in the CMS needs a rebuild to show; a publish webhook
that triggers one comes with the hosting setup.

What a host must do:

- Serve `apps/site/dist/` as static files, with `404.html` for unknown paths (the live editor preview
  relies on it: `/editor/content-experiences/…` is forwarded to `/editor/`).
- Set `SITE_URL`, and `SITE_BASE` when the site lives under a sub-path.
- Not serve other sites on the same origin: they could read the sign-in key (below).

## Login on a static host

There is no server, so there is no session cookie. With `SITE_USERNAME` and `SITE_PASSWORD` set, the
build encrypts every page (AES-256-GCM, key = PBKDF2-SHA256 of username + password) and replaces it
with a small loader. The login page derives the same key in the browser and keeps it in
`localStorage` for `SESSION_HOURS`; each page decrypts itself with it, or sends the visitor to
`/login/`. Without both settings the build is **not** protected, and says so.

- Use a long random password (at least 16 characters, enforced; e.g. `openssl rand -base64 24`): the
  encrypted files are public and could be attacked offline.
- Changing the username or password and rebuilding signs everyone out.
- Not encrypted: `/login/`, `/404.html`, `/editor/` (no content), CSS/JS bundles and `public/` files.
- **Files uploaded to the CMS are public.** Plate serves images and documents to anyone with the
  link. Keep confidential documents out of the CMS and link to them in SharePoint or Google Drive.

## Settings

Each package reads its own `.env` (git-ignored; copy its `.env.example`):

- `apps/site/.env`: everything the site needs, below. Astro reads it for the content, the build
  integration for the login settings.
- `packages/plate/theme/.env`: `PLATE_THEME_PRN` and `PLATE_DELTA_PROFILE`, for `pnpm plate:sync`
  only.

Values set in the shell or by CI win over the file.

| Name                             | Purpose                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `CONTENT_SOURCE`                 | `plate` (default) or `demo` (invented content, used by CI)         |
| `PLATE_DELIVERY_TOKEN`           | Channel-scoped Plate CDA token. **Secret**                         |
| `PLATE_CDA_URL`                  | Another CDA URL (default `https://cda.platecms.app`)               |
| `PLATE_LANGUAGE_PRNS`            | Plate languages per site language, so items are split per language |
| `PLATE_HOME_PATH`                | Page served at a language root that has none (default `/home`)     |
| `SITE_LANGUAGES`                 | `code:label:name:root,…` (default English at `/`, Dutch at `/nl`)  |
| `SITE_USERNAME`, `SITE_PASSWORD` | The shared login. **Secret**                                       |
| `SESSION_HOURS`                  | How long a sign-in lasts (default 12)                              |
| `SITE_URL`, `SITE_BASE`          | Where the site is served                                           |

### In GitHub Actions

CI has no `.env` files: the same names come from **Settings → Secrets and variables → Actions**, and
a workflow passes them to the build step as environment variables.

- **Secrets** (masked in logs): `PLATE_DELIVERY_TOKEN`, `SITE_USERNAME`, `SITE_PASSWORD`.
- **Variables**: `PLATE_LANGUAGE_PRNS`, `PLATE_HOME_PATH`, `SITE_LANGUAGES`, `SESSION_HOURS`,
  `SITE_URL`, `SITE_BASE`.

```yaml
- run: pnpm build
  env:
    PLATE_DELIVERY_TOKEN: ${{ secrets.PLATE_DELIVERY_TOKEN }}
    SITE_USERNAME: ${{ secrets.SITE_USERNAME }}
    SITE_PASSWORD: ${{ secrets.SITE_PASSWORD }}
    PLATE_LANGUAGE_PRNS: ${{ vars.PLATE_LANGUAGE_PRNS }}
    SITE_URL: ${{ vars.SITE_URL }}
```

The pull request checks (`ci.yml`) need none of them: they build the demo content. The real build
with secrets belongs in the deploy workflow, which comes with the hosting choice. A deploy should
fail when `PLATE_DELIVERY_TOKEN`, `SITE_USERNAME` or `SITE_PASSWORD` is missing, so pages are never
published unprotected. The theme sync stays local: it needs the Delta CLI and its profile.

## Search

`/search/` and the header search box search the full text of every page in the browser. The build
collects each page's title and main text into `search-index.json`, encrypted like the pages.
Matching ignores case and accents, requires every word and ranks title matches first.

## Reports for editors

Content that doesn't fit the contract is left out of the site (the rest publishes), and links to
pages that don't exist are listed. Both are reported on every build: as warnings and a table in the
GitHub Actions summary, in the terminal elsewhere, and in `.reports/content-problems.json` and
`.reports/broken-links.json` for a notification step later. In `pnpm dev` and the live preview the
problem shows on the block itself.

## Troubleshooting

| Symptom                                                      | Likely cause and fix                                                                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Build stops at once about `SITE_PASSWORD`                    | Only one of username/password is set, or the password is shorter than 16 characters.                                          |
| Build fails with a CDA error                                 | Plate is unreachable, the token expired or lost access, or the API changed (the error names the field).                       |
| Build fails on duplicate paths                               | Two pages have the same path in the CMS. Rename or unpublish one.                                                             |
| Build fails on URLs without the base path                    | A component builds a root-relative URL without `withBase()`. A code bug, not content.                                         |
| A block or item is missing on a page                         | It doesn't fit the contract: see the content report for the field and the problem.                                            |
| `pnpm test` fails in the Plate theme test                    | Plate, core and the components disagree about a block or item: the message names it (see ARCHITECTURE).                       |
| `pnpm test` fails in `preview.test.ts` after upgrading Astro | Astro changed the internal runtime the live preview uses. Keep the previous version until `src/preview/render.ts` is updated. |
| Everybody is signed out                                      | The login changed, or the session expired. Expected.                                                                          |
