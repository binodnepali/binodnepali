# AGENTS.md

Guidance for AI agents working in this repository.

## Project overview

Personal portfolio website (https://binodnepali.me) built with **Deno Fresh**
(server-side rendering + islands), **Preact**, and **Tailwind CSS**. The
homepage is an ATS-style CV with print-to-PDF. The site also exposes JSON/ICS
API endpoints under `routes/api/`.

## Tech stack

- Runtime: **Deno** (use >= 2.4 locally; `deno deploy` and some tooling need
  it).
- Framework: **Fresh 1.6.8** (`$fresh/`), rendering with **Preact**
  (`jsx: react-jsx`, `jsxImportSource: preact`).
- Styling: **Tailwind CSS 3.4** via the Fresh tailwind plugin
  (`fresh.config.ts`).
- Storage: **Deno KV** (unstable, enabled via `"unstable": ["kv"]` in
  `deno.json`).
- HTML scraping: **deno_dom** (WASM) — never Puppeteer or Node-only libs.

Dependencies are managed through the import map in `deno.json`, not
`package.json`.

## Commands

Run from the repo root:

- `deno task start` — dev server with watch (http://localhost:8000).
- `deno task build` — production build (regenerates `fresh.gen.ts`, writes
  `_fresh/`).
- `deno task preview` — run the built app via `main.ts`.
- `deno task check` — **run before finishing changes**:
  `deno fmt --check && deno lint && deno check` over `.ts`/`.tsx`.
- `deno task manifest` — regenerate `fresh.gen.ts`.
- `deno task tailor-cv` — generate a job-specific CV variant via Gemini.
  Requires `GEMINI_API_KEY` in `.env`. Example:
  `deno task tailor-cv -- --slug acme-senior-frontend --job ./jobs/acme.txt`
  (the `--` after the task name is required so flags reach the script).
- `deno task generate-profile-readme` — regenerate root `README.md` (GitHub
  profile CV) from `data/linkedin-profile.json`.

When verifying your own edits, prefer scoping `deno fmt` / `deno lint` /
`deno check` to the files you touched, since unrelated files (e.g.
`CHANGELOG.md`) may already fail `deno fmt --check`.

## Project structure

- `routes/` — Fresh file-based routing.
  - `routes/index.tsx`, `_app.tsx`, `_404.tsx` — pages/layout.
  - `routes/cv/[slug].tsx` — tailored CV preview pages.
  - `routes/admin/tailor.tsx` — private upload UI (noindex; `X-API-Key` on GET).
  - `routes/calendar.tsx` — human-facing calendar page.
  - `routes/api/**` — API handlers exporting `handler` (e.g. `profile.ts`,
    `cv/tailor.ts`, `ical/index.ts`, `ical/[year].ts`).
- `islands/` — interactive client components (hydrated; only place
  `useState`/event handlers belong), e.g. `DownloadCv.tsx`, `TailorCvForm.tsx`.
- `components/` — server-rendered presentational components; shared primitives
  in `components/ui/`, CV layout in `components/CvPage.tsx`, section helper in
  `components/cv/Section.tsx`, `TailorUnauthorized.tsx` for gated admin pages.
- `scripts/` — CLI entrypoints (e.g. `scripts/tailor-cv.ts`).
- `src/server/` — server-only logic (no JSX), e.g. `src/server/calendar/`
  (scraping, ICS building, caching) and `src/server/profile/` (profile loading,
  variant merge, Gemini generation, KV store, API-key auth).
- `src/types/` — shared TypeScript types/interfaces.
- `src/utils/` — shared helpers (e.g. `src/utils/date.ts`).
- `data/` — static JSON data.
  - `data/linkedin-profile.json` — master profile (source of truth).
  - `data/variants/*.json` — optional committed variants (fallback if not in
    KV).
- `jobs/` — local job-description inputs for the CLI (gitignored).
- `static/` — static assets served at the web root.

`fresh.gen.ts` is auto-generated — never edit it by hand; it updates on
`deno task build`/`start`.

## Conventions

- Formatting/linting: use Deno's defaults (2-space indent, double quotes,
  semicolons) and the `["fresh", "recommended"]` lint rules. Do not hand-format
  against these.
- Components vs islands: keep components static; move anything needing browser
  state/interactivity into `islands/`. Guard browser-only behavior with
  `IS_BROWSER` from `$fresh/runtime.ts`.
- Types: import shared types from `src/types/`; avoid `any`.
- Don't add narrating comments; only comment non-obvious intent.

## Profile & CV content

- Master profile lives in `data/linkedin-profile.json`. Edit it directly when
  updating LinkedIn-style content; there is no runtime PDF import or admin UI.
- Root `README.md` is the **GitHub profile CV** — regenerate with
  `deno task generate-profile-readme` after profile edits. Developer docs live in
  `CONTRIBUTING.md`.
- Profile photo: set `profile_pic_url` to `github` (uses avatar from
  `extra.github_profile_id`) or a full `https://…` URL. Site-relative paths also
  resolve to the GitHub avatar; omit `profile.webp` unless you host a custom image
  under `static/`.
- `include_in_cv: false` on skills or projects hides them in **print/PDF only**
  (`print:hidden`); they remain visible on the live site.
- Experience/project **ids** are computed at runtime in
  `src/server/profile/ids.ts` (or optional explicit `id` fields in JSON). Use
  `deno task tailor-cv -- --catalog` to list stable ids for LLM output.
- Default CV: `/` via `routes/index.tsx` + `components/CvPage.tsx`.
- Tailored CV: `/cv/<slug>` merges a saved variant onto the master profile
  (`src/server/profile/variant.ts`). `loadVariant()` reads **Deno KV first**,
  then `data/variants/<slug>.json`. Tailored pages set `noindex` and are not
  linked from the public nav.
- Print/PDF: `islands/DownloadCv.tsx` calls `window.print()`; styles in
  `static/styles.css` (`.cv-sheet`, `@media print`).

## Tailor CV (Gemini)

Generation uses the **Gemini REST API** (`fetch`) in
`src/server/profile/generateVariant.ts` — edge-compatible, shared by the CLI and
HTTP API.

### Environment

| Variable            | Purpose                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `GEMINI_API_KEY`    | Google AI Studio key (or `GOOGLE_API_KEY`)                           |
| `GEMINI_MODEL`      | Optional; default `gemini-2.5-flash`                                 |
| `TAILOR_CV_API_KEY` | Base64 text for HTTP/admin auth. Generate: `openssl rand -base64 32` |

Set all required vars in `.env` locally and in the Deno Deploy dashboard for
production.

### CLI

`scripts/tailor-cv.ts` → validate ids against catalog → save to Deno KV and
`data/variants/<slug>.json` (file write may fail on Deploy; KV is primary in
prod).

Flags: `--catalog`, `--dry-run`, `--job <file>`, `--job-text "..."`.

### HTTP API — `POST /api/cv/tailor`

- Header: `X-API-Key` (same base64 value as `TAILOR_CV_API_KEY`).
- Body: `multipart/form-data` with `file` (`.txt` / `.md`, max 128KB) and
  optional `slug`.
- Returns `201` with `{ slug, label, previewUrl, storedInKv }`.
- Auth: `src/server/profile/tailorAuth.ts` (constant-time compare, base64
  validation). Returns `401` when missing/invalid; `503` when not configured.

### Upload UI — `/admin/tailor`

- **Private page** (noindex). No API key field in the form.
- `GET /admin/tailor` checks `X-API-Key` server-side; without a valid header,
  renders `TailorUnauthorized` (401) instead of the form.
- The owner injects `X-API-Key` via a browser extension (e.g. Requestly) for the
  site origin so page loads and `fetch("/api/cv/tailor")` both carry the header
  automatically.
- Copy on the form is written for non-technical users.

### Storage

- `src/server/profile/variantStore.ts` — KV keys under
  `["profile", "variants", slug]`.
- Keep variant JSON under Deno KV's **64KB per-value limit**.
- Do not commit `jobs/` (gitignored) or `.env`.

## Server / API guidelines

- This deploys to **Deno Deploy edge isolates**: use Web APIs (`fetch`,
  `Deno.serve` via Fresh) and Deno APIs only. **No Node built-ins, no
  Puppeteer/headless browser, no `npm:` packages that rely on Node internals.**
- Deno KV has a **64KB per-value limit** — store small values (the calendar
  cache is split per month for this reason). Wrap `kv.set` so an oversized write
  can't break a request.
- KV access should degrade gracefully: check `typeof Deno.openKv === "function"`
  and fall back to an in-memory cache (see `src/server/calendar/service.ts`).
- ICS/all-day dates: use `DTSTART;VALUE=DATE:YYYYMMDD` and read **local** date
  components (not UTC) to avoid off-by-one day shifts.
- Calendar canonical URLs: set `SITE_ORIGIN` in `.env` (see `.env.sample`).

## Deployment

- Deploys via the **new Deno Deploy** dashboard GitHub integration — pushing to
  `main` triggers a production build automatically.
- GitHub repo: `binodnepali/binodnepali` (profile README + site). No
  `deployctl`.
- **Profile README sync** — `.github/workflows/profile-readme.yml` runs
  `deno task generate-profile-readme` when profile data or the generator
  changes. Do not add other Actions unless explicitly asked.

## Commits

This project follows **Conventional Commits** (`feat:`, `fix:`, etc.) and uses
`commit-and-tag-version` for releases (`CHANGELOG.md`). Match that style. Only
create commits when explicitly asked.

## Gotchas

- `deno task start` only watches `static/` and `routes/`. Changes under `src/`,
  `components/`, or `islands/` imported by the server may require a manual
  restart.
- First request to a calendar year is slow (scrapes 12 month pages); subsequent
  requests hit the KV/in-memory cache.
- After adding routes (e.g. `routes/cv/[slug].tsx`), run `deno task manifest`.
- Tailored variants generated on Deploy persist in **Deno KV**, not the repo
  filesystem. Committed files in `data/variants/` remain a fallback for static
  variants shipped with the build.
- `deno task tailor-cv` passes a literal `--` to the script;
  `scripts/tailor-cv.ts` strips it before parsing args.
