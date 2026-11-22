import { html, svg, type TemplateResult } from 'lit';

const icon = (body: TemplateResult): TemplateResult =>
  html`<svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    ${body}
  </svg>`;

export const iconRefresh = () =>
  icon(svg`<path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5v3h-3"/>`);
