function e(e){let t=[];for(let r=e;r;){t.push(r);let e=r.getRootNode();r=r.parentElement||(e instanceof ShadowRoot?e.host:null)}return t}class t extends HTMLElement{static observedAttributes=["url","title","post","target","theme","dark"];anchor=document.createElement("a");label=document.createElement("slot");stopTheme=null;constructor(){super();let e=this.attachShadow({mode:"open"}),t=document.createElement("style");t.textContent=`
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
    `;let r=document.createElement("span");r.className="label",r.append(this.label),this.anchor.append(r),e.append(t,this.anchor)}connectedCallback(){this.updateLink(),this.stopTheme?.(),this.stopTheme=function(t,r){let i=new MutationObserver(r);for(let r of e(t))i.observe(r,{attributes:!0,attributeFilter:["class","style","data-theme","data-color-scheme","theme","dark"]});let o=window.matchMedia?.("(prefers-color-scheme: dark)");return o?.addEventListener("change",r),r(),()=>{i.disconnect(),o?.removeEventListener("change",r)}}(this,this.syncTheme)}disconnectedCallback(){this.stopTheme?.(),this.stopTheme=null}attributeChangedCallback(){this.updateLink(),this.isConnected&&this.syncTheme()}syncTheme=()=>{var t,r;let i=function(t,r,i){if("auto"!==r)return"dark"===r;for(let r of e(t)){let e=r.getAttribute("data-color-scheme")||r.getAttribute("data-theme");if("dark"===e||"light"===e)return"dark"===e;if("auto"===e)return i;if(["dark","color-scheme-dark","theme-dark"].some(e=>r.classList.contains(e)))return!0;if(["light","color-scheme-light","theme-light"].some(e=>r.classList.contains(e)))return!1;if(r.classList.contains("color-scheme-auto"))return i}let o=getComputedStyle(t).colorScheme?.split(/\s+/)??[];return o.includes("dark")||o.includes("light")?o.includes("dark")&&(!o.includes("light")||i):i}(this,(t=this.getAttribute("theme"),r=this.getAttribute("dark"),"auto"===t||"light"===t||"dark"===t?t:!1===r||"false"===r?"light":!0===r||"true"===r||""===r?"dark":"auto"),window.matchMedia?.("(prefers-color-scheme: dark)").matches??!1);this.anchor.dataset.colorScheme=i?"dark":"light"};updateLink(){let e=function(e){let t=e?.trim();if(!(!t||t.includes("\\")||/[\u0000-\u001f\u007f]/.test(t))){if(/^\/(?![\\/])/.test(t))return t;if(/^https?:\/\//i.test(t))try{return["http:","https:"].includes(new URL(t).protocol)?t:void 0}catch{return}}}(this.getAttribute("url"));this.label.textContent=this.title||this.getAttribute("url")||this.getAttribute("post")||"",this.anchor.title=this.title,e?(this.anchor.href=e,this.anchor.target="_self"===this.getAttribute("target")?"_self":"_blank",this.anchor.rel="noopener noreferrer",this.anchor.removeAttribute("aria-disabled")):(this.anchor.removeAttribute("href"),this.anchor.removeAttribute("target"),this.anchor.removeAttribute("rel"),this.anchor.setAttribute("aria-disabled","true"))}}customElements.get("obsidian-core-link")||customElements.define("obsidian-core-link",t);export{t as ObsidianCoreLinkElement};