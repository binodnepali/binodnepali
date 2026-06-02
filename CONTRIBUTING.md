# Contributing / development

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

Personal site and CV at [binodnepali.me](https://binodnepali.me/), built with
[fresh](https://fresh.deno.dev/), [deno](https://deno.land/), and
[Tailwind CSS](https://tailwindcss.com/). Deployed on
[Deno Deploy](https://docs.deno.com/deploy/manual).

The GitHub profile README at the repo root is generated from profile data — see
`deno task generate-profile-readme`.

## Before getting started

Install [deno 2.4](https://docs.deno.com/runtime/manual) or higher.

### Cloning repo

```bash
# https
git clone https://github.com/binodnepali/binodnepali.git

# ssh
git clone git@github.com:binodnepali/binodnepali.git
```

```bash
cd binodnepali
```

### Usage

#### Start the project

```bash
deno task start
```

Watches `static/` and `routes/`; restart manually after changes under `src/`,
`components/`, or `islands/`.

#### Build the project

```bash
deno task build
```

#### Preview the project

```bash
deno task preview
```

#### Update the project

```bash
deno task update
```

#### Regenerate GitHub profile README

After editing [`data/linkedin-profile.json`](data/linkedin-profile.json):

```bash
deno task generate-profile-readme
```

Commit the updated `README.md`. A GitHub Action also runs this on pushes that
touch profile data or the generator.

#### Profile content

[`data/linkedin-profile.json`](data/linkedin-profile.json) is the source of truth
for the homepage CV and the profile README.

#### Tailored CVs

Create a job-specific CV with Gemini, then preview at `/cv/<slug>` and print to
PDF from the browser.

**Setup**

```bash
cp .env.sample .env
```

| Variable            | Where to get it                                                 |
| ------------------- | --------------------------------------------------------------- |
| `GEMINI_API_KEY`    | [Google AI Studio](https://aistudio.google.com/apikey)          |
| `TAILOR_CV_API_KEY` | Run `openssl rand -base64 32` — store the output as base64 text |

Set the same variables in the Deno Deploy dashboard for production.

**CLI**

```bash
deno task tailor-cv -- --slug acme-senior-frontend --job ./jobs/acme.txt
```

Put job descriptions in `jobs/` (gitignored). Useful flags:

- `--catalog` — list stable experience/project/skill ids
- `--dry-run` — print JSON without saving

**Browser upload** — `/admin/tailor`

Private page (not linked from the site). Access is controlled by the `X-API-Key`
header — there is no password field on the page.

1. In a browser extension such as [Requestly](https://requestly.com/), add a
   **Modify Headers** rule for your site URL (e.g. `http://localhost:8000/*` and
   `https://binodnepali.me/*`).
2. Set header `X-API-Key` to your base64 `TAILOR_CV_API_KEY` value.
3. Visit `/admin/tailor` — upload a `.txt` or `.md` job posting and create the
   CV.

Without the header, the page shows an unauthorized message instead of the form.

**HTTP API** — for scripts or tools

```bash
curl -X POST http://localhost:8000/api/cv/tailor \
  -H "X-API-Key: $TAILOR_CV_API_KEY" \
  -F "file=@./jobs/acme.txt" \
  -F "slug=acme-senior-frontend"
```

**Storage**

Variants are saved to Deno KV in production. Locally they are also written to
`data/variants/` when the filesystem is writable. Tailored CV pages are
`noindex` and not linked from the public navigation.

#### Generate release

Requires npm 5.2.0+:

```bash
npx commit-and-tag-version
```

See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version).
