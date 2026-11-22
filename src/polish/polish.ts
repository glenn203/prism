/**
 * Pointer handler for the opt-in polish layer (`prism/polish.css`).
 *
 * Call `enablePolish()` once. It listens for the pointer on the document and,
 * for the Prism buttons, cards, text fields and selects under it:
 *
 * - writes the pointer's place inside the element as `--prism-pointer-x` and `--prism-pointer-y` (pixels
 *   from its top-left), which the light-following border reads;
 * - on a card inside a `data-prism-polish` scope that includes `tilt`, sets
 *   `data-prism-tilting` and writes `--prism-polish-nx` and `--prism-polish-ny`
 *   (-1 to 1), which the card tilt reads.
 *
 * Work is done once per animation frame from the latest pointer position and
 * writes custom properties only (no layout reads beyond one bounding box per
 * element). Touch pointers are ignored, and so is everything under
 * `prefers-reduced-motion: reduce`. It returns a function that turns it off and
 * clears what it wrote.
 */
const TARGETS =
  'prism-button, prism-card, prism-text-input, prism-password-input, prism-search-input, prism-text-field, prism-select';

const hasTilt = (el: Element): boolean => {
  const scope = el.closest('[data-prism-polish]');
  if (!scope) return false;
  const words = (scope.getAttribute('data-prism-polish') ?? '')
    .split(/\s+/)
    .filter(Boolean);
  return words.length === 0 || words.includes('all') || words.includes('tilt');
};

export function enablePolish(doc: Document = document): () => void {
  const win = doc.defaultView;
  if (!win) return () => undefined;
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');

  let frame = 0;
  let point: { x: number; y: number; targets: HTMLElement[] } | null = null;
  let active = new Set<HTMLElement>();

  const clear = (el: HTMLElement) => {
    if (el.hasAttribute('data-prism-tilting')) {
      el.removeAttribute('data-prism-tilting');
      el.style.removeProperty('--prism-polish-nx');
      el.style.removeProperty('--prism-polish-ny');
    }
  };
  const clearAll = () => {
    active.forEach(clear);
    active = new Set();
    point = null;
  };

  const paint = () => {
    frame = 0;
    if (!point) return;
    const { x, y, targets } = point;
    const next = new Set<HTMLElement>(targets);
    for (const el of active) if (!next.has(el)) clear(el);
    for (const el of targets) {
      // A field's light sits on its control (or trigger), not the label above.
      const box =
        el.shadowRoot?.querySelector('[part="control"], [part="trigger"]') ??
        el;
      const r = box.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const px = x - r.left;
      const py = y - r.top;
      el.style.setProperty(
        '--prism-pointer-x',
        `${Math.round(px * 10) / 10}px`,
      );
      el.style.setProperty(
        '--prism-pointer-y',
        `${Math.round(py * 10) / 10}px`,
      );
      if (el.localName === 'prism-card' && hasTilt(el)) {
        const nx = Math.max(-1, Math.min(1, (px / r.width) * 2 - 1));
        const ny = Math.max(-1, Math.min(1, (py / r.height) * 2 - 1));
        el.style.setProperty('--prism-polish-nx', nx.toFixed(3));
        el.style.setProperty('--prism-polish-ny', ny.toFixed(3));
        el.setAttribute('data-prism-tilting', '');
      }
    }
    active = next;
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || reduced.matches) {
      if (active.size) clearAll();
      return;
    }
    const targets = e
      .composedPath()
      .filter(
        (n): n is HTMLElement => n instanceof HTMLElement && n.matches(TARGETS),
      );
    point = { x: e.clientX, y: e.clientY, targets };
    if (!frame) frame = win.requestAnimationFrame(paint);
  };
  const onLeave = () => {
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    clearAll();
  };

  doc.addEventListener('pointermove', onMove, { passive: true });
  doc.documentElement.addEventListener('pointerleave', onLeave);
  doc.addEventListener('pointercancel', onLeave);
  reduced.addEventListener('change', onLeave);

  return () => {
    doc.removeEventListener('pointermove', onMove);
    doc.documentElement.removeEventListener('pointerleave', onLeave);
    doc.removeEventListener('pointercancel', onLeave);
    reduced.removeEventListener('change', onLeave);
    onLeave();
  };
}
