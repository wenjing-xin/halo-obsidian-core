import type { ListedPost } from '@halo-dev/api-client'
import { VDropdownItem } from '@halo-dev/components'
import type { OperationItem } from '@halo-dev/ui-shared'
import { markRaw, type Ref } from 'vue'
import { copyWikiLinkTag } from '../shared/copy-wikilink'

export function createPostOperations(post: Ref<ListedPost>): OperationItem<ListedPost>[] {
  return [
    {
      priority: 25,
      component: markRaw(VDropdownItem),
      label: '复制双链标签',
      action: async () => {
        const current = post.value.post
        await copyWikiLinkTag({
          name: current.metadata.name,
          title: current.spec.title,
          permalink: current.status?.permalink,
        })
      },
    },
  ]
}
