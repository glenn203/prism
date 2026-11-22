/**
 * What a Card's restricted slots accept. The card spec ("Header slot:
 * approved parts", "Footer slot: approved parts", "Content-only cards") is the
 * source; this file only encodes it. Part names beyond the spec are
 * provisional.
 *
 * An unapproved element is NOT rendered (`data-prism-invalid` + the card CSS
 * hides it) and one `console.error` explains why. The content slot is free.
 */

export const INVALID_ATTR = 'data-prism-invalid';

/** Set to false to silence the dev errors (for example in production builds). */
export const cardDev = { errors: true };

/** What the card currently allows. Later milestones turn more of these on. */
export interface CardCapabilities {
  /** A standalone task card may hold one primary footer button. */
  standalone: boolean;
  /** Selectable cards show a Checkbox or Radio at the start (Milestone 2). */
  selectable: boolean;
  /** Draggable cards show a drag handle first (Milestone 4). */
  draggable: boolean;
  /** Widget cards may add a compact TimeRangeInput to header actions (Milestone 3). */
  widget: boolean;
}

export interface Violation {
  element: Element;
  message: string;
  /** Hide the element (default). Order problems only report. */
  hide?: boolean;
}

export type ActionsPlacement = 'header' | 'footer' | 'content';

const seen = new WeakMap<Element, Set<string>>();
/** One console.error per element and message. */
export function devError(element: Element, message: string): void {
  if (!cardDev.errors) return;
  let set = seen.get(element);
  if (!set) seen.set(element, (set = new Set()));
  if (set.has(message)) return;
  set.add(message);
  console.error(`[prism-card] ${message}`, element);
}

/** Marks violating elements, clears marks on the rest, logs once each. */
export function applyViolations(
  candidates: Iterable<Element>,
  violations: Violation[],
): void {
  const bad = new Map<Element, Violation>();
  for (const v of violations) if (!bad.has(v.element)) bad.set(v.element, v);
  for (const el of candidates) {
    const v = bad.get(el);
    if (v && v.hide !== false) el.setAttribute(INVALID_ATTR, v.message);
    else el.removeAttribute(INVALID_ATTR);
  }
  for (const v of violations) devError(v.element, v.message);
}

const tag = (el: Element): string => el.localName;
const isIcon = (el: Element): boolean =>
  tag(el) === 'prism-icon' ||
  tag(el) === 'prism-avatar' ||
  el.hasAttribute('data-prism-card-icon'); // transitional: raw svg until Icon exists
const isStatus = (el: Element): boolean =>
  tag(el) === 'prism-tag' || tag(el) === 'prism-badge';
const isLink = (el: Element): boolean =>
  tag(el) === 'a' || tag(el) === 'prism-link';

/** Direct children of the header slot. */
export function validateHeader(
  children: Element[],
  caps: CardCapabilities,
  card: Element,
): Violation[] {
  const out: Violation[] = [];
  const count = {
    title: 0,
    desc: 0,
    icon: 0,
    status: 0,
    actions: 0,
    select: 0,
  };
  const limit = (el: Element, key: keyof typeof count, what: string) => {
    if (++count[key] > 1)
      out.push({ element: el, message: `Header takes one ${what} at most.` });
  };
  for (const el of children) {
    const t = tag(el);
    if (t === 'prism-card-title') limit(el, 'title', 'CardTitle');
    else if (t === 'prism-card-description')
      limit(el, 'desc', 'CardDescription');
    else if (isIcon(el)) limit(el, 'icon', 'icon or avatar');
    else if (isStatus(el)) limit(el, 'status', 'Tag or Badge');
    else if (t === 'prism-card-actions') limit(el, 'actions', 'actions group');
    else if (t === 'prism-card-handle') {
      if (!caps.draggable)
        out.push({
          element: el,
          message: 'A drag handle is only for draggable cards.',
        });
    } else if (t === 'prism-card-select') {
      if (!caps.selectable)
        out.push({
          element: el,
          message: 'A selection control is only for selectable cards.',
        });
      else limit(el, 'select', 'selection control');
    } else
      out.push({
        element: el,
        message: `<${t}> is not an approved header part. Use CardTitle, CardDescription, an icon or avatar, a Tag or Badge, a drag handle, a selection control or CardActions.`,
      });
  }
  if (count.title === 0)
    out.push({
      element: card,
      message: 'The header slot needs a CardTitle (the card name).',
      hide: false,
    });
  return out;
}

/** Direct children of the footer slot. */
export function validateFooter(children: Element[]): Violation[] {
  const out: Violation[] = [];
  let meta = 0;
  let actions = 0;
  for (const el of children) {
    const t = tag(el);
    if (t === 'prism-card-meta') {
      if (++meta > 1)
        out.push({ element: el, message: 'Footer takes one meta at most.' });
    } else if (t === 'prism-card-actions') {
      if (++actions > 1)
        out.push({
          element: el,
          message: 'Footer takes one actions group at most.',
        });
    } else
      out.push({
        element: el,
        message: `<${t}> is not an approved footer part. Use CardMeta and CardActions.`,
      });
  }
  return out;
}

/** Direct children of a prism-card-actions group. */
export function validateActions(
  placement: ActionsPlacement,
  children: Element[],
  caps: CardCapabilities,
): Violation[] {
  const out: Violation[] = [];
  if (placement === 'header') {
    let n = 0;
    let range = 0;
    for (const el of children) {
      const t = tag(el);
      if (t === 'prism-icon-button' || t === 'prism-menu') {
        if (++n > 2)
          out.push({
            element: el,
            message: 'Header takes two actions at most.',
          });
      } else if (t === 'prism-time-range-input') {
        if (!caps.widget)
          out.push({
            element: el,
            message: 'A TimeRangeInput is only for widget cards.',
          });
        else if (++range > 1)
          out.push({ element: el, message: 'One TimeRangeInput at most.' });
      } else if (t === 'prism-button')
        out.push({
          element: el,
          message:
            'Text buttons are not allowed in the header. Use ghost icon buttons or one overflow menu.',
        });
      else
        out.push({
          element: el,
          message: `<${t}> is not an approved header action.`,
        });
    }
    return out;
  }

  let n = 0;
  let primary = 0;
  const variants: string[] = [];
  for (const el of children) {
    const t = tag(el);
    if (t === 'prism-button') {
      const v = el.getAttribute('variant') ?? 'primary';
      if (v === 'outline' || v === 'destructive') {
        out.push({
          element: el,
          message: `A ${v} button is not allowed in a card ${placement === 'footer' ? 'footer' : 'button row'}. Use ghost or secondary.`,
        });
        continue;
      }
      if (v === 'primary') {
        if (placement === 'content') {
          out.push({
            element: el,
            message:
              'A content-only card takes ghost and secondary buttons only, no primary.',
          });
          continue;
        }
        if (!caps.standalone) {
          out.push({
            element: el,
            message:
              'A footer takes a primary button only on a standalone task card (set `standalone` on the card).',
          });
          continue;
        }
        if (++primary > 1) {
          out.push({
            element: el,
            message: 'A footer takes one primary button at most.',
          });
          continue;
        }
      }
      variants.push(v);
    } else if (isLink(el) && placement === 'footer') {
      /* a "View all" link counts as one action */
    } else {
      out.push({
        element: el,
        message: `<${t}> is not an approved ${placement === 'footer' ? 'footer' : 'button row'} action. Use prism-button.`,
      });
      continue;
    }
    if (++n > 2 && placement === 'footer')
      out.push({
        element: el,
        message: 'Footer takes two actions at most.',
      });
  }
  if (placement === 'content') {
    // Page marks "at most two" with a dagger (unconfirmed): report, do not hide.
    if (variants.length > 2)
      out.push({
        element: children[0] as Element,
        message: 'A content-only card should have two buttons at most.',
        hide: false,
      });
    // Soft button on the right, ghost to its left.
    const gi = variants.indexOf('ghost');
    const si = variants.indexOf('secondary');
    if (gi > -1 && si > -1 && gi > si)
      out.push({
        element: children[0] as Element,
        message:
          'Put the ghost button before the secondary one: soft goes on the right, ghost to its left.',
        hide: false,
      });
  }
  return out;
}
