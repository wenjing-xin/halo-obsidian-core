import { Node, mergeAttributes, VueNodeViewRenderer, ToolboxItem } from '@halo-dev/richtext-editor'
import { IconDashboard } from '@halo-dev/components'
import { markRaw } from 'vue'
import GraphNodeView from './GraphNodeView.vue'
import {
  GRAPH_DEFAULT_HEIGHT,
  graphEmbedStyle,
  normalizeGraphHeight,
  normalizeGraphWidth,
} from '../shared/graph-renderer/embed-size'

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
 * NodeView's "配置" button, which opens GraphInsertModal. New blocks require configuration before preview.
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
                .insertContent({ type: NODE_NAME, attrs: { mode: 'local', configured: false } })
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
              .insertContent({ type: NODE_NAME, attrs: { mode: 'local', configured: false } })
              .run()
          },
        }
      },
    }
  },

  addAttributes() {
    return {
      configured: { default: true, rendered: false },
      theme: { default: null, parseHTML: (element: HTMLElement) => element.getAttribute('theme') },
      mode: {
        default: 'full',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('mode') || element.getAttribute('data-mode') || 'full',
      },
      post: {
        default: '',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('post') || element.getAttribute('data-post') || '',
      },
      nodes: {
        default: '',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('nodes') || element.getAttribute('data-nodes') || '',
      },
      depth: {
        default: 1,
        parseHTML: (element: HTMLElement) =>
          Number(element.getAttribute('depth') || element.getAttribute('data-depth')) || 1,
      },
      dark: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.hasAttribute('dark') ? element.getAttribute('dark') !== 'false' : null,
      },
      height: {
        default: GRAPH_DEFAULT_HEIGHT,
        parseHTML: (element: HTMLElement) => normalizeGraphHeight(element.getAttribute('height')),
      },
      width: {
        default: 100,
        parseHTML: (element: HTMLElement) => {
          return normalizeGraphWidth(element.getAttribute('width'))
        },
      },
      align: {
        default: 'center',
        parseHTML: (element: HTMLElement) => element.getAttribute('align') || 'center',
      },
    }
  },

  parseHTML() {
    return [{ tag: 'obsidian-graph' }]
  },

  renderHTML({ node, HTMLAttributes }: { node: any; HTMLAttributes: Record<string, unknown> }) {
    const attrs = node?.attrs ?? {}
    const height = normalizeGraphHeight(attrs.height)
    const width = normalizeGraphWidth(attrs.width)
    return [
      'obsidian-graph',
      mergeAttributes(HTMLAttributes, {
        height,
        width,
        style: graphEmbedStyle(width, height, attrs.align),
      }),
    ]
  },

  addNodeView() {
    return VueNodeViewRenderer(GraphNodeView, {
      stopEvent: ({ event }) =>
        event.target instanceof Element && !!event.target.closest('[data-graph-resize-ui]'),
    })
  },
})
