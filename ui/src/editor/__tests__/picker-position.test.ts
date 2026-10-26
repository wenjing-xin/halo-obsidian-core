import { expect, it } from 'vitest'
import { currentPostName, pickerPosition } from '../picker-position'
it('places the picker under the insertion caret when there is room', () => {
  expect(pickerPosition({ left: 120, top: 180, bottom: 200 }, 440, 320, 1200, 800)).toMatchObject({
    left: 120,
    top: 208,
  })
})
it('flips above the caret near the bottom and stays inside mobile viewport', () => {
  const p = pickerPosition({ left: 350, top: 650, bottom: 670 }, 366, 360, 390, 720)
  expect(p.left).toBe(12)
  expect(p.top).toBe(282)
  expect(p.maxHeight).toBeLessThanOrEqual(696)
})
it('uses the verified Halo editor query rather than unrelated names', () => {
  expect(currentPostName('https://example.com/console/posts/editor?name=current')).toBe('current')
  expect(currentPostName('https://example.com/console/posts/editor')).toBeUndefined()
  expect(
    currentPostName('https://example.com/console/single-pages/editor?name=page'),
  ).toBeUndefined()
})
