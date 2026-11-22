import type { Page } from '@playwright/test';

/**
 * Opt into polish motion for this page (press-scale, label springs, invalid
 * nudges, check-mark draw, choice squish, the segmented indicator, and the
 * switch's stretch, glint, press-grow, springs and drag).
 * Sets `data-prism-polish` on the document element. Springs do not need
 * polish.css or enablePolish(); the switch glint styles do, so this also
 * loads that sheet once.
 */
export async function polishMotion(
  page: Page,
  value = 'motion',
): Promise<void> {
  await page.evaluate((v) => {
    document.documentElement.setAttribute('data-prism-polish', v);
  }, value);
  const already = await page.evaluate(() =>
    [...document.querySelectorAll('style, link')].some((n) =>
      ((n as HTMLLinkElement).href ?? n.textContent ?? '').includes(
        'polish.css',
      ),
    ),
  );
  if (!already) await page.addStyleTag({ path: 'src/theme/polish.css' });
}
