import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
    },
  ],
  output: {
    autoExternal: false,
    target: 'web',
    minify: true,
    cleanDistPath: true,
    filename: {
      css: 'index.css',
      js: 'obsidian-graph.js',
    },
    distPath: {
      root: fileURLToPath(
        new URL('../../src/main/resources/static/obsidian-graph', import.meta.url)
      ),
    },
  },
});
