import { expect, it, vi } from 'vitest'
const { listPosts } = vi.hoisted(() => ({ listPosts: vi.fn() }))
vi.mock('@halo-dev/api-client', () => ({
  axiosInstance: {},
  consoleApiClient: { content: { post: { listPosts } } },
}))
import { searchPostBriefs } from '../obsidian'
it('uses the keyword-aware Console endpoint and unwraps ListedPost', async () => {
  listPosts.mockResolvedValue({
    data: {
      items: [
        {
          post: {
            metadata: { name: 'a' },
            spec: { title: 'Article' },
            status: { permalink: '/a' },
          },
        },
      ],
    },
  })
  expect(await searchPostBriefs(' Article ')).toEqual([
    { name: 'a', title: 'Article', permalink: '/a' },
  ])
  expect(listPosts).toHaveBeenCalledWith({
    keyword: 'Article',
    size: 20,
    fieldSelector: ['spec.deleted=false'],
  })
})
