class t extends HTMLElement{static observedAttributes=["url","title","post","target"];anchor=document.createElement("a");label=document.createElement("slot");constructor(){super();let t=this.attachShadow({mode:"open"}),e=document.createElement("style");e.textContent=`
      :host { display: inline; }
      a {
        --_link-color: var(--obsidian-link-color, #0f766e);
        display: inline-flex;
        align-items: baseline;
        gap: 0.3em;
        padding: 0.08em 0.38em;
        margin-inline: 0.12em;
        border: 1px solid var(--obsidian-link-border, color-mix(in srgb, var(--_link-color) 24%, transparent));
        border-radius: 5px;
        color: var(--_link-color);
        background: var(--obsidian-link-bg, color-mix(in srgb, var(--_link-color) 8%, transparent));
        font: inherit;
        text-decoration: none;
        overflow-wrap: anywhere;
      }
      a::before {
        content: "";
        display: inline-block;
        flex: none;
        width: 0.9em;
        height: 0.9em;
        background: currentColor;
        mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='black' stroke-width='2' stroke-linecap='round' d='m10 13 4-4m-5 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0'/%3E%3C/svg%3E") center / contain no-repeat;
      }
      a:hover { background: color-mix(in srgb, var(--_link-color) 16%, transparent); border-color: var(--_link-color); text-decoration: underline; text-underline-offset: 3px; }
      a:focus-visible { outline: 2px solid var(--_link-color); outline-offset: 3px; }
      :host-context(.dark) a,
      :host-context(.theme-dark) a,
      :host-context(.color-scheme-dark) a,
      :host-context([data-color-scheme="dark"]) a,
      :host-context([data-theme="dark"]) a { --_link-color: var(--obsidian-link-color, #5eead4); }
    `,this.anchor.append(this.label),t.append(e,this.anchor)}connectedCallback(){this.updateLink()}attributeChangedCallback(){this.updateLink()}updateLink(){let t=function(t){let e=t?.trim();if(!(!e||e.includes("\\")||/[\u0000-\u001f\u007f]/.test(e))){if(/^\/(?![\\/])/.test(e))return e;if(/^https?:\/\//i.test(e))try{return["http:","https:"].includes(new URL(e).protocol)?e:void 0}catch{return}}}(this.getAttribute("url"));this.label.textContent=this.title||this.getAttribute("url")||this.getAttribute("post")||"",this.anchor.title=this.title,t?(this.anchor.href=t,this.anchor.target="_self"===this.getAttribute("target")?"_self":"_blank",this.anchor.rel="noopener noreferrer",this.anchor.removeAttribute("aria-disabled")):(this.anchor.removeAttribute("href"),this.anchor.removeAttribute("target"),this.anchor.removeAttribute("rel"),this.anchor.setAttribute("aria-disabled","true"))}}customElements.get("obsidian-core-link")||customElements.define("obsidian-core-link",t);export{t as ObsidianCoreLinkElement};