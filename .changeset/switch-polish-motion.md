---
'@glenn203/prism': patch
---

The switch's stretch, glint, press-grow, springs and drag now live in the polish layer: a private controller attaches to `prism-switch` inside a polish motion scope (`data-prism-polish` with `motion`, `all`, or an empty attribute), and the glint styles live in `polish.css`. The default remains a still, native checkbox switch. Public props, events and names are unchanged.
