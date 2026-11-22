---
'@glenn203/prism': minor
---

Naming is consistent: every `data-` attribute and public custom property the library sets uses the `prism` prefix, and the OTP field fires `prism-otp-complete` when every box is filled. Native `input`, `change` and `search` events are unchanged. The getting-started example now uses `prism-text-input` (`prism-text-field` stays as a deprecated alias until 1.0). Lint enforces the prefixes.

Breaking for anyone who styled or listened to the old names:

- `data-floating` → `data-prism-floating`
- `data-adorned` → `data-prism-adorned`
- `data-pressed` → `data-prism-pressed`
- `data-nested` → `data-prism-nested`
- `data-vertical` → `data-prism-vertical`
- `data-footer` → `data-prism-footer`
- `data-i` → `data-prism-index`
- dashboard recipe `data-dash-*` → `data-prism-dash-*`
- polish `--x` / `--y` → `--prism-pointer-x` / `--prism-pointer-y`
- OTP `complete` event → `prism-otp-complete`
