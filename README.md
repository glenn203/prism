# Prism

Headless web components for the Prism design system, built with [Lit](https://lit.dev).

Prism gives you behavior and nothing about how it looks. Each component handles
keyboard and focus, ARIA, and form participation, and is built on the native
element it stands for. You bring the design.

## Philosophy

- **Behavior is built in.** Keyboard support, focus, ARIA wiring and form
  participation work out of the box.
- **No visual opinions.** Components ship only the structural CSS they need to
  work. No colors, sizes, fonts or spacing.
- **Style from outside.** Reach inside with `::part()`, react to `:state()`,
  and tune the few structural knobs with CSS custom properties.
- **Many small components.** Each component does one job. Shared logic lives
  in private internals, never in one component that does everything.
- **Works anywhere.** Standard custom elements, usable from plain HTML or any
  framework.

## Install

```bash
pnpm add prism lit
```

`lit` is a peer dependency.

## Usage

Register the components you use. Class files have no side effects; the
`define` entry points register the tags.

```js
import 'prism/button/define';
import 'prism/text-input/define';
// or everything at once: import 'prism/define';
```

```html
<form>
  <prism-text-input label="Email" name="email" type="email" required>
    <span slot="description">We only use this for receipts.</span>
    <span slot="error">Enter an email address.</span>
  </prism-text-input>
  <prism-button type="submit">Save</prism-button>
</form>
```

```css
prism-button::part(base) {
  padding: 0.5rem 1rem;
  border: 1px solid currentcolor;
}

prism-button:state(disabled)::part(base) {
  opacity: 0.5;
}

prism-text-input:state(invalid)::part(input) {
  border-color: red;
}
```

To register under your own tag, import the class and define it yourself:

```js
import { PrismButton } from 'prism/button';
customElements.define('lumen-button', class extends PrismButton {});
```

## Components

| Tag                | Parts                                    | States                | Slots                   |
| ------------------ | ---------------------------------------- | --------------------- | ----------------------- |
| `prism-button`     | `base`, `label`                          | `disabled`, `pressed` | default, `start`, `end` |
| `prism-text-input` | `label`, `input`, `description`, `error` | `invalid`, `disabled` | `description`, `error`  |

The full API is in `custom-elements.json`. `prism-text-field` is a
deprecated alias of `prism-text-input` and will be removed before 1.0.

## Contributing

Requires Node 20+ and pnpm.

```bash
pnpm install
pnpm exec playwright install chromium
```

| Script                 | What it does                                                    |
| ---------------------- | --------------------------------------------------------------- |
| `pnpm build`           | Compiles `src/` to `dist/` with `tsc`                           |
| `pnpm analyze`         | Writes `custom-elements.json`                                   |
| `pnpm lint`            | ESLint, stylelint, prefix check, types                          |
| `pnpm format`          | Prettier                                                        |
| `pnpm check`           | Lint, Prettier, and the token unit tests (the CI lint job)      |
| `pnpm test`            | Playwright Chromium tests                                       |
| `pnpm storybook`       | Storybook on port 6006                                          |
| `pnpm build-storybook` | Static Storybook in `storybook-static/`                         |
| `pnpm showcase`        | Theme showcase on port 4177                                     |
| `pnpm build-showcase`  | Static showcase in `showcase-static/`                           |
| `pnpm build-pages`     | Storybook at the root, showcase in `storybook-static/showcase/` |
| `pnpm changeset`       | Records a change for the next release                           |

Testing has three tiers. `pnpm check` is the fast local loop: the same lint, format, and token tests as the CI lint job. On a pull request, Chromium tests follow what changed: docs or showcase-only changes skip the browser suite (the showcase still builds); a change in one component folder runs that folder's tests; shared tokens, theme, or config run the full four-shard Chromium suite. Pushes to `main` always run the full Chromium suite. Firefox and WebKit run nightly and on demand, not after every push to `main`. A newer push on the same branch cancels an in-progress CI run, including on `main`.

The Storybook toolbar can switch light and dark, turn polish on or off, and (preview-only) change the font (Inter, Geist with Geist Mono, Figtree, Manrope, Plus Jakarta Sans, Onest). The font switcher sets `--prism-font-family-sans` on the preview root and loads the font from Google Fonts. Tokens and text styles do not change, and Inter stays the default. Stories are the neutral reference; polish is off until you turn it on.

On GitHub Pages, Storybook stays at the site root ([glenn203.github.io/prism](https://glenn203.github.io/prism/)) and the theme showcase is at [`/showcase`](https://glenn203.github.io/prism/showcase/). The showcase uses the built package, loads tokens, `theme.css`, `accent.css` and polish, and has a switcher for a neutral default vs the spectral accent, light and dark, and polish on or off.

Add a changeset with every change that affects the published package.

## License

[Apache-2.0](./LICENSE) © 2026 Chuck Bolton
