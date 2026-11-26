import { css, unsafeCSS } from 'lit';

/**
 * Structural sizing shared by controls. Every value reads a --prism- token with
 * a literal fallback equal to the default-density value, so components size
 * correctly without tokens.css. Density switching via [data-prism-density]
 * works once tokens.css is loaded (it defines the density-scoped tokens).
 */
export const controlSize = css`
  :host {
    --_prism-control-height: var(--prism-control-height-md, 2.25rem);
  }
  :host([size='sm']) {
    --_prism-control-height: var(--prism-control-height-sm, 2rem);
  }
  :host([size='lg']) {
    --_prism-control-height: var(--prism-control-height-lg, 2.75rem);
  }
`;

export const controlBox = css`
  box-sizing: border-box;
  block-size: var(--_prism-control-height);
  padding-block: 0;
  padding-inline: var(--prism-control-padding-inline, 0.75rem);
  border-width: var(--prism-border-width, 1px);
  border-style: solid;
  border-color: transparent;
  border-radius: var(--prism-radius-5, 5px);
`;

/** Text-role font shorthand. role = label | body | supporting */
export const textRole = (role: 'label' | 'body' | 'supporting') => {
  const fallback = {
    label: ['0.875rem', '1.25rem', '500'],
    body: ['0.875rem', '1.25rem', '400'],
    supporting: ['0.75rem', '1rem', '400'],
  }[role];
  const r = role;
  return css`
    font-family: var(
      --prism-text-${unsafeCSS(r)}-font-family,
      Inter,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
    font-size: var(
      --prism-text-${unsafeCSS(r)}-font-size,
      ${unsafeCSS(fallback[0])}
    );
    line-height: var(
      --prism-text-${unsafeCSS(r)}-line-height,
      ${unsafeCSS(fallback[1])}
    );
    font-weight: var(
      --prism-text-${unsafeCSS(r)}-font-weight,
      ${unsafeCSS(fallback[2])}
    );
  `;
};
