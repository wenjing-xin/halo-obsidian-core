/**
 * Obsidian-style visual specification for the relationship graph renderer.
 * The light theme mirrors the graph embedded on obsidian.md: a white canvas,
 * small dark dots, translucent purple edges and muted micro labels; the dark
 * theme mirrors the in-app Obsidian graph view.
 */

export interface ObsidianTheme {
  background: string
  node: string
  focusNode: string
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
  focusNode: '#a882ff',
  nodeHaloOpacity: 0.22,
  edge: '#8a8a8a',
  edgeTaxonomy: '#5f5f66',
  edgeOpacity: 0.4,
  edgeTaxonomyOpacity: 0.22,
  label: '#d4d4d4',
  labelHalo: 'rgba(30, 30, 30, 0.85)',
  dimmedOpacity: 0.16,
  highlightRing: '#a882ff',
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
 * Light theme matching the graph on obsidian.md: white background, dark dots,
 * translucent purple wikilink edges, light gray taxonomy edges, micro labels.
 */
export const OBSIDIAN_LIGHT_THEME: ObsidianTheme = {
  ...OBSIDIAN_THEME,
  background: '#ffffff',
  node: '#4c4d53',
  focusNode: '#7c3aed',
  nodeHaloOpacity: 0.08,
  edge: 'rgba(139, 118, 196, 0.4)',
  edgeTaxonomy: 'rgba(176, 176, 188, 0.28)',
  edgeOpacity: 1,
  edgeTaxonomyOpacity: 1,
  label: '#8e8e96',
  labelHalo: 'rgba(255, 255, 255, 0.85)',
  dimmedOpacity: 0.18,
  highlightRing: '#7c3aed',
  brokenColor: '#c06363',
}
