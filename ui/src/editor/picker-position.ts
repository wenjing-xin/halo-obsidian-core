export interface InsertionAnchor {
  left: number
  top: number
  bottom: number
}

/** Use viewport coordinates so the floating picker follows a scrolled editor. */
export function pickerPosition(anchor: InsertionAnchor, width: number, height: number,
  viewportWidth: number, viewportHeight: number) {
  const margin = 12
  const gap = 8
  const below = viewportHeight - anchor.bottom - gap - margin
  const above = anchor.top - gap - margin
  const maxHeight = Math.max(100, Math.max(below, above))
  const actualHeight = Math.min(height, maxHeight)
  const top = below >= actualHeight || below >= above
    ? anchor.bottom + gap : anchor.top - actualHeight - gap
  return {
    left: Math.max(margin, Math.min(anchor.left, viewportWidth - width - margin)),
    top: Math.max(margin, Math.min(top, viewportHeight - actualHeight - margin)),
    maxHeight: Math.min(maxHeight, viewportHeight - margin * 2),
  }
}

export function currentPostName(url: string): string | undefined {
  const location = new URL(url)
  // Halo Console PostEditor stores the article name in the `name` query parameter.
  if (!/\/(?:console|uc)\/posts\/editor\/?$/.test(location.pathname)) return undefined
  return location.searchParams.get('name') || undefined
}
