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

/** Match the comment widget's color-scheme conventions, including shadow hosts. */
export function resolveDark(host: HTMLElement, mode: ThemeMode, systemDark: boolean): boolean {
  if (mode !== 'auto') return mode === 'dark'
  for (const element of ancestors(host)) {
    const scheme = element.getAttribute('data-color-scheme') || element.getAttribute('data-theme')
    // Explicit attributes win over a stale class left by a theme transition.
    if (scheme === 'dark' || scheme === 'light') return scheme === 'dark'
    if (scheme === 'auto') return systemDark
    if (
      ['dark', 'color-scheme-dark', 'theme-dark'].some((name) => element.classList.contains(name))
    )
      return true
    if (
      ['light', 'color-scheme-light', 'theme-light'].some((name) =>
        element.classList.contains(name),
      )
    )
      return false
    if (element.classList.contains('color-scheme-auto')) return systemDark
  }
  const schemes = getComputedStyle(host).colorScheme?.split(/\s+/) ?? []
  if (schemes.includes('dark') || schemes.includes('light')) {
    return schemes.includes('dark') && (!schemes.includes('light') || systemDark)
  }
  return systemDark
}

export function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

/** Subscribe once on connect, and release every observer/listener on disconnect. */
export function observeTheme(host: HTMLElement, onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  for (const element of ancestors(host)) {
    observer.observe(element, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme', 'theme', 'dark'],
    })
  }
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  media?.addEventListener('change', onChange)
  onChange()
  return () => {
    observer.disconnect()
    media?.removeEventListener('change', onChange)
  }
}
