---
'@glenn203/prism': minor
---

`prism-checkbox` is now a native `<input type="checkbox">` with a real `<label>` instead of a `<button role="checkbox">`. Space, label clicks, focus order, disabled and the mixed state come from the browser, and the key handling, `aria-checked` and `aria-labelledby` are gone. The draw, squish, reduced-motion and forced-colors behaviour is unchanged, and the 24px hit area stays. Breaking: the `base` part is now the input (invisible, it carries the focus ring) and a new `control` part wraps it and the drawn box; the state layer and its `--_bg` and `--_on` hooks move from `base` to `control`. A click on a box that is both checked and indeterminate now unchecks it, as on a native checkbox.

Migration. The markup does not change; styles that reach into the parts do.

```css
/* Before: the state layer hooks were set on the button. */
prism-checkbox::part(base) {
  --_bg: transparent;
  --_on: var(--my-text);
}

/* After: they are set on the control that wraps the native input. */
prism-checkbox::part(control) {
  --_bg: transparent;
  --_on: var(--my-text);
}
```

```js
// Before: the control was a button with a role.
checkbox.shadowRoot
  .querySelector('[role="checkbox"]')
  .getAttribute('aria-checked');
// After: it is a native input.
checkbox.shadowRoot.querySelector('input[type="checkbox"]').checked;
```
