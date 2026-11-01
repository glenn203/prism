import { test, type Page } from '@playwright/test';

/**
 * Skips a test where the browser has no `appearance: base-select` (Firefox):
 * its own select shows then, and its popup is not in the page to inspect.
 * Call it after the page is mounted.
 */
export async function needsBaseSelect(page: Page): Promise<void> {
  const supported = await page.evaluate(() =>
    CSS.supports('appearance', 'base-select'),
  );
  test.skip(
    !supported,
    'no appearance: base-select, so the browser draws its own popup',
  );
}
