---
'@glenn203/prism': minor
---

The segmented control's indicator now settles in about 325ms. The time comes from the new token `--prism-motion-segmented` (325ms), and `--prism-segmented-duration` sets it for one control; the springs' frequencies scale to it. Reduced motion is unchanged: the indicator still jumps, and the token collapses to near zero like the other motion tokens.

```css
/* Before: fixed by the springs, about 350ms */
/* After: 325ms by default, and tunable */
prism-segmented-control {
  --prism-segmented-duration: 450ms;
}
```
