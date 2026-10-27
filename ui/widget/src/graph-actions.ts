import { css, html, nothing, svg } from 'lit'

// Same Remix paths as the Console icons; no Vue runtime in the theme bundle.
const icons = {
  refresh: svg`<path d="M5.463 4.433A9.96 9.96 0 0 1 12 2c5.523 0 10 4.477 10 10c0 2.136-.67 4.116-1.81 5.74L17 12h3A8 8 0 0 0 6.46 6.228zm13.074 15.134A9.96 9.96 0 0 1 12 22C6.477 22 2 17.523 2 12c0-2.136.67-4.116 1.81-5.74L7 12H4a8 8 0 0 0 13.54 5.772z"/>`,
  settings: svg`<path d="M3.34 17a10 10 0 0 1-.979-2.326a3 3 0 0 0 .003-5.347a10 10 0 0 1 2.5-4.337a3 3 0 0 0 4.632-2.674a10 10 0 0 1 5.007.003a3 3 0 0 0 4.632 2.671a10.06 10.06 0 0 1 2.503 4.336a3 3 0 0 0-.002 5.347a10 10 0 0 1-2.501 4.337a3 3 0 0 0-4.632 2.674a10 10 0 0 1-5.007-.002a3 3 0 0 0-4.631-2.672A10 10 0 0 1 3.339 17m5.66.196a5 5 0 0 1 2.25 2.77q.75.07 1.499.002a5 5 0 0 1 2.25-2.772a5 5 0 0 1 3.526-.564q.435-.614.748-1.298A5 5 0 0 1 18 12c0-1.26.47-2.437 1.273-3.334a8 8 0 0 0-.75-1.298A5 5 0 0 1 15 6.804a5 5 0 0 1-2.25-2.77q-.75-.071-1.5-.001A5 5 0 0 1 9 6.804a5 5 0 0 1-3.526.564q-.436.614-.747 1.298A5 5 0 0 1 6 12c0 1.26-.471 2.437-1.273 3.334a8 8 0 0 0 .75 1.298A5 5 0 0 1 9 17.196M12 15a3 3 0 1 1 0-6a3 3 0 0 1 0 6m0-2a1 1 0 1 0 0-2a1 1 0 0 0 0 2"/>`,
  replay: svg`<path d="M15.199 9.944a2.6 2.6 0 0 1-.79-1.55l-.403-3.083-2.731 1.486a2.6 2.6 0 0 1-1.719.272L6.5 6.5l.57 3.056a2.6 2.6 0 0 1-.273 1.72l-1.486 2.73 3.083.403a2.6 2.6 0 0 1 1.55.79l2.138 2.257 1.336-2.807a2.6 2.6 0 0 1 1.23-1.231l2.808-1.336zm.025 5.564-2.213 4.65a.6.6 0 0 1-.977.155l-3.542-3.739a.6.6 0 0 0-.358-.182l-5.106-.668a.6.6 0 0 1-.45-.881l2.462-4.524a.6.6 0 0 0 .063-.396L4.16 4.86a.6.6 0 0 1 .7-.7l5.062.943a.6.6 0 0 0 .397-.063l4.523-2.46a.6.6 0 0 1 .882.448l.668 5.107a.6.6 0 0 0 .182.357l3.739 3.542a.6.6 0 0 1-.155.977l-4.65 2.213a.6.6 0 0 0-.284.284m.797 1.927 1.414-1.414 4.243 4.242-1.415 1.415z"/>`,
  zoomIn: svg`<path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z"/>`,
  zoomOut: svg`<path d="M5 11v2h14v-2z"/>`,
} as const

export function graphAction(
  icon: keyof typeof icons,
  label: string,
  activate: () => void,
  state: { disabled?: boolean; busy?: boolean; expanded?: boolean } = {},
) {
  return html`<span class="graph-action">
    <button
      type="button"
      class="graph-action-icon"
      aria-label=${label}
      aria-expanded=${state.expanded ?? nothing}
      aria-busy=${state.busy ?? false}
      ?disabled=${state.disabled}
      @click=${activate}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[icon]}</svg>
    </button>
    <span class="graph-action-tooltip" role="tooltip">${label}</span>
  </span>`
}

export const graphActionStyles = css`
  .controls {
    position: absolute;
    right: 12px;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px;
    border: 1px solid var(--graph-tool-border);
    border-radius: 999px;
    background: var(--graph-tool-bg);
    box-shadow: 0 2px 8px #0000000d;
  }
  .controls-main {
    top: 12px;
  }
  .controls-viewport {
    bottom: 12px;
  }
  .graph-action {
    position: relative;
    display: flex;
  }
  .graph-action-icon {
    appearance: none;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    min-width: 36px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--graph-tool-color);
    cursor: pointer;
    transition:
      background-color 150ms,
      color 150ms;
  }
  .graph-action-icon:hover:not(:disabled),
  .graph-action-icon[aria-expanded='true'] {
    color: var(--graph-tool-active);
    background: var(--graph-tool-hover);
  }
  .graph-action-icon:focus-visible {
    outline: 2px solid var(--graph-accent);
    outline-offset: 2px;
  }
  .graph-action-icon:disabled {
    cursor: default;
    opacity: 0.45;
  }
  .graph-action-icon svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
  .graph-action-icon[aria-busy='true'] svg {
    animation: graph-action-spin 1s linear infinite;
  }
  .graph-action-tooltip {
    position: absolute;
    right: calc(100% + 10px);
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    visibility: hidden;
    opacity: 0;
    white-space: nowrap;
    padding: 4px 8px;
    border-radius: 5px;
    background: var(--graph-tool-active);
    color: var(--graph-bg);
    font: 12px/1.5 sans-serif;
  }
  .graph-action:hover .graph-action-tooltip,
  .graph-action:focus-within .graph-action-tooltip {
    visibility: visible;
    opacity: 1;
  }
  @keyframes graph-action-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .graph-action-icon {
      transition: none;
    }
    .graph-action-icon[aria-busy='true'] svg {
      animation: none;
    }
  }
`
