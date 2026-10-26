import { beforeEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { ListedPost } from '@halo-dev/api-client'
const mocks = vi.hoisted(() => ({ write: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('@halo-dev/components', () => ({
  VDropdownItem: { name: 'VDropdownItem' },
  Toast: { success: mocks.success, error: mocks.error },
}))
import { createPostOperations } from '../post-operations'
beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: mocks.write },
  })
})
it('native article dropdown copies the current reactive article as the custom tag', async () => {
  const post = ref({
    post: { metadata: { name: 'p1' }, spec: { title: 'First' }, status: { permalink: '/first' } },
  } as ListedPost)
  const action = createPostOperations(post)[0]!
  expect(action.label).toBe('复制双链标签')
  expect(action.component).toMatchObject({ name: 'VDropdownItem' })
  post.value.post.spec.title = 'Renamed'
  mocks.write.mockResolvedValue(undefined)
  await action.action?.()
  expect(mocks.write).toHaveBeenCalledWith(
    expect.stringContaining('<obsidian-core-link post="p1" url="/first" title="Renamed"'),
  )
  expect(mocks.success).toHaveBeenCalledOnce()
})
it('shows an actionable error when clipboard permission is denied', async () => {
  const post = ref({ post: { metadata: { name: 'p1' }, spec: { title: 'Post' } } } as ListedPost)
  mocks.write.mockRejectedValue(new Error('denied'))
  await createPostOperations(post)[0]?.action?.()
  expect(mocks.error).toHaveBeenCalledOnce()
  expect(mocks.success).not.toHaveBeenCalled()
})
