/**
 * Obsidian-style visual specification for the relationship graph renderer.
 * The light theme mirrors the graph embedded on obsidian.md: a white canvas,
 * small dark dots, subtle neutral edges and muted micro labels; the dark
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
  focusLabel: string
  dimmedLabelOpacity: number
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
  focusLabel: '#ededed',
  dimmedLabelOpacity: 0.28,
  labelHalo: 'rgba(30, 30, 30, 0.85)',
  dimmedOpacity: 0.18,
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
 * subtle gray wikilink edges, light gray taxonomy edges, micro labels.
 */
export const OBSIDIAN_LIGHT_THEME: ObsidianTheme = {
  ...OBSIDIAN_THEME,
  background: '#ffffff',
  node: '#5c5c5c',
  focusNode: '#9164f5',
  nodeHaloOpacity: 0.08,
  edge: '#b8b8bc',
  edgeTaxonomy: '#b8b8bc',
  edgeOpacity: 0.45,
  edgeTaxonomyOpacity: 0.25,
  label: '#8e8e96',
  focusLabel: '#303030',
  dimmedLabelOpacity: 0.28,
  labelHalo: 'rgba(255, 255, 255, 0.85)',
  dimmedOpacity: 0.18,
  highlightRing: '#9164f5',
  brokenColor: '#c06363',
}
