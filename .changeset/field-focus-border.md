---
'@glenn203/prism': minor
---

Fields (text input, password input, search input, OTP input, text area, text field and select) now turn their border the full focus colour on focus, with an inset line so it reads 2px without moving the content. The focus ring keeps its 4px reach and notch, now in the same colour at 50% (halo 12%). Invalid fields do the same from the error colour. New tokens: `--prism-color-focus-border` (the accent, the single source), `--prism-focus-ring-color`, `--prism-focus-halo-color`, `--prism-focus-ring-error-color` and `--prism-focus-halo-error-color`, all derived with `color-mix()`, so swapping the accent recolours the border, ring and halo.
