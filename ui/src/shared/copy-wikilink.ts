import { Toast } from '@halo-dev/components'
import { createWikiLinkTag, type WikiLinkTarget } from './wikilink-tag'

export async function copyWikiLinkTag(post: WikiLinkTarget): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(createWikiLinkTag(post))
    Toast.success('双链标签已复制，粘贴到 Markdown 正文即可')
    return true
  } catch {
    Toast.error('复制双链标签失败，请允许浏览器访问剪贴板后重试')
    return false
  }
}
