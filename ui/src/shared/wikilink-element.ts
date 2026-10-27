import { safePostPermalink } from './wikilink-tag'
import { normalizeTheme, observeTheme, resolveDark, systemPrefersDark } from './theme-controller'

/** Upgrade raw tags in Markdown previews/templates without loading Lit or the
 * graph renderer. Published article identities are still resolved server-side. */
export class ObsidianCoreLinkElement extends HTMLElement {
  static observedAttributes = ['url', 'title', 'post', 'target', 'theme', 'dark']

  private readonly anchor = document.createElement('a')
  private readonly label = document.createElement('slot')
  private stopTheme: (() => void) | null = null

  constructor() {
    super()
    const root = this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = `
      :host { display: inline-block; max-width: 100%; vertical-align: middle; line-height: 1.5; }
      a {
        --_link-color: var(--obsidian-link-color, var(--halo-hyperlink-card-inline-title-color, #18181b));
        --_link-bg: var(--obsidian-link-bg, var(--halo-hyperlink-card-inline-bg-color, #f4f4f5));
        --_link-hover-bg: var(--obsidian-link-hover-bg, var(--halo-hyperlink-card-inline-hover-bg-color, #e4e4e7));
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        max-width: calc(100% - 8px);
        padding: 2px 6px;
        margin-inline: 4px;
        border: 0;
        border-radius: 4px;
        color: var(--_link-color);
        background: var(--_link-bg);
        font: inherit;
        font-size: 90%;
        font-weight: 400;
        line-height: 1.5;
        vertical-align: middle;
        text-decoration: none;
        cursor: pointer;
        transition: background-color 150ms, color 150ms;
      }
      .label {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      a::before {
        content: "";
        display: inline-block;
        flex: none;
        width: 16px;
        height: 16px;
        background: currentColor;
        mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='black' stroke-width='2' stroke-linecap='round' d='m10 13 4-4m-5 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0'/%3E%3C/svg%3E") center / contain no-repeat;
      }
      a:hover { background: var(--_link-hover-bg); text-decoration: none; }
      a:focus-visible { outline: 2px solid var(--_link-color); outline-offset: 3px; }
      a[data-color-scheme="dark"] {
        --_link-color: var(--obsidian-link-color, var(--halo-hyperlink-card-inline-title-color, #f4f4f5));
        --_link-bg: var(--obsidian-link-bg, var(--halo-hyperlink-card-inline-bg-color, #3f3f46));
        --_link-hover-bg: var(--obsidian-link-hover-bg, var(--halo-hyperlink-card-inline-hover-bg-color, #52525b));
      }
      a[aria-disabled="true"] { opacity: 0.65; cursor: default; }
      a[aria-disabled="true"]:hover { background: var(--_link-bg); }
      @media (prefers-reduced-motion: reduce) { a { transition: none; } }
    `
    const text = document.createElement('span')
    text.className = 'label'
    text.append(this.label)
    this.anchor.append(text)
    root.append(style, this.anchor)
  }

  connectedCallback() {
    this.updateLink()
    this.stopTheme?.()
    this.stopTheme = observeTheme(this, this.syncTheme)
  }

  disconnectedCallback() {
    this.stopTheme?.()
    this.stopTheme = null
  }

  attributeChangedCallback() {
    this.updateLink()
    if (this.isConnected) this.syncTheme()
  }

  private syncTheme = () => {
    const dark = resolveDark(
      this,
      normalizeTheme(this.getAttribute('theme'), this.getAttribute('dark')),
      systemPrefersDark(),
    )
    this.anchor.dataset.colorScheme = dark ? 'dark' : 'light'
  }

  private updateLink() {
    const url = safePostPermalink(this.getAttribute('url'))
    this.label.textContent =
      this.title || this.getAttribute('url') || this.getAttribute('post') || ''
    this.anchor.title = this.title
    if (url) {
      this.anchor.href = url
      this.anchor.target = this.getAttribute('target') === '_self' ? '_self' : '_blank'
      this.anchor.rel = 'noopener noreferrer'
      this.anchor.removeAttribute('aria-disabled')
    } else {
      this.anchor.removeAttribute('href')
      this.anchor.removeAttribute('target')
      this.anchor.removeAttribute('rel')
      this.anchor.setAttribute('aria-disabled', 'true')
    }
  }
}

if (!customElements.get('obsidian-core-link')) {
  customElements.define('obsidian-core-link', ObsidianCoreLinkElement)
}
