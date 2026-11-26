import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const dist = fileURLToPath(new URL('../dist', import.meta.url));
const page = (file: string) => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  root,
  base: process.env.SHOWCASE_BASE ?? '/prism/showcase/',
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL('../showcase-static', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: page('index.html'),
        polish: page('polish/index.html'),
        recipes: page('recipes/index.html'),
        accent: page('accent/index.html'),
        motion: page('motion/index.html'),
        'message-box': page('message-box/index.html'),
      },
    },
  },
  resolve: {
    alias: [
      {
        find: '@glenn203/prism/tokens.css',
        replacement: `${dist}/tokens/tokens.css`,
      },
      {
        find: '@glenn203/prism/theme.css',
        replacement: `${dist}/theme/theme.css`,
      },
      {
        find: '@glenn203/prism/accent.css',
        replacement: `${dist}/theme/theme-accent.css`,
      },
      {
        find: '@glenn203/prism/polish.css',
        replacement: `${dist}/theme/polish.css`,
      },
      {
        find: '@glenn203/prism/polish',
        replacement: `${dist}/polish/polish.js`,
      },
      {
        find: '@glenn203/prism/define',
        replacement: `${dist}/define.js`,
      },
      {
        find: /^@glenn203\/prism$/,
        replacement: `${dist}/index.js`,
      },
    ],
  },
});
