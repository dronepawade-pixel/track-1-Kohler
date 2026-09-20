<!-- markdownlint-configure-file {
  "MD013": {
    "code_blocks": false,
    "tables": false
  },
  "MD033": false,
  "MD041": false
} -->

<div align="center">

<h1>KOHLER AI Bathroom Designer &amp; Planner</h1>

[![Next.js][next-badge]][next]
[![Supabase][supabase-badge]][supabase]
[![Live demo][demo-badge]][demo]

An **interactive AI design assistant** for bathrooms: enter dimensions, budget and
style, get a compatible Kohler product bundle with a 2D plan, 3D preview and budget
breakdown.<br />
Built by Devraj Pawade — Track 1, individual project.

[Prerequisites](#prerequisites) •
[Getting started](#getting-started) •
[Installation](#installation) •
[Usage](#usage) •
[Configuration](#configuration)

</div>

## Prerequisites

| Software | Version | Download |
| -------- | ------- | -------- |
| [Node.js] (includes npm) | 20 LTS or newer | https://nodejs.org/en/download |
| [Git] | any recent | https://git-scm.com/downloads |

OS-specific install commands are in [Installation](#installation) step 1.
No accounts, API keys or database setup needed — the app runs with a built-in
catalog and a keyword tag fallback; add a free Gemini key to turn on AI
tag reading, and Supabase keys to switch the catalog to the cloud.

## Getting started

```sh
git clone https://github.com/dronepawade-pixel/track-1-Kohler.git KOHLER
cd KOHLER
npm install
npm run dev        # open http://localhost:3000
```
Login / saved designs light up automatically if Supabase keys are present (see
[Configuration](#configuration)).

## Installation

The prototype runs in 3 easy steps:

1. **Install Node.js 20+**

   If Node.js isn't installed yet, pick your OS:

   <details>
   <summary>macOS</summary>

   > Download the LTS installer (includes npm):
   >
   > https://nodejs.org/en/download
   >
   > Or, using [Homebrew]:
   >
   > ```sh
   > brew install node@20
   > ```

   </details>

   <details>
   <summary>Windows</summary>

   > Download the LTS installer (includes npm):
   >
   > https://nodejs.org/en/download
   >
   > Or, using [winget]:
   >
   > ```sh
   > winget install OpenJS.NodeJS.LTS
   > ```

   </details>

   <details>
   <summary>Linux / WSL</summary>

   > Download from https://nodejs.org/en/download, or use a package manager:
   >
   > | Distribution | Instructions                          |
   > | ------------ | ------------------------------------- |
   > | Ubuntu/Debian| `sudo apt install nodejs npm`         |
   > | Fedora       | `sudo dnf install nodejs npm`         |
   > | Arch         | `sudo pacman -S nodejs npm`           |
   >
   > Verify with `node --version` (needs v20+).

   </details>

2. **Install dependencies**

   ```sh
   npm install
   ```

   This installs Next.js 16, React 19, Tailwind CSS v4, Supabase JS and
   Framer Motion (see `package.json`). Nothing else is required.

3. **Run it**

   ```sh
   npm run dev
   ```

   Open http://localhost:3000 — you should see the dark Kohler landing page.

   | Command         | What it does                              |
   | --------------- | ----------------------------------------- |
   | `npm run dev`   | Start the dev server (http://localhost:3000) |
   | `npm run build` | Production build (must pass before submitting) |
   | `npm start`     | Serve the production build (after `npm run build`) |
   | `npm run lint`  | Type-check (`tsc --noEmit`)               |

## Usage

A 60-second tour of the prototype:

```sh
/design/new   # 1. describe the bathroom: L×W×H, doors/windows, budget ₹, style + free-text brief
/planner      # 2. fixtures auto-placed from the brief; adjust with drag, rotate, snap, undo
/design/3d    # 3. walk around the concept — real product scans, cutaway, model swaps
/budget       # 4. check line items vs budget (recalculates on replace/remove)
/catalog      # 5. browse the filterable product grid + detail pages
/saved        # 6. saved designs + versions — kept in this browser, no login required
/login        # optional: email magic-link sign-in (needs Supabase keys → see Configuration)
```

Read more about the method in [`docs/AI_IMPLEMENTATION.md`][ai-impl] and the
data pipeline in [`docs/MANUAL_GUIDE.md`][manual].

## Configuration

Everything below is **optional** — the app runs without it.

### Environment variables

They must be set in `.env.local` (copy from `.env.example`) before `npm run dev`.

- `NEXT_PUBLIC_SUPABASE_URL`
  - Optional cloud backend: when set, the catalogue is read from Supabase
    (with automatic fallback to the built-in catalogue above) and the login
    page becomes functional. Saved designs live in the browser either way.
  - Get it free at [supabase.com/dashboard](https://supabase.com/dashboard) →
    New project → Project Settings → API.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Same as above (the public anon key, safe to expose in the browser).
- `GEMINI_API_KEY` *(server-side only, AI tag generation)*
  - Powers `POST /api/tags` (style brief → taxonomy tags, used by the 3D AI
    match) and `POST /api/recommend` (bundle choice + planner auto-place).
  - Get it free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
  - **Without it nothing breaks:** a deterministic keyword mapper produces
    the tags and auto-place, bundling and budgeting all still work — the AI
    just no longer reads between the lines. Set it as an environment variable
    on Vercel too, or the live demo runs in keyword mode.
- `GEMINI_MODEL` *(optional override)*
  - Defaults to `gemini-3.6-flash`. Keep any override on a current
    Flash-tier model — `gemini-2.0-flash` / `2.5` have been retired by
    Google (the app then silently falls back to keywords, which is by design).

### Data note for reviewers

Unverified fields render as **Unknown** and are never invented (project rule).
A small number of prototype rows (SKUs prefixed `SCAN-`, plus `K-77795`) carry
placeholder prices marked `dummy: unverified` in `src/lib/products.ts` with
`verified_at` left blank, so budgeting and auto-place can be demonstrated
end-to-end. Replace them from studiokohler.com verification via
`supabase/seed/products_seed.csv` → `node tools/import_products.mjs` → run the
regenerated `products_seed.sql` (upsert-only, safe to re-run).

### Project map

| Path                          | Description                                              |
| ----------------------------- | -------------------------------------------------------- |
| `src/app/`                    | Routes: landing, catalog, design/new, planner, design/3d, budget, saved, login · API: `/api/tags`, `/api/recommend` |
| `src/components/`             | Nav, Footer                                              |
| `src/lib/`                    | `tags.ts` (18-tag taxonomy + keyword fallback), `autoLayout.ts` (deterministic placement), `variants.ts` (budget matcher), `products.ts` (catalogue), `budget.ts`, `models.ts`, `designs.ts` (localStorage), `supabase.ts` |
| `supabase/migrations/`        | SQL schema for the optional Supabase backend             |
| `supabase/seed/`              | `products_seed.csv` — catalog source of truth (+ placeholder prices, see Data note) |
| `assets/models/` `public/models/` | Product scans (GLB) + per-category catalogue JSON    |
| `docs/`                       | `MANUAL_GUIDE.md`, `AI_IMPLEMENTATION.md`, `PROMPTS_DOCUMENTATION.pdf` (+ HTML source), `PITCH_DECK.html`, `PRESENTATION.html` |
| `design.md` / `plan.txt`      | Visual system + full project plan and data rules         |

### Troubleshooting

| Symptom                        | Fix                                                      |
| ------------------------------ | -------------------------------------------------------- |
| `EBADENGINE` on `npm install`  | Install Node 20+ from https://nodejs.org/en/download     |
| Port 3000 in use               | `npx kill-port 3000`, or `npm run dev -- -p 3001`        |
| Login does nothing             | Expected without Supabase keys — see [Configuration](#configuration) |
| `npm run build` type errors    | Run `npm run lint`, fix the reported files               |

If anything else breaks, open an issue with: OS + `node --version` output + the
exact error text + the step above that failed.

## Submission artefacts

- **Working model:** this repo + live at https://track-1-kohler.vercel.app
- **Presentation deck:** `docs/PITCH_DECK.html` (landscape PDF after review)
- **Prompts documentation:** `docs/PROMPTS_DOCUMENTATION.pdf` (source: `docs/prompts-documentation.html`) — all AI prompts, system instructions and workflows; engineering detail in `docs/AI_IMPLEMENTATION.md` (+ `docs/MANUAL_GUIDE.md`)
- **Video walkthrough:** Drive link to be added before sending

[ai-impl]: ./docs/AI_IMPLEMENTATION.md
[demo]: https://track-1-kohler.vercel.app
[demo-badge]: https://img.shields.io/badge/demo-live-brightgreen?logo=vercel&logoColor=white&style=flat-square
[git]: https://git-scm.com/downloads
[homebrew]: https://brew.sh/
[manual]: ./docs/MANUAL_GUIDE.md
[next]: https://nextjs.org/
[next-badge]: https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white&style=flat-square
[node.js]: https://nodejs.org/en/download
[supabase]: https://supabase.com/
[supabase-badge]: https://img.shields.io/badge/Supabase-optional-3fcf8e?logo=supabase&logoColor=white&style=flat-square
[winget]: https://learn.microsoft.com/en-us/windows/package-manager/winget/
