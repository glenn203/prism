import accentHref from '@glenn203/prism/accent.css?url';

const KEYS = {
  appearance: 'prism-showcase-appearance',
  accent: 'prism-showcase-accent',
  polish: 'prism-showcase-polish',
} as const;

export interface ShowcaseTheme {
  appearance: 'light' | 'dark';
  accent: boolean;
  polish: boolean;
}

const read = (): ShowcaseTheme => {
  try {
    const appearance =
      localStorage.getItem(KEYS.appearance) === 'dark' ? 'dark' : 'light';
    const accent = localStorage.getItem(KEYS.accent) !== 'off';
    const polish = localStorage.getItem(KEYS.polish) !== 'off';
    return { appearance, accent, polish };
  } catch {
    return { appearance: 'light', accent: true, polish: true };
  }
};

const write = (theme: ShowcaseTheme) => {
  try {
    localStorage.setItem(KEYS.appearance, theme.appearance);
    localStorage.setItem(KEYS.accent, theme.accent ? 'on' : 'off');
    localStorage.setItem(KEYS.polish, theme.polish ? 'on' : 'off');
  } catch {
    /* private mode */
  }
};

let accentSheet: HTMLLinkElement | null = null;

const ensureAccentSheet = (): HTMLLinkElement => {
  if (accentSheet) return accentSheet;
  const existing = document.querySelector<HTMLLinkElement>(
    'link[data-prism-accent-sheet]',
  );
  accentSheet = existing ?? document.createElement('link');
  accentSheet.rel = 'stylesheet';
  accentSheet.href = accentHref;
  accentSheet.dataset.prismAccentSheet = '';
  if (!existing) document.head.append(accentSheet);
  return accentSheet;
};

export const applyTheme = (theme: ShowcaseTheme): void => {
  document.documentElement.dataset.prismTheme = theme.appearance;
  if (theme.polish) document.documentElement.dataset.prismPolish = 'all';
  else delete document.documentElement.dataset.prismPolish;
  ensureAccentSheet().toggleAttribute('disabled', !theme.accent);
  write(theme);
};

export const getTheme = (): ShowcaseTheme => read();

export const initTheme = (): ShowcaseTheme => {
  const theme = read();
  applyTheme(theme);
  return theme;
};
