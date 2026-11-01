---
'@glenn203/prism': minor
---

`prism-radio-group` now draws native `<input type="radio">` elements with real `<label>`s inside a `<fieldset>` with a `<legend>`, instead of buttons with `role="radio"` inside a `role="radiogroup"` div. The inputs share one shadow root and one name, so the browser gives the single tab stop, the arrow keys (skipping disabled radios; Chrome and Firefox also wrap at the ends and flip Left and Right in right-to-left text, WebKit does neither, as for any native radios) and Space, and the roving tab stop and key handling are gone. The spring dot and ring motion, reduced motion, forced colors and the 24px hit area are unchanged, and an empty `aria-describedby` is no longer written. Breaking: `prism-radio` no longer draws anything of its own; it holds the label text and the group draws it, so radios must be direct children of the group, `description` is an attribute instead of a slot, and `size` moved from the radio to the group. The radio's parts (`base`, `box`, `edge`, `ring`, `dot`) are now parts of `prism-radio-group`, joined by `control`, `option`, `option-text`, `option-label` and `option-description`, and carry `checked` and `disabled` tokens. The group's `role` is now the fieldset's own, with no `aria-invalid` (not supported on that role; the native required inputs report it), and the radio's `groupDisabled` and `tabStop` properties are gone.

Migration.

```html
<!-- Before: size on each radio, description as a slot. -->
<prism-radio-group label="Delivery speed" value="standard">
  <prism-radio value="standard" label="Standard" size="sm">
    <span slot="description">Arrives in five days</span>
  </prism-radio>
</prism-radio-group>

<!-- After: size on the group, description as an attribute. -->
<prism-radio-group label="Delivery speed" value="standard" size="sm">
  <prism-radio
    value="standard"
    label="Standard"
    description="Arrives in five days"
  ></prism-radio>
</prism-radio-group>
```

```css
/* Before: parts of each radio. */
prism-radio::part(dot) {
  background: var(--my-accent);
}

/* After: the same parts on the group. */
prism-radio-group::part(dot) {
  background: var(--my-accent);
}
```
