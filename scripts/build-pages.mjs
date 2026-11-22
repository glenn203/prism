/**
 * Build Storybook at the Pages root and the theme showcase at /showcase.
 * The combined artifact lives in storybook-static/.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const run = (args, env = {}) => {
  const result = spawnSync('pnpm', args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (!existsSync('dist/define.js')) run(['build']);

run(['build-storybook'], {
  STORYBOOK_BASE: process.env.STORYBOOK_BASE ?? '/prism/',
});
run(['build-showcase'], {
  SHOWCASE_BASE: process.env.SHOWCASE_BASE ?? '/prism/showcase/',
});

const dest = join(process.cwd(), 'storybook-static', 'showcase');
mkdirSync(dest, { recursive: true });
cpSync(join(process.cwd(), 'showcase-static'), dest, { recursive: true });
console.log(
  'build-pages: Storybook at storybook-static/, showcase at storybook-static/showcase/',
);
