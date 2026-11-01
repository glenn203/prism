---
'@glenn203/prism': minor
---

`prism-segmented-control` now draws a native `<input type="radio">` inside a real `<label>` for each segment, in a `<fieldset>` with a `<legend>`, instead of buttons with `role="radio"` inside a `role="radiogroup"` div. The inputs share one shadow root and one name, so the browser gives the single tab stop, the arrow keys (skipping disabled segments; Chrome and Firefox also wrap at the ends and flip Left and Right in right-to-left text, WebKit does neither, as for any native radios) and Space, and the roving tab stop and key handling are gone. The sliding indicator and its springs, the press, reduced motion, forced colors and the inset focus ring are unchanged, and an icon-only segment is still named by `label`, now read from visually hidden text inside the segment, so a segment with visible text is named by that text and `label` is not used. Breaking: Home and End no longer move between segments, as on native radios. `prism-segment` no longer draws anything of its own; it holds the text and icon and the control draws it, so segments must be direct children of the control, and the segment's `groupDisabled` and `tabStop` properties, its `base` part and the `prism-segment-select` event are gone. The segment's colors and press now belong to the control's new `segment` part (a label that carries `checked` and `disabled` tokens) and `base` part (the native input and its focus ring), so themes target `prism-segmented-control::part(segment checked)` instead of `prism-segment::part(base)`. The control's `group` part is now a fieldset (without `aria-invalid`, which that role does not support; the native required inputs report it) and its `label` part a legend.

Migration.

```html
<!-- Before and after: the markup is the same. -->
<prism-segmented-control label="Range" value="week">
  <prism-segment value="day">Day</prism-segment>
  <prism-segment value="week">Week</prism-segment>
</prism-segmented-control>
```

```css
/* Before: styles reached the segment's button. */
prism-segment:state(checked)::part(base) {
  --_on: var(--my-on-accent);
}

/* After: they reach the control's segment part, which carries the tokens. */
prism-segmented-control::part(segment checked) {
  --_on: var(--my-on-accent);
}
```
