import {
  Node,
  mergeAttributes,
  VueNodeViewRenderer,
  ToolboxItem,
} from '@halo-dev/richtext-editor'
import { IconDashboard } from '@halo-dev/components'
import { markRaw } from 'vue'
import GraphNodeView from './GraphNodeView.vue'

const NODE_NAME = 'obsidianGraph'

/**
 * Block node for embedding a relationship graph inside the default editor.
 * Serializes to <obsidian-graph mode="..." post="..." nodes="..." depth="..." dark="...">,
 * which the theme-side web component upgrades on public pages.
 *
 * Insertion entries:
 * - editor toolbox ("插入关系图谱")
 * - slash command ("/关系图谱")
 * The graph range (full / local / nodes) is configured per block via the
 * NodeView's "配置" button, which opens GraphInsertModal.
 */
export const GraphNode = Node.create({
  name: NODE_NAME,
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return {
      ...this.parent?.(),
      getToolboxItems({ editor }: { editor: any }) {
        return {
          priority: 90,
          component: markRaw(ToolboxItem),
          props: {
            editor,
            icon: markRaw(IconDashboard),
            title: '关系图谱',
            description: '插入全站、局部或指定文章范围的关系图谱',
            action: () => {
              editor
                .chain()
                .focus()
                .insertContent({ type: NODE_NAME, attrs: { mode: 'full' } })
                .run()
            },
          },
        }
      },
      getCommandMenuItems() {
        return {
          priority: 90,
          icon: markRaw(IconDashboard),
          title: '关系图谱',
          keywords: ['graph', '关系图谱', '图谱', '双链'],
          command: ({ editor, range }: { editor: any; range: any }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent({ type: NODE_NAME, attrs: { mode: 'full' } })
              .run()
          },
        }
      },
    }
  },

  addAttributes() {
    return {
      mode: {
        default: 'full',
        parseHTML: (element: HTMLElement) => element.getAttribute('mode') || 'full',
      },
      post: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('post') || '',
      },
      nodes: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('nodes') || '',
      },
      depth: {
        default: 1,
        parseHTML: (element: HTMLElement) => Number(element.getAttribute('depth')) || 1,
      },
      dark: {
        default: true,
        parseHTML: (element: HTMLElement) => element.getAttribute('dark') !== 'false',
      },
    }
  },

  parseHTML() {
    return [{ tag: 'obsidian-graph' }]
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['obsidian-graph', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return VueNodeViewRenderer(GraphNodeView)
  },
})
