import { definePlugin } from '@halo-dev/ui-shared'
import { IconDashboard, IconLink } from '@halo-dev/components'
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
        component: () => import(/* webpackChunkName: "GraphView" */ './views/GraphView.vue'),
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
    {
      parentName: 'PostsRoot',
      route: {
        path: '/links',
        name: 'ObsidianLinks',
        component: () => import(/* webpackChunkName: "LinkView" */ './views/LinkView.vue'),
        meta: {
          title: '双链管理',
          searchable: true,
          menu: {
            name: '双链管理',
            group: 'content',
            icon: markRaw(IconLink),
            priority: 6,
          },
        },
      },
    },
  ],
  extensionPoints: {
    'default:editor:extension:create': () => [GraphNode],
  },
})
