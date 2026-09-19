# KOHLER AI Bathroom Designer — Build Tracker

> UI first, AI last. Single source of truth for what's done / next.
> Design: `design.md` (spa-at-home-after-dark, void black `#000000`, lamp cream `#f5f5f0`, charcoal `#202020`, graphite `#333333`, smoke `#999999`).
> Plan: `plan.txt` (Next.js + TS + Tailwind + Supabase, real Studio Kohler data only, deterministic validation, controlled AI).

## Phase 1 — UI + Supabase shell (NOW, no AI)
- [x] 1. Scaffold Next.js 15 + TS + Tailwind v4 + shadcn-style tokens in `/Users/devraj/Desktop/KOHLER`
- [x] 2. Design tokens (`globals.css`): void/cream/charcoal/graphite/smoke, VisueltPro→Inter, Bradford→Canela serif italic accent, pill 9999px, card 10px, frosted badge, hero scrim
- [x] 3. App shell: top nav (KOHLER wordmark, Bathroom/Kitchen/Inspiration/Care, cream pill CTA), footer ("The bold look, made.")
- [x] 4. Landing `/`: full-viewport hero (headline + italic serif "bold", Watch-the-craft play button), marquee strip, Best Sellers grid, Showering/Toilet/Grooming cinematic cards, Wellness/Kitchen section
- [x] 5. Catalog `/catalog`: filterable grid (category/collection/finish), search, product card, product detail `/catalog/[sku]` (unknown fields shown as Unknown — never invented)
- [x] 6. Bathroom input `/design/new`: dimensions (L×W×H), doors/windows, budget, style, functional prefs, natural-language requirements
- [x] 7. 2D planner `/planner`: room canvas, walls/doors/windows/fixtures, drag/rotate/snap, measurements, undo/redo, clearance + constraint warnings (deterministic stub, no AI)
- [x] 8. Budget `/budget`: line items, total vs budget, recalculation on replace/remove (deterministic code)
- [x] 9. Saved designs `/saved`: grid of saved designs, versions, share placeholder (Supabase-backed)
- [x] 10. Auth `/login`: Supabase email auth UI (sign in/up/out, session display)
- [x] 11. Supabase: `supabase init` + migrations (profiles, products, design_projects, design_versions, design_items) + RLS + seed with UNKNOWN placeholders (no fake SKUs/prices)
- [x] 12. `npm run dev`, verify all routes render, screenshot landing for user review

## Phase 2 — Refine (AFTER user review of Phase 1)
- [ ] Polish per feedback, responsive, Motion transitions (0.2–0.3s, cubic-bezier(0.625,0.05,0,1)), empty/error states, Impeccable pass

## Phase 3 — Deterministic engines (no LLM)
- [ ] Constraint engine, compatibility checks, collision detection, budget calc tests

## Phase 4 — AI last
- [ ] Tool interface (searchProducts/getProduct/calculateBudget/validateLayout/…), chat, concept generation, Promptfoo evals, VibeSec review

## Assets waiting from user
- Kohler 3D models + imagery (Three.js viewer stays placeholder until then — 2D planner remains fully functional)

## Log
- 2026-09-16: Read design.md + plan.txt. Started Phase 1 scaffold.
- 2026-09-16: Phase 1 built — `npm run build` clean, all 8 routes 200 on :3000 (dev server running). Supabase migration `20260916000000_phase1_schema.sql` ready (profiles/products/design_projects/versions/items + RLS + placeholder seed). Browser screenshot unavailable (no browser window) — user to review visually at localhost:3000.
- 2026-09-16: Pushed to GitHub `origin/main` (commit 84641e8, rebased onto remote b5ebeda from other device).
- 2026-09-16: Moved `origin` to `Track1-Kohler-AI-Bathroom-Designer-and-Planner` (fresh repo) — `main` pushed, tracking set.
- 2026-09-16: Moved `origin` again to `track1-KOHLER-` (fresh repo) — `main` pushed, tracking set.
- 2026-09-16: Moved `origin` to `track-1-Kohler`. Found other device had pushed 605MB (node_modules + .next + .env.local, no .gitignore). Verified remote sources byte-identical to ours and .env.local had no real secrets → user-approved force-push of clean history. Remote now 28 files, 0 junk. Added `.env.example`.
- 2026-09-16: Restructured remote to KOHLER-root (no more `Desktop/KOHLER/` prefix) via `git subtree split`, force-pushed as `main`. KOHLER is now its own git repo; added root `.gitignore`. Other device must fresh-clone.
- 2026-09-16: Supabase local validated — remapped host ports to 6432x (cts-clone stack owns 5432x), `supabase start` applied migration `20260916000000_phase1_schema.sql` cleanly (policies + seed in DB log). Stack later torn down by environment contention; no cloud project yet — needs user's access token or dashboard-created project.
- 2026-09-16: Cloud project `kohler` live (ref dlwafvnthvpmioktjrlm, Mumbai ap-south-1, org dronepawade-pixel). Linked + `db push` applied. REST verified: 6 seeded products readable via anon RLS. Vercel keys handed to user; local .env.local still empty by design.
- 2026-09-18: 3D viewer openings rebuilt from real scans — `assets/models/` door (0.91×2.07 m) + window OBJs → Draco GLBs `public/models/door.glb` (9.2 KB) + `window.glb` (1.9 KB) via `tools/obj_to_draco_glb.py` (single-primitive writer; obj2gltf emits 2152 prims on 3ds Max files). Viewer (SVG dollhouse) now draws panelled leaf + architrave + cream lever, framed 2×2 window + cream sill/apron, wall caps, skirting, floor inlay — monochrome per design.md. Build fix: `"type": "module"` (repo had trailing `"type": "commonjs"` from other device) + `turbopack.root` pin (stray `/Users/devraj/package.json` poisoned format detection); `npm run build` green, all 11 routes. Verified via Playwright screenshots (cutaway on/off).
- 2026-09-18: three.js glossy viewer live — `three@0.186 + fiber@9.7 + drei@10.7.8` (`--legacy-peer-deps`: fiber caps React <19.3, repo has 19.3.0). New `room3d.tsx`: PBR clearcoat ceramic fixtures, chrome rain head, transmission shower glass, real door/window GLBs (plain 128/13 KB, no Draco decoder needed), Lightformer studio env (no network HDR), shadow-mapped warm key, orbit cutaway via clipping planes (front walls section at 1.1 m live while orbiting), HTML pill labels, same toolbar. SVG `scene.tsx` kept as no-WebGL fallback. Verified via screenshots; `npm run build` green. (Later same day: React 19.3.0→19.2.8 — fiber peer caps <19.3, Vercel strict install failed.)
- 2026-09-18: Model swap tray in 3D view — `src/lib/models.ts` catalogue (7 scans: tub/toilets/seat/heads/door/panel with real dims + fit rules), thumbnails auto-rendered from GLBs (`tools/thumb.html + render_thumbs.cjs`, user replacing with own photos), per-fixture tray under canvas (Procedural + scan thumbs), choices persist into saved designs (`SavedFixture.model` + save-back button). Verified: toilet→75790 swap renders the real two-piece in-scene.
- 2026-09-18: Gloss pass on swapped scans — ceramic clearcoat + envMapIntensity, polished-nickel (0.7 metal) instead of black mirror-metal for small chrome parts, all-around dim Lightformer cards so metals never sample black, per-fixture ContactShadows, exposure 1.15. Thumb pipeline gained RoomEnvironment (chrome thumbs were rendering black). Verified via swap screenshots.
- 2026-09-18: Fixed hydration crash on ?design= links (planner + 3D page read localStorage during render → server 2 fixtures vs client 4). Saved designs now load in an effect with identical first HTML; verified zero console errors on a seeded 4-fixture design. Ambience section in 3D view: pendant lamp with 6 swappable colors (warm/cool/teal/amber/rose/violet) + off, procedural decor group (plant, framed print, candles) with on/off — all procedural, no assets needed, session-only (not yet persisted to saves).
- 2026-09-19: AI concept pipeline (3D-only, strict budget, Gemini-normalized tags) — `src/lib/products.ts` extended (asset columns + STYLE_TAXONOMY + CATALOG_PRODUCTS joining 7 local GLB scans with seed-CSV rows), migration `20260919000003_catalog_assets.sql` (width/depth/height_mm, style_tags, model_glb_url, footprint_svg, dwg_url; category CHECK +Vanities), `supabase/seed/products_seed.csv` + 4 SCAN- rows, `tools/import_products.mjs` (CSV→SQL upserts, 8 rows clean), `src/lib/autoLayout.ts` (wall-anchored deterministic placer + px helpers), `POST /api/recommend` (Gemini tag normalizer w/ keyword fallback, Supabase-or-local catalog, strict budget/fit/style validation, 422 on miss), `/design/new` "Generate 3D concept" button → saved design → `/design/3d?design=`. `npm run lint` + `npm run build` green (12 routes incl. /api/recommend); live smoke test passed (bundle + strict-budget 422). NOT pushed — awaiting user verification.
- 2026-09-19: Added `zod` boundary validation to `/api/recommend` (RequestSchema → structured 400 issues; GeminiReplySchema → taxonomy-checked tags w/ keyword fallback; DbRowSchema → malformed Supabase rows dropped). Verified: 200 valid, 400 per-field issues, strict-budget path intact. Lint + build green. Still NOT pushed.
