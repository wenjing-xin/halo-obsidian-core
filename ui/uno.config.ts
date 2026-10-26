import { defineConfig, presetWind3 } from 'unocss'

// The plugin UI renders inside Halo Console pages, which already ship a global
// CSS reset, so no extra preflight/reset is imported here.
export default defineConfig({
  presets: [presetWind3()],
})
