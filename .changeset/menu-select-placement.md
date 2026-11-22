---
'@glenn203/prism': patch
---

`prism-select`'s list sits under the field like a traditional dropdown: the same width, left-aligned, with a small gap, flipping above only when there is no room below. `prism-menu` uses `popover="auto"` for light dismiss and the same placement rules (CSS anchor, with a JS fallback and a viewport clamp). The menu hides its popover before `prism-menu-select` fires, so a listener can move the host without leaving the menu open.
