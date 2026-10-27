import type { NodeDisplayData } from 'sigma/types'

interface LabelHost {
  getDimensions(): { width: number; height: number }
  getNodeDisplayData(key: string): NodeDisplayData | undefined
  framedGraphToViewport(point: { x: number; y: number }): { x: number; y: number }
  scaleSize(size: number): number
  scheduleRender(): unknown
}

const FONT_SIZE = 11
const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
const CELL_SIZE = 90

/** Browser-shaped text avoids Sigma 4's single-page SDF atlas limit for CJK titles. */
export class NodeLabelLayer {
  private canvas = document.createElement('canvas')
  private context: CanvasRenderingContext2D | null
  private widths = new Map<string, number>()

  constructor(
    private host: LabelHost,
    container: HTMLElement,
    private titleForNode: (key: string) => string | null | undefined,
  ) {
    this.canvas.className = 'obsidian-graph-labels'
    this.canvas.setAttribute('aria-hidden', 'true')
    Object.assign(this.canvas.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      display: 'block',
      margin: '0',
      pointerEvents: 'none',
    })
    this.context = this.canvas.getContext('2d')
    container.append(this.canvas)
    document.fonts?.addEventListener('loadingdone', this.onFontsLoaded)
  }

  clearMeasurements(): void {
    this.widths.clear()
  }

  private onFontsLoaded = (): void => {
    this.clearMeasurements()
    this.host.scheduleRender()
  }

  draw(keys: Iterable<string>): void {
    const ctx = this.context
    if (!ctx) return
    const { width, height } = this.host.getDimensions()
    const ratio = window.devicePixelRatio || 1
    const pixelWidth = Math.max(0, Math.round(width * ratio))
    const pixelHeight = Math.max(0, Math.round(height * ratio))
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth
      this.canvas.height = pixelHeight
      this.canvas.style.width = `${width}px`
      this.canvas.style.height = `${height}px`
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, width, height)
    if (!width || !height) return
    ctx.font = `normal ${FONT_SIZE}px ${FONT_FAMILY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const labels: { key: string; text: string; data: NodeDisplayData }[] = []
    for (const key of keys) {
      const data = this.host.getNodeDisplayData(key)
      const text = this.titleForNode(key)
      if (text && data && data.visibility !== 'hidden' && data.labelVisibility !== 'hidden') {
        labels.push({ key, text, data })
      }
    }
    labels.sort((a, b) => {
      const priority =
        Number(b.data.labelVisibility === 'visible') - Number(a.data.labelVisibility === 'visible')
      return priority || b.data.size - a.data.size || a.key.localeCompare(b.key)
    })

    const occupied = new Set<string>()
    for (const { data, text } of labels) {
      const radius = this.host.scaleSize(data.size)
      const forced = data.labelVisibility === 'visible'
      if (!forced && radius < 2) continue
      // Display coordinates are already normalized; graphToViewport would normalize twice.
      const { x, y: nodeY } = this.host.framedGraphToViewport(data)
      const y = nodeY + radius + 4
      let textWidth = this.widths.get(text)
      if (textWidth === undefined) {
        textWidth = ctx.measureText(text).width
        this.widths.set(text, textWidth)
      }
      const left = x - textWidth / 2
      const right = x + textWidth / 2
      if (right < 0 || left > width || y > height || y + FONT_SIZE < 0) continue
      const cells: string[] = []
      for (
        let col = Math.floor(Math.max(0, left) / CELL_SIZE);
        col <= Math.floor(Math.min(width, right) / CELL_SIZE);
        col++
      ) {
        for (
          let row = Math.floor(Math.max(0, y) / (FONT_SIZE + 6));
          row <= Math.floor(Math.min(height, y + FONT_SIZE + 4) / (FONT_SIZE + 6));
          row++
        ) {
          cells.push(`${col}:${row}`)
        }
      }
      if (!forced && cells.some((cell) => occupied.has(cell))) continue
      cells.forEach((cell) => occupied.add(cell))
      ctx.fillStyle = data.labelColor
      ctx.fillText(text, x, y)
    }
  }

  destroy(): void {
    document.fonts?.removeEventListener('loadingdone', this.onFontsLoaded)
    this.widths.clear()
    this.canvas.remove()
  }
}
