import { html } from 'lit';
import { recipes } from '../recipes.js';

export const recipesPage = () => html`
  <div class="page-head">
    <h1>Card recipes</h1>
    <p>
      Eight composed screens built only from the library's cards, tags, inputs
      and lists. Every name, number and date is made up.
    </p>
  </div>
  <div class="stack">${recipes.map((recipe) => recipe())}</div>
`;
