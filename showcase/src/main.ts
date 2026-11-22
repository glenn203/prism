import '@glenn203/prism/tokens.css';
import '@glenn203/prism/theme.css';
import '@glenn203/prism/polish.css';
import './styles.css';
import '@glenn203/prism/define';
import { enablePolish } from '@glenn203/prism/polish';
import { initTheme } from './theme.js';
import { accentPage } from './pages/accent.js';
import { homePage } from './pages/home.js';
import { motionPage } from './pages/motion.js';
import { polishPage } from './pages/polish.js';
import { recipesPage } from './pages/recipes.js';
import { mount } from './layout.js';

initTheme();
enablePolish();

const page = document.body.dataset.prismPage;
const view =
  page === 'polish'
    ? polishPage()
    : page === 'recipes'
      ? recipesPage()
      : page === 'accent'
        ? accentPage()
        : page === 'motion'
          ? motionPage()
          : homePage();

mount(view);
