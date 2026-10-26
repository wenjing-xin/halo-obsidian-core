import { Node, mergeAttributes, VueNodeViewRenderer } from '@halo-dev/richtext-editor'
import GraphNodeView from './GraphNodeView.vue'

/**
 * Block node for embedding a knowledge graph inside the default editor.
 * Serializes to <obsidian-graph mode="..." post="..." nodes="..." depth="..." dark="...">,
 * which the theme-side web component upgrades on public pages.
 */
export const GraphNode = Node.create({
  name: 'obsidianGraph',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      mode: {
        default: 'full',
        parseHTML: (element) => element.getAttribute('mode') || 'full',
      },
      post: {
        default: '',
        parseHTML: (element) => element.getAttribute('post') || '',
      },
      nodes: {
        default: '',
        parseHTML: (element) => element.getAttribute('nodes') || '',
      },
      depth: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute('depth')) || 1,
      },
      dark: {
        default: true,
        parseHTML: (element) => element.getAttribute('dark') !== 'false',
      },
    }
  },

  parseHTML() {
    return [{ tag: 'obsidian-graph' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['obsidian-graph', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return VueNodeViewRenderer(GraphNodeView)
  },
})
