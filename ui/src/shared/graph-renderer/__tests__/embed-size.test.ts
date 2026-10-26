import { expect, it } from 'vitest'
import {
  graphEmbedStyle,
  normalizeGraphHeight,
  normalizeGraphWidth,
  resizedGraphDimensions,
  type GraphResizeOrigin,
} from '../embed-size'
it('enforces readable minimum dimensions and rejects invalid values', () => {
  expect(normalizeGraphHeight(1)).toBe(300)
  expect(normalizeGraphHeight(5000)).toBe(1200)
  expect(normalizeGraphHeight('invalid')).toBe(420)
  expect(normalizeGraphHeight(Infinity)).toBe(420)
  expect(normalizeGraphWidth(1, 800)).toBe(40)
  expect(normalizeGraphWidth(20, 280)).toBe(100)
  expect(normalizeGraphWidth(200, 800)).toBe(100)
})
it('adjusts centered and right-aligned widths using the correct moving edge', () => {
  const origin: GraphResizeOrigin = {
    handle: 'corner',
    align: 'center',
    x: 400,
    y: 400,
    width: 400,
    height: 420,
    containerWidth: 800,
  }
  expect(resizedGraphDimensions(origin, 500, 500)).toEqual({ width: 75, height: 520 })
  expect(resizedGraphDimensions({ ...origin, align: 'right' }, 300, 500)).toEqual({
    width: 63,
    height: 520,
  })
  expect(resizedGraphDimensions({ ...origin, handle: 'bottom' }, 0, 0)).toEqual({
    width: 50,
    height: 300,
  })
})
it('serializes minimum constraints and mobile-safe width together with user dimensions', () => {
  const style = graphEmbedStyle(70, 500, 'right')
  expect(style).toContain('width:70%')
  expect(style).toContain('height:500px')
  expect(style).toContain('min-width:min(320px,100%)')
  expect(style).toContain('min-height:300px')
  expect(style).toContain('margin-left:auto;margin-right:0')
})
