---
'@glenn203/prism': minor
---

`prism-checkbox` is now a native `<input type="checkbox">` with a real `<label>` instead of a `<button role="checkbox">`. Space, label clicks, focus order, disabled and the mixed state come from the browser, and the key handling, `aria-checked` and `aria-labelledby` are gone. The draw, squish, reduced-motion and forced-colors behaviour is unchanged, and the 24px hit area stays. Breaking: the `base` part is now the input (invisible, it carries the focus ring) and a new `control` part wraps it and the drawn box; the state layer and its `--_bg` and `--_on` hooks move from `base` to `control`. A click on a box that is both checked and indeterminate now unchecks it, as on a native checkbox.
