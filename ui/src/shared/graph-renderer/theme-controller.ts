import { OBSIDIAN_LIGHT_THEME, OBSIDIAN_THEME, type ObsidianTheme } from './obsidian-theme'

export type ThemeMode = 'auto' | 'light' | 'dark'

export function normalizeTheme(theme?: unknown, legacyDark?: unknown): ThemeMode {
  if (theme === 'auto' || theme === 'light' || theme === 'dark') return theme
  if (legacyDark === false || legacyDark === 'false') return 'light'
  if (legacyDark === true || legacyDark === 'true' || legacyDark === '') return 'dark'
  return 'auto'
}

function ancestors(host: Element): Element[] {
  const result: Element[] = []
  for (let element: Element | null = host; element;) {
    result.push(element)
    const root = element.getRootNode()
    element = element.parentElement || (root instanceof ShadowRoot ? root.host : null)
  }
  return result
}

export function resolveDark(host: HTMLElement, mode: ThemeMode, systemDark: boolean): boolean {
  if (mode !== 'auto') return mode === 'dark'
  for (const element of ancestors(host)) {
    const scheme = element.getAttribute('data-color-scheme') || element.getAttribute('data-theme')
    if (
      scheme === 'dark' ||
      element.classList.contains('dark') ||
      element.classList.contains('color-scheme-dark') ||
      element.classList.contains('theme-dark')
    )
      return true
    if (
      scheme === 'light' ||
      element.classList.contains('light') ||
      element.classList.contains('color-scheme-light') ||
      element.classList.contains('theme-light')
    )
      return false
    if (scheme === 'auto' || element.classList.contains('color-scheme-auto')) return systemDark
  }
  const schemes = getComputedStyle(host).colorScheme.split(/\s+/)
  if (schemes.includes('dark') || schemes.includes('light')) {
    return schemes.includes('dark') && (!schemes.includes('light') || systemDark)
  }
  return systemDark
}

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

/** Mirrors comment-widget ancestor observation, including hosts across shadow roots. */
export function observeGraphTheme(host: HTMLElement, onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  for (const element of ancestors(host)) {
    observer.observe(element, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme', 'theme', 'dark'],
    })
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onChange)
  onChange()
  return () => {
    observer.disconnect()
    media.removeEventListener('change', onChange)
  }
}
