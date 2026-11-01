import { css } from 'lit';
import { textRole } from './control-styles.js';

/**
 * Private. Layout shared by the checkbox and the radio: a control cell and a
 * text column, a 24px minimum hit area around a drawn box, and the layers
 * inside the box (edge, fill, light pass, state overlay). Colour and shape
 * come from the theme through ::part().
 */
export const choiceStyles = css`
  :host {
    /* The drawn box (default size md); the hit area is at least 24px. */
    --_box: 1.25rem;
    --_hit: max(var(--_box), 1.5rem);
    --_bd: calc(var(--prism-border-width, 1px) * 1.5);
    display: block;
  }
  :host([size='sm']) {
    --_box: 1rem;
  }
  :host([size='lg']) {
    --_box: 1.5rem;
  }
  :host([hidden]) {
    display: none;
  }
  [part='container'] {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: var(--prism-space-3, 0.75rem);
    align-items: start;
  }
  [part='base'] {
    all: unset;
    cursor: var(--prism-choice-cursor, pointer);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  /* The hit area. Where a control wraps an input, the wrapper and the input
     share it. */
  [part='base'],
  [part='control'] {
    box-sizing: border-box;
    position: relative;
    display: grid;
    place-items: center;
    inline-size: var(--_hit);
    block-size: var(--_hit);
    border-radius: var(--prism-radius-5, 5px);
  }
  [part='base']:disabled {
    cursor: var(--prism-choice-cursor-disabled, default);
  }
  /* The drawn box. Its squish is the press motion. */
  [part='box'] {
    position: relative;
    box-sizing: border-box;
    inline-size: var(--_box);
    block-size: var(--_box);
    overflow: hidden;
    pointer-events: none;
  }
  [part='edge'],
  [part='ring'] {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border: var(--_bd) solid transparent;
    border-radius: inherit;
  }
  /* The state layer's overlay, above the fill and below the mark. */
  [part='box']::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 3;
    border-radius: inherit;
    background-color: var(--_prism-state-overlay, transparent);
  }
  [part='text'] {
    min-inline-size: 0;
    padding-block-start: calc((var(--_hit) - 1.25rem) / 2);
  }
  [part='label'] {
    ${textRole('body')}
    display: block;
    cursor: var(--prism-choice-cursor, pointer);
    user-select: none;
  }
  :host(:state(disabled)) [part='label'] {
    cursor: var(--prism-choice-cursor-disabled, default);
  }
  [part='description'],
  [part='error'] {
    ${textRole('caption')}
  }
  [part='description'][hidden],
  [part='error'][hidden] {
    display: none;
  }
  @media (prefers-reduced-motion: reduce) {
    /* No travel, squish or draw: the state changes at once and the colours
       (opacity) fade over 120ms. */
    [part='fill'],
    [part='ring'],
    [part='dot'],
    [part='mark'] line {
      transition: opacity 120ms linear;
    }
  }
`;
