/** @type {import('stylelint').Config} */
export default {
  rules: {
    'custom-property-pattern': [
      '^((_|_prism-|prism-)[a-z0-9-]+)$',
      {
        message:
          'Expected custom property to be --prism-*, --_*, or --_prism-*',
      },
    ],
    'declaration-no-important': true,
  },
};
