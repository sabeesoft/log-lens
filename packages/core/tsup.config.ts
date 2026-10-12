import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Bundle csv-parse (its browser ESM build) into both outputs so the core is
  // self-contained and browser-safe — consumers never touch a Node-only path.
  noExternal: ['csv-parse'],
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});
