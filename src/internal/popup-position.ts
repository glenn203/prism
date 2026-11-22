/**
 * Shared placement for a popup under its trigger: a small gap, flip above
 * when there is no room below, and either the same width as the field
 * (left-aligned) or start/end alignment. Select uses the CSS-anchor form of
 * these rules on `::picker(select)`; this is the JS fallback for popovers,
 * and the viewport clamp is also applied after anchors.
 */
export type PopupAlign = 'start' | 'end';

const VIEW_MARGIN = 4;
const GAP = 4;

export const canAnchorPopup = (): boolean =>
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('top: anchor(bottom)');

/** Shift a positioned popup just enough to stay inside the viewport. */
export const clampPopupToViewport = (popup: HTMLElement): void => {
  const box = popup.getBoundingClientRect();
  const left = Math.max(
    VIEW_MARGIN,
    Math.min(box.left, innerWidth - box.width - VIEW_MARGIN),
  );
  let top = box.top;
  if (top + box.height > innerHeight - VIEW_MARGIN)
    top = Math.max(VIEW_MARGIN, innerHeight - box.height - VIEW_MARGIN);
  if (top < VIEW_MARGIN) top = VIEW_MARGIN;
  if (left === box.left && top === box.top) return;
  popup.style.right = 'auto';
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
};

export const positionPopup = (
  popup: HTMLElement,
  trigger: HTMLElement,
  options?: { gap?: number; align?: PopupAlign; matchWidth?: boolean },
): void => {
  const gap = options?.gap ?? GAP;
  const align = options?.align ?? 'start';
  const t = trigger.getBoundingClientRect();
  if (options?.matchWidth) popup.style.inlineSize = `${t.width}px`;
  const width = options?.matchWidth
    ? t.width
    : popup.getBoundingClientRect().width;
  const height = popup.getBoundingClientRect().height;
  const rtl = getComputedStyle(trigger).direction === 'rtl';
  const alignEnd = (align === 'end') !== rtl;
  const left = options?.matchWidth || !alignEnd ? t.left : t.right - width;
  let top = t.bottom + gap;
  if (
    top + height > innerHeight - VIEW_MARGIN &&
    t.top - gap - height >= VIEW_MARGIN
  )
    top = t.top - gap - height;
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  clampPopupToViewport(popup);
};
