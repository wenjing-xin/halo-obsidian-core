import { definePlugin } from '@halo-dev/ui-shared'
import { IconDashboard, IconLink } from '@halo-dev/components'
import { markRaw } from 'vue'
import { GraphNode } from './editor/graph-node'

export default definePlugin({
  components: {},
  routes: [
    {
      parentName: 'Root',
      route: {
        path: '/graphs',
        name: 'ObsidianGraph',
        component: () => import(/* webpackChunkName: "GraphView" */ './views/GraphView.vue'),
        meta: {
          title: '知识图谱',
          searchable: true,
          menu: {
            name: '知识图谱',
            group: '知识图谱',
            icon: markRaw(IconDashboard),
            priority: 0,
          },
        },
      },
    },
    {
      parentName: 'Root',
      route: {
        path: '/links',
        name: 'ObsidianLinks',
        component: () => import(/* webpackChunkName: "LinkView" */ './views/LinkView.vue'),
        meta: {
          title: '双链管理',
          searchable: true,
          menu: {
            name: '双链管理',
            group: '知识图谱',
            icon: markRaw(IconLink),
            priority: 1,
          },
        },
      },
    },
  ],
  extensionPoints: {
    'default:editor:extension:create': () => [GraphNode],
  },
})
