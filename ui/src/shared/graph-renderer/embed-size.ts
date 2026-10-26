export const GRAPH_MIN_WIDTH = 320
export const GRAPH_MIN_HEIGHT = 300
export const GRAPH_MAX_HEIGHT = 1200
export const GRAPH_DEFAULT_HEIGHT = 420
export const GRAPH_DEFAULT_WIDTH = 100

export type GraphAlignment = 'left' | 'center' | 'right'
export type GraphResizeHandle = 'left' | 'right' | 'bottom' | 'corner'

function finiteNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function normalizeGraphHeight(value: unknown): number {
  return Math.round(
    Math.min(
      GRAPH_MAX_HEIGHT,
      Math.max(GRAPH_MIN_HEIGHT, finiteNumber(value, GRAPH_DEFAULT_HEIGHT)),
    ),
  )
}

export function minimumGraphWidthPercent(containerWidth?: number): number {
  if (!containerWidth || containerWidth <= 0 || !Number.isFinite(containerWidth)) return 20
  return Math.min(100, Math.max(20, Math.ceil((GRAPH_MIN_WIDTH / containerWidth) * 100)))
}

export function normalizeGraphWidth(value: unknown, containerWidth?: number): number {
  return Math.round(
    Math.min(
      100,
      Math.max(minimumGraphWidthPercent(containerWidth), finiteNumber(value, GRAPH_DEFAULT_WIDTH)),
    ),
  )
}

export function normalizeGraphAlignment(value: unknown): GraphAlignment {
  return value === 'left' || value === 'right' ? value : 'center'
}

/** The pixel minimum yields to narrow mobile containers rather than overflowing. */
export function graphEmbedStyle(width: unknown, height: unknown, alignment: unknown): string {
  const align = normalizeGraphAlignment(alignment)
  return (
    `display:block;box-sizing:border-box;width:${normalizeGraphWidth(width)}%;` +
    `min-width:min(${GRAPH_MIN_WIDTH}px,100%);max-width:100%;` +
    `height:${normalizeGraphHeight(height)}px;min-height:${GRAPH_MIN_HEIGHT}px;` +
    `margin-left:${align === 'left' ? '0' : 'auto'};margin-right:${align === 'right' ? '0' : 'auto'}`
  )
}

export interface GraphResizeOrigin {
  handle: GraphResizeHandle
  align: GraphAlignment
  x: number
  y: number
  width: number
  height: number
  containerWidth: number
}

export function resizedGraphDimensions(origin: GraphResizeOrigin, x: number, y: number) {
  const deltaX = x - origin.x
  // A centered element moves both edges; a right-aligned element grows from its left edge.
  const fromLeft =
    origin.handle === 'left' || (origin.handle === 'corner' && origin.align === 'right')
  const multiplier = (origin.align === 'center' ? 2 : 1) * (fromLeft ? -1 : 1)
  const width = origin.handle === 'bottom' ? origin.width : origin.width + deltaX * multiplier
  const height =
    origin.handle === 'left' || origin.handle === 'right'
      ? origin.height
      : origin.height + y - origin.y
  return {
    width: normalizeGraphWidth(
      (width / Math.max(origin.containerWidth, 1)) * 100,
      origin.containerWidth,
    ),
    height: normalizeGraphHeight(height),
  }
}
