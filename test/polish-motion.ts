import type { Page } from '@playwright/test';

/**
 * Opt into polish motion for this page (press-scale, label springs, invalid
 * nudges, check-mark draw, choice squish, and the segmented indicator).
 * Sets `data-prism-polish` on the document element. Springs do not need
 * polish.css or enablePolish().
 */
export async function polishMotion(
  page: Page,
  value = 'motion',
): Promise<void> {
  await page.evaluate((v) => {
    document.documentElement.setAttribute('data-prism-polish', v);
  }, value);
}
