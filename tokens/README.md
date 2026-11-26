# Prism tokens

Source: `prism.tokens.json` (W3C DTCG). Build: `pnpm tokens` →
`src/tokens/tokens.css` (exported as `prism/tokens.css`) and
`prism.tokens.resolved.json` (exported as `prism/tokens.json`, every value in px per density mode, for design files and agents). Never edit generated files.

## Naming rules

- Every CSS variable starts with `--prism-` and mirrors the token path: `control.height.md` → `--prism-control-height-md`.
- **One primitive:** `--prism-unit` = 4px (0.25rem, so it scales with user font size). Everything else is a multiple of it.
- **Numbers mean something.** `space-N` = N × 4px. `font-size-N` and `font-line-height-N` = N px. An agent can read the value from the name with no lookup table.
- **Sizes that aren't numbers are ordered:** `sm` < `md` < `lg` (control heights). Radius uses value-in-name (`radius-5` = 5px).
- **Text roles** (`text-supporting-*`, `text-large-*`, `text-body-*`, `text-label-*`, `text-heading-1-*`, `text-code-*` …) bundle size, line height, weight and family. Components should use roles; reach for the numeric scales only when no role fits.
- All line heights, spacing and control heights are multiples of 4px. Exceptions: `border-width` (1px) and the focus ring (2px offset, 3px ring, 0.5px blur); radii use their own odd-pixel ramp. Font sizes 14 and 18 sit on 2px steps; their line heights stay on 4px.
- Borders are drawn inside control heights (`box-sizing: border-box`).

## Density

Three modes: `compact`, `default`, `comfortable`. Set on any element; `default` also applies on `:root`.

```html
<main data-prism-density="comfortable">
  <table data-prism-density="compact">
    …
  </table>
</main>
```

Density only changes unit counts (leading 4/5/6, block padding 1/2/3, inline padding 2/3/4, small control height 6/8/10). `space-*` stays fixed.

| Control height | compact | default | comfortable |
| -------------- | ------- | ------- | ----------- |
| sm             | 24      | 32      | 40          |
| md             | 24      | 36      | 48          |
| lg             | 32      | 44      | 56          |

`md` = body leading + block padding × 2, and `lg` adds one more padding unit on each side. `sm` is set directly per mode (6/8/10 units), so it stays on the 4px grid and never drops below 24px (WCAG 2.2 target size). Compact `sm` equals compact `md`.

## Color

The palette is small and built around light: one hued **neutral** band (`--prism-neutral-0…950`, hue 255, low chroma, near-white to near-black with a slight hint of blue) and a refraction **spectrum** of seven hues, each with seven steps (`50 100 300 500 600 700 900`): `violet` (300, a pinker purple), `blue` (235), `cyan` (192, teal), `green` (160, mint), `amber` (78 warming to 60), `red` (12, rose; plus 800) and `magenta` (345). Default surface, text, border and control roles map to the band, so the everyday look is near black and white. Colour is reserved for meaning (error and focus). The spectral accent is an opt-in layer: load `prism/accent.css` after the tokens (and the theme, if you use it). `--prism-color-slate-*` is an alias of the same band. All values are OKLCH.

| Step | Use                                                   |
| ---- | ----------------------------------------------------- |
| 50   | Airy tint fill (text on it: 700)                      |
| 100  | Soft tint, hover wash                                 |
| 300  | Text and icons on dark                                |
| 500  | The vivid signature, gradients, solid fills in dark   |
| 600  | Solid fill with white text, borders, the light accent |
| 700  | Text on light                                         |
| 900  | Deep tint fill for dark surfaces                      |

**Display P3.** The 500, 600 and 700 steps are written beyond sRGB. `tokens.css` declares the gamut-mapped sRGB value (same lightness and hue, less chroma), then the full value in `@media (color-gamut: p3)`, then hex for engines without `oklch()`. The resolved JSON marks these colours `"gamut": "p3"` and always carries the sRGB `hex`.

**Roles.** Use these, not the ramps: `color-bg`, `-surface`, `-text`, `-text-muted`, `-border`, `-border-strong`, `-border-popup`, `-accent` (near-black / near-white by default; spectral when `accent.css` is loaded), `-on-accent`, `-accent-text`, `-accent-surface`, `-focus-ring`, `-focus-border` (the focused field's border, a meaning colour; the 50% ring and 12% halo follow it), and the tone families `-info`, `-success`, `-warning`, `-danger` (each with `-text` and `-surface`), `-neutral` and `-neutral-surface`, `-on-solid` (text on solid tone fills), `-lift` (near-white, mixed into a progress fill's left end), `-track-shadow` (the progress track's inset edge), plus the error roles (`-error`, `-error-text`, `-error-surface`, `-on-error-surface`), MessageBox roles (`-message-box-tint`, `-danger-border`), and the layout token `--prism-message-box-inset` (default 0).

**Gradients.** `--prism-gradient-spectrum` (violet to magenta), `--prism-gradient-refract` (violet through blue into cyan) and `--prism-gradient-mist` (pale tints, safe behind `color-text`). They interpolate in OKLCH where supported and fall back to a plain gradient.

**Dark theme.** Light is the default. Set `data-prism-theme="dark"` on any element, or `data-prism-theme="auto"` to follow `prefers-color-scheme`. Every role and everything built from one (focus halo, elevation, mist) is re-declared in that scope; the resolved JSON lists them under `themes.dark`. In dark the solid fills lighten and their text switches to ink.

**Contrast.** `test/tokens.test.mjs` measures every text, border, focus and fill pair in both themes, on the sRGB fallback and on the full Display P3 values (text 4.5:1, borders, focus and fills 3:1), plus every state-layer overlay. See Foundations / Color in Storybook.

## Radius

Odd-pixel ramp, value in the name: `radius-1, -3, -5, -7, -9, -11`, plus `radius-none` and `radius-full`. Radii are exempt from the 4px grid. Controls use `radius-5`.

## Focus and motion

`focus-ring-offset` (1px), `focus-ring-width` (2px), `focus-ring-blur` (0.5px), `focus-halo-width` (1px) and `focus-halo` (the focus colour at 12%); total reach is 4px, so fields use `space-1` (4px) label→control and `space-2` (8px) control→description, and the attached error text starts 6px below the control; `motion-duration-fast` (160ms), `motion-ease-out`. The theme grows a 2px box-shadow ring in on `:focus-visible` (inputs on `:focus`) and keeps a transparent outline for forced-colors mode. With `prefers-reduced-motion: reduce` the ring appears instantly.

## Elevation (shared foundation)

Three semantic levels, defined once in `prism.tokens.json` and emitted as
`--prism-elevation-*` box-shadow values. Any raised surface uses them: select
menus, popovers, dialogs, toasts, field status boxes. Components never
hard-code shadows; the theme applies these tokens through `::part()`.
Names: NAME PENDING (semantic `default/hover/urgent` chosen
over numeric `1/2/3`).

| Token                       | Use                                                            | Built from                              |
| --------------------------- | -------------------------------------------------------------- | --------------------------------------- |
| `--prism-elevation-default` | Resting raised surface (open menu, popover)                    | neutral-950, hue 255, 6% + 12%          |
| `--prism-elevation-hover`   | RESERVED, unused (option hover is a flat neutral-100/200 tint) | neutral-950, hue 255, 8% + 16%, tighter |
| `--prism-elevation-urgent`  | Error-urgent (MessageBox)                                      | red-600, hue 27, 12% + 24%              |

Related: `--prism-color-error-surface` is the flat fill for an error MessageBox
(text field and select, no shadow). Info uses `--prism-color-message-box-tint`
(a 6% neutral wash) and `--prism-color-text-muted`, with no border.
`--prism-motion-duration-medium` (200ms) drives the menu slide-down and error
reveal. Both animations are disabled under `prefers-reduced-motion`.

## Theme

`prism/theme.css` is an opt-in look built only on `::part()`, `:state()` and these tokens. Fonts (Inter, JetBrains Mono) are referenced by name and not bundled; load them in your app.
