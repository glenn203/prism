import { css, html, nothing, type TemplateResult } from 'lit';
import type { DirectiveResult } from 'lit/directive.js';
import type { StyleMapDirective } from 'lit/directives/style-map.js';
import { textRole } from './control-styles.js';

/**
 * Private shared field parts: label, description and error, with stable ids
 * `${id}-label|-description|-error`. Used by every Prism field. Not exported.
 */
export const fieldPartsStyles = css`
  :host {
    display: block;
  }
  :host([hidden]) {
    display: none;
  }
  [part='label'] {
    display: block;
    ${textRole('label')}
  }
  [part='description'],
  [part='error'] {
    ${textRole('caption')}
  }
  [part='description'][hidden],
  [part='error'][hidden] {
    display: none;
  }
`;

export const renderLabel = (
  id: string,
  label: string,
  forId?: string,
  style?: DirectiveResult<typeof StyleMapDirective>,
): TemplateResult =>
  forId
    ? html`<label
        part="label"
        id="${id}-label"
        for="${forId}"
        style=${style ?? nothing}
        >${label}</label
      >`
    : html`<span part="label" id="${id}-label">${label}</span>`;

export const renderDescription = (id: string): TemplateResult =>
  html`<div part="description" id="${id}-description">
    <slot name="description"></slot>
  </div>`;

export const renderError = (id: string): TemplateResult =>
  html`<div part="error" id="${id}-error" aria-live="polite" hidden>
    <slot name="error"></slot>
  </div>`;

/**
 * Sets aria-invalid / aria-describedby on the control and shows the error
 * only while invalid. The error is referenced only while it is shown.
 * A group (fieldset) takes `ariaInvalid: false`: the attribute is not
 * supported on its role, and its native inputs report their own validity.
 */
export function syncFieldA11y(
  root: ParentNode,
  control: Element,
  id: string,
  invalid: boolean,
  { hideDescriptionWhenInvalid = false, ariaInvalid = true } = {},
): void {
  if (ariaInvalid) control.setAttribute('aria-invalid', String(invalid));
  const describedBy =
    invalid && hideDescriptionWhenInvalid
      ? `${id}-error`
      : `${id}-description${invalid ? ` ${id}-error` : ''}`;
  control.setAttribute('aria-describedby', describedBy);
  root.querySelector('[part="error"]')?.toggleAttribute('hidden', !invalid);
}
