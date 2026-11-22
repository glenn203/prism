import eslint from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import { configs as litConfigs } from 'eslint-plugin-lit';
import { configs as wcConfigs } from 'eslint-plugin-wc';
import litA11y from 'eslint-plugin-lit-a11y';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'storybook-static',
      'test-results',
      'playwright-report',
      'custom-elements.json',
      'pw.local.config.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  litConfigs['flat/recommended'],
  wcConfigs['flat/recommended'],
  {
    plugins: { 'lit-a11y': litA11y },
    rules: litA11y.configs.recommended.rules,
  },
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', '*.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      wc: { elementBaseClasses: ['LitElement'] },
    },
    rules: {
      'wc/no-invalid-element-name': ['error', { prefix: ['prism-'] }],
      'wc/tag-name-matches-class': 'error',
      'lit/attribute-names': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.property.name=/^(setAttribute|toggleAttribute|hasAttribute|getAttribute|removeAttribute)$/] > Literal[value=/^data-(?!prism-)/]',
          message: 'Data attributes must use the data-prism- prefix.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', 'test/**'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  { files: ['**/*.js', '**/*.mjs'], ...tseslint.configs.disableTypeChecked },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
