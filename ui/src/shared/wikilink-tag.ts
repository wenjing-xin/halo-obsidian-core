export interface WikiLinkTarget {
  name: string
  title: string
  permalink?: string | null
}

export function safePostPermalink(value?: string | null): string | undefined {
  const href = value?.trim()
  if (!href || href.includes('\\') || /[\u0000-\u001f\u007f]/.test(href)) return undefined
  if (/^\/(?![\\/])/.test(href)) return href
  if (!/^https?:\/\//i.test(href)) return undefined
  try {
    return ['http:', 'https:'].includes(new URL(href).protocol) ? href : undefined
  } catch {
    return undefined
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]!,
  )
}

/** Stable article identity is shared by Markdown copies and rich-text anchors. */
export function createWikiLinkTag(post: WikiLinkTarget): string {
  if (!post.name.trim()) throw new Error('文章标识为空，无法生成双链标签')
  const href = safePostPermalink(post.permalink)
  // Numeric entities keep Markdown punctuation in titles literal in inline HTML.
  const title = escapeHtml(post.title || post.name).replace(
    /[\r\n`*_\[\]\\]/g,
    (char) => `&#${char.charCodeAt(0)};`,
  )
  return (
    `<obsidian-core-link post="${escapeHtml(post.name)}"` +
    (href ? ` url="${escapeHtml(href)}"` : '') +
    ` title="${escapeHtml(post.title || post.name)}" target="_blank">${title}</obsidian-core-link>`
  )
}
