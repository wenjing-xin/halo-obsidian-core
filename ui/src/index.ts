import 'virtual:uno.css'
import './shared/wikilink-element'
import { definePlugin } from '@halo-dev/ui-shared'
import { IconDashboard } from '@halo-dev/components'
import { markRaw } from 'vue'
import { GraphNode } from './editor/graph-node'
import { ObsidianLink } from './editor/obsidian-link'
import { createPostOperations } from './extensions/post-operations'

export default definePlugin({
  components: {},
  routes: [
    {
      parentName: 'PostsRoot',
      route: {
        path: '/graphs',
        name: 'ObsidianGraph',
        component: () => import(/* webpackChunkName: "GraphHubView" */ './views/GraphHubView.vue'),
        meta: {
          title: '关系图谱',
          searchable: true,
          permissions: ['plugin:obsidian-core:view'],
          menu: {
            name: '关系图谱',
            group: 'content',
            icon: markRaw(IconDashboard),
            priority: 5,
          },
        },
      },
    },
  ],
  extensionPoints: {
    'post:list-item:operation:create': createPostOperations,
    'default:editor:extension:create': () => [GraphNode, ObsidianLink],
  },
})
