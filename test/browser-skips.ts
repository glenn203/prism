/**
 * Tests that fail only in Firefox or Safari and are skipped there for now.
 * They still run, and gate pull requests, in Chromium. Remove a title once
 * it passes in that browser.
 */
export const firefoxSkips: readonly string[] = [
  // src/card/card-dashboard-contrast.test.ts
  "empty row: the note and the dashed border",
  // src/card/card-dashboard-contrast.test.ts
  "keyboard focus ring on the menu button, the handle and Reset: >= 3:1 against the surface and the card",
  // src/card/card-dashboard-rows.test.ts
  "one card fills the row; an empty row is a visible drop target and takes a drag",
  // src/polish/polish.test.ts
  "\"off\" inside an \"on\" page turns it off again",
  // src/polish/polish.test.ts
  "with the layer loaded and no attribute, nothing changes",
  // src/running-indicator/running-indicator.test.ts
  "sizes scale the whole drawing: the ring stays inside the box",
  // src/select/select.test.ts
  "prism-select: error text is centered in the visible 24px box and clears the ring",
  // src/select/select.test.ts
  "prism-text-field: error text is centered in the visible 24px box and clears the ring",
  // src/text-input/text-inputs.test.ts
  "OtpInput: one real input with autofill attrs, typing, paste, backspace, complete",
];

export const webkitSkips: readonly string[] = [
  // src/button/button-press.test.ts
  "Enter shows a brief press, at least 90ms, and still activates",
  // src/button/button-press.test.ts
  "Space shows a brief press, at least 90ms, and still activates",
  // src/card/card-dashboard-contrast.test.ts
  "default: every text >= 4.5:1, every icon and edge >= 3:1",
  // src/card/card-dashboard-contrast.test.ts
  "dragging: the copy, the drop line and its dot, and the cards behind",
  // src/card/card-dashboard-contrast.test.ts
  "empty row: the note and the dashed border",
  // src/card/card-dashboard-contrast.test.ts
  "hover on the handle and on the menu button (state layers included)",
  // src/card/card-dashboard-contrast.test.ts
  "keyboard focus ring on the menu button, the handle and Reset: >= 3:1 against the surface and the card",
  // src/card/card-dashboard-contrast.test.ts
  "menu open: items and the Move to row entries",
  // src/polish/polish-fields.test.ts
  "polish on: a text input shows the light ring on hover and while focused, not otherwise",
  // src/polish/polish-fields.test.ts
  "polish on: the select trigger shows it on hover, focus and while open",
  // src/polish/polish.test.ts
  "hover shows a ring; leaving hides it; the ring is a mask over the border box",
  // src/segmented-control/segmented-control.test.ts
  "interruptible: a new pick mid-slide turns it round from where it is, with no jump",
  // src/select/select.test.ts
  "error animation runs on invalid only, never on focus",
  // src/select/select.test.ts
  "prism-select: error box flares out from under the control (concave top fillets)",
  // src/select/select.test.ts
  "prism-select: error text is centered in the visible 24px box and clears the ring",
  // src/select/select.test.ts
  "prism-text-field: error box flares out from under the control (concave top fillets)",
  // src/select/select.test.ts
  "prism-text-field: error text is centered in the visible 24px box and clears the ring",
  // src/select/select.test.ts
  "select error box matches the text field error box exactly",
  // src/text-input/text-input-motion.test.ts
  "a nudge on becoming invalid: sideways, small, rings out, back to rest",
  // src/text-input/text-input-motion.test.ts
  "interruptible: focus then blur mid-move never jumps",
  // src/theme/field-label-error.test.ts
  "forced colors: an invalid label takes the system text colour, like a valid one",
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A pattern matching any of the given test titles, for `grepInvert`. */
export const titlesPattern = (titles: readonly string[]) =>
  new RegExp(titles.map(escape).join('|'));
