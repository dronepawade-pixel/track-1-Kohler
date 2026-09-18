// Render product thumbnails from GLBs via headless Chrome + local three.js.
// Run: python3 -m http.server 8765 (repo root, background) then:
//   node tools/render_thumbs.cjs
// Output: public/images/products/<id>.jpg (480x360, dark #111 backdrop).
const { chromium } = require("/opt/homebrew/lib/node_modules/playwright");

const MODELS = [
  ["tub-21000", "21000-P5-plain.glb", "ceramic"],
  ["toilet-smart-30754", "30754-PA-plain.glb", "ceramic"],
  ["toilet-75790", "75790-plain.glb", "ceramic"],
  ["head-22170", "22170-plain.glb", "chrome"],
  ["trim-13696", "13696-G-plain.glb", "chrome"],
  ["door-707002", "707002-D3-plain.glb", "dark"],
  ["panel-706008", "706008-L-plain.glb", "dark"],
];

(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 480, height: 360 } });
  for (const [id, file, mat] of MODELS) {
    await page.goto(
      `http://localhost:8765/tools/thumb.html?m=${file}&mat=${mat}`
    );
    await page.waitForFunction(() => document.title === "ready", null, {
      timeout: 30000,
    });
    await page.locator("canvas").screenshot({
      path: `public/images/products/${id}.jpg`,
      quality: 85,
      type: "jpeg",
    });
    console.log("thumb:", id);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
