import type { Preview } from '@storybook/web-components';
import '../src/tokens/tokens.css';
import '../src/theme/theme.css';
import '../src/theme/polish.css';
import './preview.css';
import '../src/define.js';
import { DEFAULT_FONT, FONTS, applyFont } from './fonts.js';
import { enablePolish } from '../src/polish/polish.js';

// Pointer effects for the opt-in polish layer. They only act where the
// `data-prism-polish` attribute is set (the toolbar below).
enablePolish();

const preview: Preview = {
  // Toolbar: preview-only font. Sets the font-family variable on the preview
  // root; tokens and text styles are unchanged. Inter is the default.
  globalTypes: {
    theme: {
      description: 'Color theme (sets data-prism-theme on the preview root)',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        dynamicTitle: true,
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
          { value: 'auto', title: 'Auto (system)' },
        ],
      },
    },
    polish: {
      description:
        'Polish (opt-in layer): squircle corners, light-following border, card tilt, and motion. Sets data-prism-polish on the preview root.',
      toolbar: {
        title: 'Polish',
        icon: 'sparkles',
        dynamicTitle: true,
        items: [
          { value: 'off', title: 'Polish: off' },
          { value: 'all', title: 'Polish: all' },
          { value: 'squircle', title: 'Squircle corners only' },
          { value: 'light', title: 'Light border only' },
          { value: 'tilt', title: 'Card tilt only' },
          { value: 'motion', title: 'Motion only' },
        ],
      },
    },
    font: {
      description: 'Preview font (docs only; the package ships no fonts)',
      toolbar: {
        title: 'Font',
        icon: 'paintbrush',
        dynamicTitle: true,
        items: FONTS.map((f) => ({ value: f.name, title: f.name })),
      },
    },
  },
  initialGlobals: { font: DEFAULT_FONT, theme: 'light', polish: 'off' },
  decorators: [
    (story, context) => {
      document.documentElement.dataset['prismTheme'] = String(
        context.globals['theme'] ?? 'light',
      );
      const polish = String(context.globals['polish'] ?? 'off');
      if (polish === 'off')
        delete document.documentElement.dataset['prismPolish'];
      else document.documentElement.dataset['prismPolish'] = polish;
      applyFont(
        String(context.globals['font'] ?? DEFAULT_FONT),
        document.documentElement,
      );
      return story();
    },
  ],
  tags: ['autodocs'],
  parameters: {
    a11y: { test: 'error' },
    controls: { expanded: true },
    layout: 'padded',
    options: {
      storySort: {
        order: ['Introduction', 'Foundations', 'Components'],
      },
    },
  },
};

export default preview;
