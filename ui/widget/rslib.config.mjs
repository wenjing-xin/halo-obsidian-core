import { fileURLToPath } from 'node:url'
import { defineConfig } from '@rslib/core'

export default defineConfig({
  lib: [
    {
      format: 'esm',
      source: {
        entry: {
          'obsidian-graph': './src/index.ts',
        },
      },
    },
    {
      format: 'esm',
      source: {
        entry: {
          'obsidian-link': './src/link.ts',
        },
      },
    },
  ],
  output: {
    autoExternal: false,
    target: 'web',
    minify: true,
    cleanDistPath: true,
    filename: {
      css: 'index.css',
      js: '[name].js',
    },
    distPath: {
      root: fileURLToPath(
        new URL('../../src/main/resources/static/obsidian-graph', import.meta.url),
      ),
    },
  },
})
