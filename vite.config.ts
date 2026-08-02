import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Emits to the repo root `docs/` so GitHub Pages can serve this directly
// (Settings -> Pages -> Deploy from a branch -> /docs). Same layout as
// hfu/faceless-cartographer (DECISIONS.md D21/D27), lineage note in this
// repo's own DECISIONS.md D1.
export default defineConfig({
  // Relative asset paths -- GitHub project pages serve from
  // https://<user>.github.io/<repo>/, not the domain root.
  base: './',
  publicDir: 'public',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'docs',
    emptyOutDir: true
  }
});
