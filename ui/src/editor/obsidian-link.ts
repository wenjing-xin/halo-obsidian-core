import {
  Node,
  Plugin,
  ToolboxItem,
  mergeAttributes,
  type Editor,
  type Transaction,
} from '@halo-dev/richtext-editor'
import { IconLink } from '@halo-dev/components'
import { markRaw } from 'vue'
import type { PostBrief } from '../api/obsidian'
import { openPostLinkPicker } from './post-link-picker'
import { currentPostName } from './picker-position'
import { safePostPermalink } from '../shared/wikilink-tag'
import '../../../src/main/resources/static/obsidian-links.css'

const NODE_NAME = 'obsidianLink'

/**
 * Inline node representing a structured link to another post. Unlike the
 * `[[title]]` wikilink syntax it stores the target's `metadata.name`, so the
 * relation survives target renames and never depends on title matching.
 *
 * Serializes to `<obsidian-core-link post="..." url="..." title="...">text</obsidian-core-link>`.
 * The backend resolves the stable post identity and emits an accessible anchor.
 *
 * Insertion entries:
 * - editor toolbox ("文章关联")
 * - slash command ("/文章关联")
 */
function insertPostLink(
  editor: Editor,
  post: PostBrief,
  text: string,
  range: { from: number; to: number },
) {
  editor
    .chain()
    .focus()
    .insertContentAt(range, {
      type: NODE_NAME,
      attrs: { postName: post.name, permalink: post.permalink || '', title: post.title },
      content: [{ type: 'text', text: text || post.title }],
    })
    .run()
}

function promptAndInsert(editor: Editor) {
  const { from, to } = editor.state.selection
  const selectedText = editor.state.doc.textBetween(from, to, ' ').trim()
  let bookmark = editor.state.selection.getBookmark()
  let dispose: (() => void) | undefined
  const track = ({ transaction }: { transaction: Transaction }) => {
    bookmark = bookmark.map(transaction.mapping)
  }
  const cleanup = () => {
    editor.off('transaction', track)
    editor.off('destroy', onDestroy)
  }
  const onDestroy = () => {
    dispose?.()
    cleanup()
  }
  editor.on('transaction', track)
  editor.on('destroy', onDestroy)
  dispose = openPostLinkPicker({
    anchor: () => editor.view.coordsAtPos(bookmark.resolve(editor.state.doc).from),
    excludePostName: currentPostName(window.location.href),
    onSelect: (post) => {
      cleanup()
      if (editor.isDestroyed) return
      const selection = bookmark.resolve(editor.state.doc)
      insertPostLink(editor, post, selectedText || post.title, selection)
    },
    onClose: cleanup,
  })
}

export const ObsidianLink = Node.create({
  name: NODE_NAME,
  inline: true,
  group: 'inline',
  content: 'text*',
  // Take precedence over the built-in Link mark when parsing anchors that
  // carry data-obsidian-post.
  priority: 2000,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleClick: (_view, _pos, event) => {
            const link =
              event.target instanceof Element
                ? event.target.closest<HTMLElement>('obsidian-core-link')
                : null
            const url = safePostPermalink(link?.getAttribute('url'))
            if (!url) return false
            event.preventDefault()
            const target = link?.getAttribute('target') === '_self' ? '_self' : '_blank'
            window.open(new URL(url, document.baseURI).href, target, 'noopener,noreferrer')
            return true
          },
        },
      }),
    ]
  },

  addOptions() {
    return {
      ...this.parent?.(),
      getToolboxItems({ editor }: { editor: any }) {
        return {
          priority: 89,
          component: markRaw(ToolboxItem),
          props: {
            editor,
            icon: markRaw(IconLink),
            title: '文章关联',
            description: '搜索并插入指向其他文章的双链',
            action: () => promptAndInsert(editor),
          },
        }
      },
      getCommandMenuItems() {
        return {
          priority: 89,
          icon: markRaw(IconLink),
          title: '文章关联',
          keywords: ['link', 'wikilink', '关联', '双链', '文章链接'],
          command: ({ editor, range }: { editor: any; range: any }) => {
            editor.chain().focus().deleteRange(range).run()
            promptAndInsert(editor)
          },
        }
      },
    }
  },

  addAttributes() {
    return {
      postName: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('post') || '',
        renderHTML: (attributes: Record<string, unknown>) => ({ post: attributes.postName }),
      },
      permalink: {
        default: '',
        parseHTML: (element: HTMLElement) => safePostPermalink(element.getAttribute('url')) || '',
        renderHTML: (attributes: Record<string, unknown>) => {
          const url = safePostPermalink(String(attributes.permalink || ''))
          return url ? { url } : {}
        },
      },
      title: {
        default: '',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('title') || element.textContent || '',
      },
      target: {
        default: '_blank',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('target') === '_self' ? '_self' : '_blank',
      },
    }
  },

  parseHTML() {
    return [{ tag: 'obsidian-core-link' }]
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      'obsidian-core-link',
      mergeAttributes({ class: 'obsidian-post-link' }, HTMLAttributes),
      0,
    ]
  },
})
