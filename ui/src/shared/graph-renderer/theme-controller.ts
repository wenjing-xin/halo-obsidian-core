import { OBSIDIAN_LIGHT_THEME, OBSIDIAN_THEME, type ObsidianTheme } from './obsidian-theme'
export { normalizeTheme, resolveDark, systemPrefersDark, type ThemeMode } from '../theme-controller'
export { observeTheme as observeGraphTheme } from '../theme-controller'

export function readGraphTheme(host: HTMLElement, dark: boolean): ObsidianTheme {
  const theme = { ...(dark ? OBSIDIAN_THEME : OBSIDIAN_LIGHT_THEME) }
  const style = getComputedStyle(host)
  const colors = {
    background: '--obsidian-graph-bg',
    node: '--obsidian-graph-node',
    edge: '--obsidian-graph-edge',
    edgeTaxonomy: '--obsidian-graph-taxonomy-edge',
    label: '--obsidian-graph-text',
    focusLabel: '--obsidian-graph-focus-text',
    focusNode: '--obsidian-graph-accent',
    highlightRing: '--obsidian-graph-accent',
    brokenColor: '--obsidian-graph-broken',
  } as const
  for (const [key, variable] of Object.entries(colors)) {
    const value = style.getPropertyValue(variable).trim()
    if (value) theme[key as keyof typeof colors] = value
  }
  return theme
}
