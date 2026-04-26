# NCT_frontend

<div align="center">
  <p><strong>NCT_frontend</strong></p>
  <p>NO CONVERSION THERAPY frontend</p>
  <p>Multilingual frontend for documenting, organizing, and publicly presenting information about conversion therapy institutions and lived experiences.</p>
  <p>
    <a href="./README.md">简体中文</a> ·
    <a href="./README.zh-TW.md">繁體中文</a> ·
    <a href="./README.en.md"><strong>English</strong></a>
  </p>
  <p>
    <img alt="Node.js 20+" src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white">
    <img alt="Vite 8" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white">
    <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white">
    <img alt="Static Content Snapshots" src="https://img.shields.io/badge/Static-Content%20Snapshots-0F766E">
  </p>
</div>

> Updated on April 25, 2026: the `NCT_frontend` project root is now a standalone `Vite + React` static frontend. The legacy `Express + EJS + Workers` stack lives in the sibling project `../NCT_old`, while public JSON, form, translation, and data-write backend services now belong to `../NCT_database` and `../NCT_backend`.

## What This Project Is

`NCT_frontend` is now the public-facing frontend shell, not the backend service. It is responsible for:

- rendering static frontend routes such as `/`, `/map`, `/blog`, `/port/:id`, `/privacy`, and `/form`
- generating `site-bootstrap.json`, `area-selector.json`, and blog article snapshots at build time
- reusing the checked-in `public/content/map-data.json` snapshot while reading public map data at runtime
- redirecting `/form` to the standalone `NCT_backend` form page when `VITE_NCT_SUB_FORM_URL` is configured
- reusing the same backend origin for runtime translation of English blog articles and record details in non-`zh-CN` languages

The root project no longer ships:

- an `Express + EJS` server
- a Worker backend
- form submission write APIs
- institution correction submission APIs
- runtime token endpoints such as `/api/frontend-runtime`

Related sibling projects:

- [`../NCT_old`](../NCT_old): legacy `Express + EJS + Workers`
- [`../NCT_database`](../NCT_database): mother database, public JSON, admin console, push, and recovery pull
- [`../NCT_backend`](../NCT_backend): standalone form page, `NCT_frontend` backend APIs, translation, and service reporting

## Current Capabilities

| Module | Notes |
| --- | --- |
| Home / portal | SPA shell for navigation, language switching, and route resolution |
| Map browsing | Reads the public dataset from `VITE_NCT_API_SQL_PUBLIC_DATA_URL`, falling back to `public/content/map-data.json` |
| Blog content | Converts Markdown into static JSON payloads with pre-rendered HTML during the build |
| Multilingual UI | Uses `site-bootstrap.json` for messages, supported languages, and defaults |
| Form entry | `/form` is always a frontend gateway page; when `VITE_NCT_SUB_FORM_URL` is set it redirects to `NCT_backend`, otherwise it shows `api-only` guidance |
| Runtime translation | Requires `VITE_NCT_SUB_FORM_URL`; English blog articles get article translation, and non-`zh-CN` record details get field translation |

## Compatibility Notes

The repo still contains some migration-phase frontend code for compatibility, but there is an important boundary:

- `/form` is no longer a local submission flow; it is now a redirect / explanation page
- the repo still contains compatibility components for institution correction and the old submission preview / confirm / result flows
- those compatibility pages are normally reused through backend-provided non-`frontend-router` bootstrap payloads (`pageType` / `pageProps`); a pure static deployment does not resolve routes such as `/map/correction` by itself
- those flows still expect same-origin endpoints such as `/api/frontend-runtime`, `/map/correction/submit`, or `/correction/submit`
- those endpoints are not implemented in this project

So for a direct static deployment of `NCT_frontend`:

- map pages, blog pages, privacy pages, article detail pages, and the `/form` gateway page work on their own
- `/form` only auto-redirects and appears in primary navigation when `VITE_NCT_SUB_FORM_URL` is configured
- institution correction and other legacy submission flows still require a compatible backend or proxy, or the legacy `NCT_old` stack

## Tech Stack

| Category | Choice |
| --- | --- |
| Frontend | Vite 8 + React 19 |
| Map rendering | Leaflet |
| Content build | Node.js scripts that emit static JSON snapshots |
| Content sources | `blog/*.md`, `data.json`, `friends.json`, and public map JSON |
| Deployment target | Static hosting |

## Repository Layout

```text
.
├── frontend/src/              # React entry, router, and page logic
├── public/content/            # Build-time snapshots plus the versioned map-data.json
├── blog/                      # Markdown article sources
├── config/                    # i18n, area options, runtime config
├── scripts/                   # Content generation and config helpers
├── tests/                     # Frontend and build-script tests
├── vite.config.js             # Vite config
└── index.html                 # SPA host page
```

## Environment Variables

Create a local env file:

```bash
cp .env.example .env
```

[`./.env.example`](./.env.example) now lists all project-level environment
variables in order of how likely they need changes, plus runtime flags that are usually injected by the platform.

### Required Variables

This frontend has no universally required environment variable; a static-only
deployment can start with zero config.

Treat these as required when you enable the related features:

- `VITE_NCT_API_SQL_PUBLIC_DATA_URL` when you want live public data from `NCT_database` instead of the checked-in snapshot
- `VITE_NCT_SUB_FORM_URL` when you want the `/form` entry route and runtime translation features

Key variables:

| Variable | Purpose |
| --- | --- |
| `VITE_NCT_API_SQL_PUBLIC_DATA_URL` | public map dataset URL; defaults to `/content/map-data.json` |
| `VITE_NCT_SUB_FORM_URL` | standalone form URL from `NCT_backend`, for example `https://sub.example.com/form` |

Additional notes:

- `VITE_*` variables are exposed to the browser runtime
- whether `VITE_NCT_SUB_FORM_URL` is configured determines the frontend deployment mode: set means `hono`, blank means `api-only`
- build-time map data always uses the checked-in `public/content/map-data.json`; remote snapshot refresh env vars are no longer supported
- `RUNTIME_TARGET` / `CF_PAGES` are usually platform-injected flags, so local development rarely needs to set them manually
- [`.dev.vars.example`](./.dev.vars.example) is now just a reminder that the root project no longer deploys its own Worker backend

## Quick Start

```bash
cd <project-root>
npm install
cp .env.example .env
npm run dev
```

Default local address:

- Vite dev server: `http://127.0.0.1:5173`

For a full end-to-end local setup, you usually also want:

- `../NCT_database` for the public dataset
- `../NCT_backend` for the standalone form page and runtime translation API

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | start the Vite dev server |
| `npm run frontend:prepare-content` | generate `public/content/*` snapshots |
| `npm run frontend:build` | generate snapshots and build the frontend |
| `npm run frontend:preview` | preview the production build locally |
| `npm run test:unit` | run Node-based unit tests |
| `npm test` | run tests and a build check |

Notes:

- `npm run dev:workers` and `npm run deploy:workers` now only print migration guidance and no longer start or deploy a backend

## Build-Time Static Content

`npm run frontend:prepare-content` writes or updates:

- `public/content/site-bootstrap.json`
- `public/content/area-selector.json`
- `public/content/blog/index.json`
- `public/content/blog/articles/*.json`
- `public/content/map-data.json` is not regenerated by the script; the build only validates and reuses the checked-in snapshot, and fails if it is missing

This is what lets the frontend render:

- public map data
- language messages
- blog listings and article bodies

without shipping its own backend.

## Cloudflare Workers Deployment

Use Cloudflare Dashboard Workers Builds. The project name is the Workers-compatible form of the directory name: `nct-frontend`.

The deployment reads [`wrangler.toml`](./wrangler.toml). This project does not need D1, R2, Cron, or Worker secrets; `[assets].directory = "./dist"` publishes the Vite build output, and `not_found_handling = "single-page-application"` keeps frontend routes such as `/map`, `/blog`, and `/form` working.

| Cloudflare field | Value |
| --- | --- |
| Project name | `nct-frontend` |
| Production branch | your production branch, for example `main` |
| Path / Root directory | `NCT_frontend` in this monorepo; `/` if this project is a standalone repository |
| Build command | `npm run test:unit` |
| Deploy command | `npm run deploy:workers` |
| Non-production branch deploy command | `npm run deploy:workers:preview` |

Set these build-time variables in `Settings` -> `Variables and Secrets`:

- `VITE_NCT_API_SQL_PUBLIC_DATA_URL=https://api.example.com/`
- `VITE_NCT_SUB_FORM_URL=https://sub.example.com/form`

After deployment, bind the custom domain in `Settings` -> `Domains & Routes`.

## README Audit Result

After checking the code and scripts, the README was aligned with the current frontend-only role of `NCT_frontend`. In particular:

- `frontend:prepare-content` does not fetch or regenerate `map-data.json`; it only reuses and validates the checked-in snapshot
- correction and legacy submission pages still exist as compatibility components, but pure static `frontend-router` deployments do not expose those routes directly
