/**
 * Obsidian-style visual specification for the knowledge graph renderer.
 * Values are tuned to mimic Obsidian's graph view: dark canvas, soft node glow,
 * thin translucent edges and a muted label style.
 */

export interface ObsidianTheme {
  background: string
  node: string
  nodeHaloOpacity: number
  edge: string
  edgeTaxonomy: string
  edgeOpacity: number
  edgeTaxonomyOpacity: number
  label: string
  labelHalo: string
  dimmedOpacity: number
  highlightRing: string
  brokenColor: string
  fontFamily: string
  fontSize: number
}

export const OBSIDIAN_THEME: ObsidianTheme = {
  background: '#1e1e1e',
  node: '#a6a6a6',
  nodeHaloOpacity: 0.22,
  edge: '#8a8a8a',
  edgeTaxonomy: '#5f5f66',
  edgeOpacity: 0.5,
  edgeTaxonomyOpacity: 0.28,
  label: '#d4d4d4',
  labelHalo: 'rgba(30, 30, 30, 0.85)',
  dimmedOpacity: 0.1,
  highlightRing: '#ffffff',
  brokenColor: '#8a8a94',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  fontSize: 10,
}

export const FALLBACK_PALETTE = [
  '#a882ff',
  '#7cb8ff',
  '#69d2a8',
  '#ffc46b',
  '#ff8f8f',
  '#6bd6e0',
  '#e0a3ff',
  '#b5d76b',
]

/**
 * Light-mode variant exposed to themes via CSS-variable overrides.
 */
export const OBSIDIAN_LIGHT_THEME: ObsidianTheme = {
  ...OBSIDIAN_THEME,
  background: '#f2f3f5',
  node: '#6b6b6b',
  edge: '#9a9aa2',
  edgeTaxonomy: '#b3b3bb',
  label: '#3a3a3f',
  labelHalo: 'rgba(242, 243, 245, 0.85)',
  highlightRing: '#1a1a1e',
}
