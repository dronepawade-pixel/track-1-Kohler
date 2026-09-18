/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin Turbopack root to this repo: a stray /Users/devraj/package.json
  // (CommonJS, no "type" field) otherwise poisons module-format detection
  // for every file under $HOME and breaks `npm run build`.
  turbopack: { root: new URL(".", import.meta.url).pathname },
};
export default nextConfig;
