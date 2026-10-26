import { beforeEach, expect, it, vi } from 'vitest'
const { listPosts } = vi.hoisted(() => ({ listPosts: vi.fn() }))
vi.mock('@halo-dev/api-client', () => ({
  axiosInstance: {},
  consoleApiClient: { content: { post: { listPosts } } },
}))
import { searchPostBriefs } from '../obsidian'

beforeEach(() => {
  vi.clearAllMocks()
})

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
    publishPhase: undefined,
    fieldSelector: ['spec.deleted=false'],
  })
})
it('excludes the current article and non-navigable drafts in the link picker', async () => {
  listPosts.mockResolvedValue({
    data: {
      items: ['current', 'other', 'draft'].map((name) => ({
        post: {
          metadata: { name },
          spec: { title: name },
          status: name === 'draft' ? {} : { permalink: `/${name}` },
        },
      })),
    },
  })
  expect(await searchPostBriefs('', { excludePostName: 'current', publishedOnly: true })).toEqual([
    { name: 'other', title: 'other', permalink: '/other' },
  ])
  expect(listPosts).toHaveBeenLastCalledWith({
    size: 20,
    keyword: undefined,
    publishPhase: 'PUBLISHED',
    fieldSelector: ['spec.deleted=false', 'metadata.name!=current'],
  })
})

it('uses the supported publish phase for published-only keyword searches', async () => {
  listPosts.mockResolvedValue({ data: { items: [] } })

  expect(await searchPostBriefs(' Article ', { publishedOnly: true })).toEqual([])
  expect(listPosts).toHaveBeenCalledExactlyOnceWith({
    size: 20,
    keyword: 'Article',
    publishPhase: 'PUBLISHED',
    fieldSelector: ['spec.deleted=false'],
  })
})
