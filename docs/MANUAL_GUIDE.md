# KOHLER AI Bathroom Designer — Manual Guide (for you)

> Everything YOU do by hand: download → convert → CSV → upload.
> The coding AI does everything else (see `AI_IMPLEMENTATION.md`).
> Stack: Next.js + Supabase. Data rule: never invent SKUs, prices, dims. Unknown = blank.

---

## 0. What you will end up with

```
downloads/
  K-5401/
    spec.pdf        <- source of truth for price + dims
    model.obj       <- 3D source
    plan.dwg        <- CAD source (top view)
    hero.jpg        <- product photo
supabase/seed/products_seed.csv   <- you fill this (1 row per SKU)
Storage (Supabase):
  models/K-5401.glb   <- converted, served to 3D viewer
  images/K-5401-hero.jpg
  cad/K-5401-plan.dwg <- download link only
```

Aim for v1: **20–30 SKUs** (4–5 per category). More than that slows judging demo, not improves it.

Categories (must match exactly):
`Showers | Bathtubs | Basins | Smart Toilets | Faucets | Mirrors | Vanities`

---

## 1. Where to download from

### A. Studio Kohler (primary, official)
1. Create free account: https://www.studiokohler.com/home → Sign up (Designer/Developer).
2. Set Project Location to **India** (prices/availability are region-specific).
3. Go to Resources → Technical Specifications (https://www.studiokohler.com/resources/technical-specifications).
4. Search exact model no., e.g. `K-5401`, `K-1234`.
5. Tick and download per product:
   - [ ] Specification sheet (PDF) — REQUIRED
   - [ ] 2D Plan DXF/DWG — REQUIRED (footprint)
   - [ ] 3D file (OBJ / FBX / SKP) — REQUIRED for 3D viewer
   - [ ] Revit (optional, skip for prototype)
   - [ ] Images (hero PNG/JPG)
6. Save as `downloads/K-XXXX/spec.pdf`, `plan.dwg`, `model.obj`, `hero.jpg`.

### B. Fallbacks (if Studio download fails)
- BIMobject: https://www.bimobject.com/en/kohler → search K-number → Download (gives Revit + 3D + images).
- Direct OBJ mirror: `https://techcomm.kohler.com/techcomm/cad/<MODEL>-fp1.obj` (e.g. `75749-fp1.obj`). Try in browser; if 200, save as `model.obj`.
- kohler.com product page → Specs tab → screenshot dims as last resort (still cite URL in CSV).

### C. What NOT to download
- Do NOT bulk-scrape kohler.com (fragile, ToS risk, breaks demo if layout changes).
- Do NOT wait for `api-dev-portal.kohler.com` approval — partner-gated, takes weeks.

---

## 2. Convert OBJ → GLB (where and how)

Browsers + Three.js cannot use OBJ well (huge, no materials). Convert **once per SKU** to `.glb` (<5 MB).

### Option 1 — Blender (free, best quality, Mac/Windows)
1. Install Blender (blender.org) → New → delete default cube.
2. File → Import → Wavefront OBJ → select `downloads/K-XXXX/model.obj`.
3. Fix scale: Properties → Scene → Units = Metric, Millimeter. Select model → S to scale until dims match spec PDF (e.g. basin 550 mm wide).
4. Apply: Ctrl+A → All Transforms. Center: Object → Set Origin → Origin to Geometry.
5. File → Export → glTF 2.0 (`.glb`): check `Apply Modifiers`, `Draco compression`, `Limit to Selected`.
6. Save as `downloads/K-XXXX/model.glb`. Verify size < 5 MB (else Decimate modifier 0.5 and re-export).

### Option 2 — CLI, fastest for 20+ files (Mac/Linux/WSL)
```bash
npm i -g obj2gltf
obj2gltf -i downloads/K-5401/model.obj -o downloads/K-5401/model.glb --draco --checkTransparency
ls -lh downloads/K-*/model.glb
```
If >5 MB, add `--compress` or run through Blender Decimate once.

### Option 3 — Online (only if <5 files)
AnyConv / Aspose 3D converter: upload OBJ → download GLB. Don't use for full catalog (slow, version drift).

Preview check: drag `model.glb` into https://gltf-viewer.donmccurdy.com — must render right-side-up, roughly correct proportions. If black/no texture, still OK for prototype (geometry matters, materials later).

---

## 3. Handle DWG (do NOT serve DWG live)

Browsers cannot render DWG. You only extract 2 numbers + 1 symbol:

1. Open `plan.dwg` in ODA File Converter (free, Autodesk-free) / AutoCAD / DWG TrueView.
2. Read top-view bounding box: **Width_mm × Depth_mm** (e.g. toilet 700 × 580).
3. Export top view → SVG (or screenshot → trace 1 rect/ellipse in 30 sec). Keep it schematic — the 2D planner draws boxes, not CAD hatching.
4. Keep original DWG only as "Download CAD" link (upload to `cad/` bucket later).

Example minimal `footprint_svg` (rect 70×58 for 700×580 mm, 1 unit = 10 mm):
```svg
<svg width="70" height="58" viewBox="0 0 70 58"><rect x="2" y="2" width="66" height="54" rx="18" /></svg>
```

---

## 4. CSV format — the only file the AI reads

Template: `supabase/seed/products_seed.csv`. Header (do not rename, do not reorder):

```csv
sku,name,category,collection,finish,price_inr,width_mm,depth_mm,height_mm,style_tags,official_url,image_urls,model_glb_url,footprint_svg,dwg_url,source,verified_at
```

| Column | Where to get it | Rules |
|---|---|---|
| `sku` | Studio model no. (K-XXXX) | Exact. Never `PENDING-*` for real rows. |
| `name` | Spec PDF title | e.g. `Veil Wall-Hung Smart Toilet` |
| `category` | One of 7 listed above | Exact spelling |
| `collection` | Product page header | e.g. `Veil`, `Composed`. Unknown → `Unknown` |
| `finish` | Spec PDF finishes | e.g. `White`, `Matte Black`. Unknown → `Unknown` |
| `price_inr` | Spec sheet / kohler.com India price | Integer only, no commas/symbols. Unknown → **blank** (not 0) |
| `width_mm,depth_mm,height_mm` | Dimension diagram page in spec PDF (takes priority over DWG header) | Integers in mm. Unknown → blank |
| `style_tags` | YOU tag per row | Pipe list from: `minimalist\|modern\|classic\|luxury\|zen`. E.g. `minimalist\|zen`. Max 3 |
| `official_url` | Canonical studiokohler/ kohler.com URL | Full https URL |
| `image_urls` | After upload | `images/K-XXXX-hero.jpg` (comma-separate if 2+) |
| `model_glb_url` | After upload | `models/K-XXXX.glb`. Blank if 3D missing (2D still works) |
| `footprint_svg` | Step 3 above | Full `<svg...>` inline, keep <500 chars. Use double `""` escaping inside CSV |
| `dwg_url` | After upload | `cad/K-XXXX-plan.dwg` or blank |
| `source` | Fixed | `studiokohler.com` (or `bimobject`, `kohler.com`) |
| `verified_at` | Today | `YYYY-MM-DD` |

Style cheat-sheet: `Minimalist Modern → minimalist|modern + White/Matte Black`; `Classic Luxury → classic|luxury + Polished Chrome/Gold`; `Japanese Zen → zen|minimalist + White/Wood tones`.

Full example rows are already in `supabase/seed/products_seed.csv` (2 complete + 1 Unknown demo). Copy-paste them.

---

## 5. Upload + validate (15 min)

1. Supabase Dashboard → Storage → create buckets `models`, `images`, `cad` (Public read).
2. Upload: `downloads/K-*/model.glb → models/`, `hero.jpg → images/`, `plan.dwg → cad/`.
3. Fill `model_glb_url, image_urls, dwg_url` columns with those paths.
4. Validate CSV before handing to AI:
   - [ ] Opens in Excel/Sheets, 17 columns every row
   - [ ] `sku` unique, no spaces
   - [ ] `price_inr,width_mm...` are digits or blank (no `₹`, no commas)
   - [ ] `footprint_svg` starts with `<svg` (or blank)
   - [ ] At least 1 row per category, at least 1 style tag per row

Hand `products_seed.csv` to the coding AI next. It will migrate the DB, import rows, and wire `/api/recommend` → 2D planner → 3D viewer.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Studio search "No results" | Search bare number (`5401` not `K-5401`), or switch Project Location US→IN |
| GLB >10 MB | Blender Decimate 0.5 → re-export with Draco; hero demo doesn't need 4K meshes |
| GLB renders black | OK for v1. Materials are Phase 2; geometry + footprint unblock layout |
| DWG won't open | Use ODA File Converter → DXF → open. Dims can come from spec PDF alone |
| No India price | Leave `price_inr` blank (shows "Unknown" per design rule). Never convert USD→INR yourself |
