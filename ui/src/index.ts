import 'virtual:uno.css'
import { definePlugin } from '@halo-dev/ui-shared'
import { IconDashboard } from '@halo-dev/components'
import { markRaw } from 'vue'
import { GraphNode } from './editor/graph-node'

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
    'default:editor:extension:create': () => [GraphNode],
  },
})
