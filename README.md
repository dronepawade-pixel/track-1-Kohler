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
No accounts, API keys or database setup needed — the app runs with a built-in catalog.

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
/design/new   # 1. describe the bathroom: L×W×H, doors/windows, budget ₹, style
/planner      # 2. arrange fixtures on the 2D canvas: drag, rotate, snap, undo
/budget       # 3. check line items vs budget (recalculates on replace/remove)
/catalog      # 4. browse the filterable product grid + detail pages
/saved        # 5. saved designs + versions (needs login → see Configuration)
/login        # 6. email magic-link sign-in (needs Supabase keys → see Configuration)
```

Read more about the method in [`docs/AI_IMPLEMENTATION.md`][ai-impl] and the
data pipeline in [`docs/MANUAL_GUIDE.md`][manual].

## Configuration

Everything below is **optional** — the app runs without it.

### Environment variables

They must be set in `.env.local` (copy from `.env.example`) before `npm run dev`.

- `NEXT_PUBLIC_SUPABASE_URL`
  - Enables login (`/login`) and saved designs (`/saved`).
  - Get it free at [supabase.com/dashboard](https://supabase.com/dashboard) →
    New project → Project Settings → API.
  - Without it, those two pages show a friendly "keys not set" notice; everything
    else works.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Same as above (the public anon key, safe to expose in the browser).
- `GEMINI_API_KEY` *(server-side only, AI recommendations)*
  - Powers `POST /api/recommend` (bundle + layout generation).
  - Get it free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
  - Without it, the planner and catalog still work fully; only AI generation is
    disabled.

### Project map

| Path                          | Description                                              |
| ----------------------------- | -------------------------------------------------------- |
| `src/app/`                    | Routes: landing, catalog, design/new, planner, budget, saved, login |
| `src/components/`             | Nav, Footer                                              |
| `src/lib/`                    | `products.ts` (catalog types), `supabase.ts` (client)    |
| `supabase/migrations/`        | SQL schema for the optional Supabase backend             |
| `supabase/seed/`              | `products_seed.csv` — real catalog data lives here       |
| `docs/`                       | `MANUAL_GUIDE.md`, `AI_IMPLEMENTATION.md`, `PITCH_DECK.html` |
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
- **Prompts documentation:** `docs/PROMPTS_DOCUMENTATION.pdf` (14 pages, source: `docs/prompts-documentation.html`) — every feature told through the prompts that built it, plus guardrail matrix and prompt-craft conventions; engineering detail in `docs/AI_IMPLEMENTATION.md` (+ `docs/MANUAL_GUIDE.md`)
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
