import { html, render, type TemplateResult } from 'lit';
import { applyTheme, getTheme, type ShowcaseTheme } from './theme.js';

export type ShowcasePage =
  'home' | 'polish' | 'recipes' | 'accent' | 'motion' | 'message-box';

const PAGES: { id: ShowcasePage; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'polish', label: 'Polish' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'accent', label: 'Accent' },
  { id: 'motion', label: 'Motion' },
  { id: 'message-box', label: 'MessageBox' },
];

export const baseUrl = import.meta.env.BASE_URL;
export const href = (page: ShowcasePage): string =>
  page === 'home' ? baseUrl : `${baseUrl}${page}/`;
export const storybookHref = baseUrl.replace(/showcase\/?$/, '') || '../';

const currentPage = (): ShowcasePage => {
  const value = document.body.dataset.prismPage;
  return PAGES.some((p) => p.id === value) ? (value as ShowcasePage) : 'home';
};

const switcher = (theme: ShowcaseTheme) =>
  html`<div class="theme-switcher" role="group" aria-label="Theme">
    <div class="group">
      <prism-segmented-control
        label="Accent"
        hide-label
        value=${theme.accent ? 'accent' : 'neutral'}
        @change=${(e: Event) => {
          const value = (e.target as HTMLElement & { value: string }).value;
          applyTheme({ ...getTheme(), accent: value === 'accent' });
        }}
      >
        <prism-segment value="neutral">Neutral</prism-segment>
        <prism-segment value="accent">Accent</prism-segment>
      </prism-segmented-control>
    </div>
    <div class="group">
      <prism-segmented-control
        label="Appearance"
        hide-label
        value=${theme.appearance}
        @change=${(e: Event) => {
          const value = (e.target as HTMLElement & { value: string }).value;
          applyTheme({
            ...getTheme(),
            appearance: value === 'dark' ? 'dark' : 'light',
          });
        }}
      >
        <prism-segment value="light">Light</prism-segment>
        <prism-segment value="dark">Dark</prism-segment>
      </prism-segmented-control>
    </div>
    <div class="group">
      <span>Polish</span>
      <prism-switch
        label="Polish"
        hide-label
        ?checked=${theme.polish}
        @change=${(e: Event) => {
          const on = (e.target as HTMLElement & { checked: boolean }).checked;
          applyTheme({ ...getTheme(), polish: on });
        }}
      ></prism-switch>
    </div>
  </div>`;

export const shell = (page: ShowcasePage, body: TemplateResult) => html`
  <header class="site-header">
    <a class="site-brand" href=${href('home')}>Prism showcase</a>
    <nav class="site-nav" aria-label="Showcase">
      ${PAGES.map(
        (item) =>
          html`<a
            href=${href(item.id)}
            aria-current=${item.id === page ? 'page' : undefined}
            >${item.label}</a
          >`,
      )}
    </nav>
    ${switcher(getTheme())}
  </header>
  <main class="site-main">${body}</main>
  <footer class="site-footer">
    The
    <a href=${storybookHref}>Storybook</a>
    is the neutral component reference. This showcase is the opt-in look: theme,
    spectral accent and polish.
  </footer>
`;

export const mount = (body: TemplateResult): void => {
  const root = document.getElementById('app');
  if (!root) return;
  render(shell(currentPage(), body), root);
};
