import { defineConfig } from 'vite';

// Separate Vite config for the "open web" Style 3 prototype (DECISIONS.md
// D16). It can't share vite.config.ts's viteSingleFile() setup:
// vite-plugin-singlefile explicitly doesn't support multiple HTML entry
// points ("Issues opened requesting multiple entry points will be closed as
// wontfix", its own README) -- and this prototype doesn't need single-file
// inlining anyway, since it's served over HTTP (GitHub Pages), not opened as
// a local file. Emits a normal multi-file build into docs/openweb/, a
// subdirectory of the same docs/ tree vite.config.ts empties and rebuilds --
// package.json's "build" script runs the main build first so this one's
// emptyOutDir (scoped to docs/openweb only) doesn't collide with it.
export default defineConfig({
  root: 'openweb',
  base: './',
  build: {
    outDir: '../docs/openweb',
    emptyOutDir: true
  }
});
