/**
 * Private. Whether an element sits under a `data-prism-polish` scope that
 * includes a named effect. An empty attribute or `all` turns every effect on;
 * `off` or `none` on the nearest ancestor turns the layer off again.
 */
export type PolishEffect = 'squircle' | 'light' | 'tilt' | 'motion';

export function hasPolishEffect(el: Element, effect: PolishEffect): boolean {
  const scope = el.closest('[data-prism-polish]');
  if (!scope) return false;
  const words = (scope.getAttribute('data-prism-polish') ?? '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.includes('off') || words.includes('none')) return false;
  return words.length === 0 || words.includes('all') || words.includes(effect);
}
