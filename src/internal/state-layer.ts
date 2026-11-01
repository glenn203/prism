import { css, unsafeCSS, type CSSResult } from 'lit';

/**
 * Private shared state layer for ANY interactive surface: buttons, options,
 * tree rows, list items, tabs, clickable cards, icon buttons.
 *
 * Contract (theme-facing, set from outside via ::part()):
 *   --_bg   resting fill (may be `transparent`); never changes with state
 *   --_on   text/icon colour on that fill
 *   --_bg-hover / --_bg-pressed / --_bg-selected   optional fixed fills, used
 *           ONLY when color-mix() is unsupported (Safari < 16.2 etc.)
 *
 * Alpha overlay: background-color stays var(--_bg); each state
 * paints background-image: linear-gradient(X, X) with
 *   X = color-mix(in srgb, var(--_on) N%, transparent)
 * i.e. the element's own text colour at N% alpha composited over its fill.
 * The resolved overlay colour is exposed as --_prism-state-overlay.
 * The overlay paints under a transparent border too (background-clip:
 * border-box), so a border that should follow the fill uses `transparent`.
 *
 * States (in the shadow root, so ::part() themes don't need per-state rules):
 *   hover     6%  :hover inside @media (hover: hover), or host :state(active)
 *             (keyboard highlight, e.g. aria-activedescendant)
 *   pressed  12%  :active, or [data-pressed]
 *   selected 11%  [aria-selected=true] / [aria-pressed=true] / [aria-current] /
 *             [aria-checked=true] on the surface, a checked native input
 *             directly inside it, or host :state(selected).
 *             Selected+hover is its own token (15%); selected+pressed uses
 *             pressed (12%). Colour is never the only cue: the component MUST
 *             also show a non-colour indicator (WCAG 1.4.1).
 *   disabled  :disabled / [aria-disabled=true] / a disabled native input
 *             directly inside it / host :state(disabled):
 *             no hover/pressed/selected change at all.
 * Headless-safe: with no theme, --_bg/--_on are unset and nothing paints.
 */
export function stateLayer(selector: string): CSSResult {
  const s = unsafeCSS(selector);
  const live = unsafeCSS(
    `${selector}:not(:disabled, [aria-disabled='true'], :has(> :disabled))`,
  );
  return css`
    ${s} {
      --_prism-ov-hover: color-mix(
        in srgb,
        var(--_on, transparent) var(--prism-state-hover, 6%),
        transparent
      );
      --_prism-ov-pressed: color-mix(
        in srgb,
        var(--_on, transparent) var(--prism-state-pressed, 12%),
        transparent
      );
      --_prism-ov-selected: color-mix(
        in srgb,
        var(--_on, transparent) var(--prism-state-selected, 11%),
        transparent
      );
      --_prism-ov-selected-hover: color-mix(
        in srgb,
        var(--_on, transparent) var(--prism-state-selected-hover, 15%),
        transparent
      );
      --_prism-state-overlay: transparent;
      --_prism-fb: var(--_bg, transparent);
      background-color: var(--_bg, transparent);
      background-image: linear-gradient(
        var(--_prism-state-overlay),
        var(--_prism-state-overlay)
      );
    }
    @supports not (color: color-mix(in srgb, red, blue)) {
      /* No overlay: swap the fill for the theme's fixed per-state fills. */
      ${s} {
        --_prism-ov-hover: transparent;
        --_prism-ov-pressed: transparent;
        --_prism-ov-selected: transparent;
        --_prism-ov-selected-hover: transparent;
        background-color: var(--_prism-fb);
      }
    }
    ${live}:is(
        [aria-selected='true'],
        [aria-pressed='true'],
        [aria-checked='true'],
        :has(> :checked),
        [aria-current]:not([aria-current='false'])
      ),
    :host(:state(selected):not(:state(disabled))) ${s} {
      --_prism-state-overlay: var(--_prism-ov-selected);
      --_prism-fb: var(--_bg-selected, var(--_bg, transparent));
    }
    :host(:state(active):not(:state(disabled))) ${s} {
      --_prism-state-overlay: var(--_prism-ov-hover);
      --_prism-fb: var(--_bg-hover, var(--_bg, transparent));
    }
    :host(:state(active):state(selected):not(:state(disabled))) ${s} {
      --_prism-state-overlay: var(--_prism-ov-selected-hover);
      --_prism-fb: var(--_bg-selected, var(--_bg, transparent));
    }
    @media (hover: hover) {
      :host(:not(:state(disabled))) ${live}:hover {
        --_prism-state-overlay: var(--_prism-ov-hover);
        --_prism-fb: var(--_bg-hover, var(--_bg, transparent));
      }
      :host(:not(:state(disabled)))
        ${live}:hover:is(
          [aria-selected='true'],
          [aria-pressed='true'],
          [aria-checked='true'],
          :has(> :checked),
          [aria-current]:not([aria-current='false'])
        ),
      :host(:state(selected):not(:state(disabled))) ${live}:hover {
        --_prism-state-overlay: var(--_prism-ov-selected-hover);
        --_prism-fb: var(--_bg-selected, var(--_bg, transparent));
      }
    }
    :host(:not(:state(disabled))) ${live}:is(:active, [data-pressed]) {
      --_prism-state-overlay: var(--_prism-ov-pressed);
      --_prism-fb: var(--_bg-pressed, var(--_bg, transparent));
    }
  `;
}
