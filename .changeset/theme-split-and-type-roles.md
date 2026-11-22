---
'@glenn203/prism': patch
---

Split the default theme into field chrome (`theme-fields.css`) and per-component look (`theme-components.css`), still shipped as one `theme.css`. Components now size type from typography role tokens (`--prism-text-*-font-size`) instead of raw `--prism-font-size-*`; token values are unchanged. Drop a redundant `!important` on single-column card lists.
