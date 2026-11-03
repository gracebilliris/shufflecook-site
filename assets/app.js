import { recipes, pantryIngredients } from './recipes.js';
import { findMatches, shuffleMatch, buildShoppingList, loadState, saveState } from './engine.js';

const $ = (id) => document.getElementById(id);
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const storageWarning = $('storage-warning');
let storage = null;
try {
  storage = window.localStorage;
  storage.getItem('');
} catch {
  showStorageWarning();
}
let state;
try {
  state = loadState(storage);
} catch {
  state = { pantry: [], favourites: [], shoppingRecipes: [], checked: [] };
  showStorageWarning();
}
let matches = [];
let previousShuffleId = null;
let pickedId = null;
let activeRecipeId = null;
let dialogOpener = null;
let visibleRecipeCount = 4;
let previousFilters = '';
const pantryMedia = window.matchMedia('(max-width: 580px)');
$('pantry-controls').open = !pantryMedia.matches;
pantryMedia.addEventListener('change', event => { $('pantry-controls').open = !event.matches; });

function showStorageWarning() {
  storageWarning.hidden = false;
  storageWarning.textContent = 'Your browser couldn’t save or restore your kitchen. You can still use everything, but changes may be lost when you leave. Allow browser storage to keep your pantry, favourites and list.';
}

function persist() {
  try {
    if (!storage || !saveState(storage, state)) {
      showStorageWarning();
      return;
    }
    storageWarning.hidden = true;
  } catch {
    showStorageWarning();
  }
}

function announce(message) {
  $('app-status').textContent = message;
}

function currentFilters() {
  return {
    pantry: state.pantry,
    diet: $('diet-filter').value,
    maxMinutes: Number($('time-filter').value),
    search: $('recipe-search').value.trim(),
    favouritesOnly: $('favourites-only').checked,
    favourites: state.favourites,
  };
}

function createPantry() {
  $('ingredient-chips').innerHTML = pantryIngredients.map((name) =>
    `<button class="ingredient-chip" type="button" data-ingredient="${escapeHTML(name)}" aria-pressed="false" aria-label="${escapeHTML(name)}">${escapeHTML(name)}<span class="chip-check" aria-hidden="true"></span></button>`
  ).join('');
  updatePantry();
}

function updatePantry() {
  const search = $('ingredient-search').value.trim().toLocaleLowerCase();
  let visible = 0;
  for (const chip of $('ingredient-chips').children) {
    const selected = state.pantry.includes(chip.dataset.ingredient);
    chip.setAttribute('aria-pressed', String(selected));
    chip.querySelector('.chip-check').textContent = selected ? '✓' : '+';
    chip.hidden = !chip.dataset.ingredient.toLocaleLowerCase().includes(search);
    if (!chip.hidden) visible += 1;
  }
  $('pantry-count').textContent = state.pantry.length;
  $('pantry-summary').textContent = state.pantry.length
    ? `${state.pantry.length} ${state.pantry.length === 1 ? 'ingredient' : 'ingredients'} selected · adjust your matches`
    : 'Optional · browse all recipes below';
  $('clear-pantry').disabled = state.pantry.length === 0;
  $('ingredient-empty').hidden = visible > 0;
}

function ingredientNames(ingredients) {
  return ingredients.map(({ name }) => escapeHTML(name)).join(', ');
}

function cardTemplate({ recipe, available, missing }) {
  const favourite = state.favourites.includes(recipe.id);
  const inList = state.shoppingRecipes.includes(recipe.id);
  const picked = pickedId === recipe.id;
  return `<article class="recipe-card${picked ? ' is-pick' : ''}" data-recipe-id="${escapeHTML(recipe.id)}" tabindex="-1" aria-label="${escapeHTML(recipe.title)}">
    <div class="card-art">
      <img src="../assets/food-art.svg" alt="" width="235" height="160" loading="lazy">
      <span class="illustration-label">A LITTLE SERVING INSPIRATION</span>
      ${picked ? '<span class="pick-label">TONIGHT’S PICK</span>' : ''}
      <button class="favourite-button" type="button" data-action="favourite" data-id="${escapeHTML(recipe.id)}" aria-label="${favourite ? 'Remove' : 'Save'} ${escapeHTML(recipe.title)} ${favourite ? 'from' : 'to'} favourites" aria-pressed="${favourite}"><span aria-hidden="true">${favourite ? '♥' : '♡'}</span></button>
    </div>
    <div class="card-body">
      <div class="recipe-meta"><span>${escapeHTML(recipe.minutes)} min</span><span aria-hidden="true">·</span><span>Serves ${escapeHTML(recipe.servings)}</span></div>
      <h3>${escapeHTML(recipe.title)}</h3>
      <p class="recipe-description">${escapeHTML(recipe.description)}</p>
      <div class="recipe-tags">${recipe.tags.map((tag) => `<span class="recipe-tag">${escapeHTML(tag)}</span>`).join('')}</div>
      <div class="pantry-match">
        <p class="match-label">${available.length} of ${recipe.ingredients.length} ingredients in your pantry${missing.length === 0 ? ' · Ready to cook!' : ''}</p>
        <p class="ingredients-preview"><strong>You have:</strong> ${available.length ? ingredientNames(available) : 'None selected yet'}</p>
        <p class="ingredients-preview"><strong>You need:</strong> ${missing.length ? ingredientNames(missing) : 'Nothing — you’re all set'}</p>
      </div>
      <div class="card-actions">
        <button class="button button-outline" type="button" data-action="view" data-id="${escapeHTML(recipe.id)}" aria-label="View recipe for ${escapeHTML(recipe.title)}">Let’s cook <span aria-hidden="true">↗</span></button>
        <button class="add-shopping" type="button" data-action="shopping" data-id="${escapeHTML(recipe.id)}" ${inList || !missing.length ? 'disabled' : ''} aria-label="Add missing ingredients for ${escapeHTML(recipe.title)} to shopping list">${inList ? '✓ On your list' : !missing.length ? '✓ Pantry ready' : '+ Add missing'}</button>
      </div>
    </div>
  </article>`;
}

function renderRecipes() {
  // Only the results are replaced: typing never replaces the focused filter input.
  const filters = currentFilters();
  const filterKey = JSON.stringify({ ...filters, favourites: filters.favouritesOnly ? filters.favourites : [] });
  if (filterKey !== previousFilters) {
    visibleRecipeCount = 4;
    previousFilters = filterKey;
    announce('');
  }
  matches = findMatches(recipes, filters);
  if (!matches.some(({ recipe }) => recipe.id === pickedId)) pickedId = null;
  $('results-count').textContent = `${matches.length} ${matches.length === 1 ? 'recipe' : 'recipes'}${state.pantry.length ? ' for your pantry' : ' to explore'}`;
  $('shuffle').disabled = matches.length === 0;
  const ordered = pickedId ? [...matches.filter(({ recipe }) => recipe.id === pickedId), ...matches.filter(({ recipe }) => recipe.id !== pickedId)] : matches;
  $('recipe-grid').innerHTML = ordered.slice(0, visibleRecipeCount).map(cardTemplate).join('');
  $('recipes-shown').textContent = matches.length ? `Showing ${Math.min(visibleRecipeCount, matches.length)} of ${matches.length} recipes` : '';
  $('recipe-more').hidden = visibleRecipeCount >= matches.length;
  $('recipe-more').textContent = `Show ${Math.min(4, Math.max(0, matches.length - visibleRecipeCount))} more recipes`;
  $('recipe-empty').hidden = matches.length > 0;
  if (!matches.length) {
    const favouritesOnly = $('favourites-only').checked;
    const noFavourites = favouritesOnly && !state.favourites.length;
    $('recipe-empty').innerHTML = `<span class="empty-icon" aria-hidden="true">${favouritesOnly ? '♡' : '✳'}</span>
      <h3>${noFavourites ? 'A place for your favourites.' : 'A fresh start, perhaps?'}</h3>
      <p>${noFavourites ? 'Tap the heart on any recipe to save it here. Your next go-to is waiting to be found.' : favouritesOnly ? 'No saved recipes fit these filters. Try another ingredient, a little more time, or explore all recipes.' : 'No recipes fit this combination just yet. Try fewer filters or different pantry ingredients.'}</p>
      <button class="button button-green" type="button" data-action="reset-filters">Explore all recipes</button>`;
  }
}

function renderShopping() {
  const selectedRecipes = recipes.filter((recipe) => state.shoppingRecipes.includes(recipe.id));
  const items = buildShoppingList(recipes, state.shoppingRecipes, state.pantry, state.checked);
  $('shopping-badge').textContent = items.filter((item) => !item.checked).length;
  $('shopping-badge').setAttribute('aria-label', `${items.filter((item) => !item.checked).length} unchecked shopping ingredients`);
  $('clear-shopping').disabled = !state.shoppingRecipes.length && !state.checked.length;
  $('shopping-recipes').innerHTML = selectedRecipes.map((recipe) =>
    `<span class="shopping-recipe">${escapeHTML(recipe.title)}<button type="button" data-remove-recipe="${escapeHTML(recipe.id)}" aria-label="Remove ${escapeHTML(recipe.title)} from shopping list">×</button></span>`
  ).join('');
  $('shopping-list').innerHTML = items.map((item, index) => {
    const amounts = selectedRecipes.flatMap((recipe) => recipe.ingredients
      .filter(({ name }) => name === item.name)
      .map(({ quantity }) => `<small>${escapeHTML(recipe.title)}: ${escapeHTML(quantity)}</small>`));
    return `<label class="shopping-item" for="shopping-item-${index}"><input id="shopping-item-${index}" type="checkbox" data-shopping-ingredient="${escapeHTML(item.name)}" ${item.checked ? 'checked' : ''}><span><strong>${escapeHTML(item.name)}</strong>${amounts.join('')}</span></label>`;
  }).join('');
  $('shopping-empty').hidden = items.length > 0;
  if (!items.length) {
    $('shopping-empty').innerHTML = `<span aria-hidden="true">${selectedRecipes.length ? '✓' : '♧'}</span><div><h3>${selectedRecipes.length ? 'Your pantry has it covered.' : 'Good things start with a little list.'}</h3><p>${selectedRecipes.length ? 'You already have all the ingredients for the recipes on your list. Time to get cooking.' : 'Add missing ingredients from a recipe. We’ll take it from there.'}</p></div>`;
  }
}

function refreshSavedViews() {
  updatePantry();
  renderRecipes();
  renderShopping();
}

function addShopping(id) {
  if (state.shoppingRecipes.includes(id)) return;
  state.shoppingRecipes.push(id);
  persist();
  renderRecipes();
  renderShopping();
  const recipe = recipes.find((item) => item.id === id);
  announce(`Missing ingredients for ${recipe.title} added to your shopping list.`);
  if ($('recipe-dialog').open) updateDialogActions(recipe);
}

function toggleFavourite(id) {
  state.favourites = state.favourites.includes(id)
    ? state.favourites.filter((item) => item !== id)
    : [...state.favourites, id];
  persist();
  renderRecipes();
  const recipe = recipes.find((item) => item.id === id);
  announce(`${recipe.title} ${state.favourites.includes(id) ? 'saved to' : 'removed from'} favourites.`);
  if ($('recipe-dialog').open) updateDialogActions(recipe);
}

function updateDialogActions(recipe) {
  const favourite = state.favourites.includes(recipe.id);
  const favouriteButton = $('dialog-favourite');
  favouriteButton.textContent = favourite ? '♥ Saved to favourites' : '♡ Save to favourites';
  favouriteButton.setAttribute('aria-pressed', String(favourite));
  const hasMissing = recipe.ingredients.some(({ name }) => !state.pantry.includes(name));
  const inList = state.shoppingRecipes.includes(recipe.id);
  $('dialog-shopping').disabled = inList || !hasMissing;
  $('dialog-shopping').textContent = inList ? '✓ On your shopping list' : !hasMissing ? '✓ You have everything' : '+ Add missing to shopping list';
}

function openRecipe(id, opener) {
  const recipe = recipes.find((item) => item.id === id);
  if (!recipe) return;
  activeRecipeId = id;
  dialogOpener = opener;
  $('dialog-content').innerHTML = `<h2 id="dialog-title">${escapeHTML(recipe.title)}</h2>
    <p class="dialog-description">${escapeHTML(recipe.description)}</p>
    <div class="dialog-meta"><span>${escapeHTML(recipe.minutes)} minutes</span><span>Serves ${escapeHTML(recipe.servings)}</span>${recipe.tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join('')}</div>
    <div class="dialog-columns">
      <section aria-labelledby="ingredients-title"><h3 id="ingredients-title">What you’ll need</h3><ul class="dialog-ingredients">${recipe.ingredients.map(({ name, quantity }) => {
        const available = state.pantry.includes(name);
        return `<li><strong>${escapeHTML(name)}</strong><span class="ingredient-quantity">${escapeHTML(quantity)}</span><span class="ingredient-availability${available ? '' : ' missing'}">${available ? '✓ In your pantry' : '+ Missing from pantry'}</span></li>`;
      }).join('')}</ul></section>
      <section aria-labelledby="steps-title"><h3 id="steps-title">Bring it together</h3><ol class="dialog-steps">${recipe.steps.map((step) => `<li>${escapeHTML(step)}</li>`).join('')}</ol></section>
    </div>
    <div class="dialog-bottom"><button id="dialog-shopping" class="button button-green" type="button"></button><button id="dialog-favourite" class="button button-outline" type="button" aria-pressed="false"></button></div>`;
  updateDialogActions(recipe);
  $('recipe-dialog').showModal();
  $('close-dialog').focus();
}

function resetFilters() {
  visibleRecipeCount = 4;
  state.pantry = [];
  $('ingredient-search').value = '';
  $('recipe-search').value = '';
  $('diet-filter').value = 'all';
  $('time-filter').value = '0';
  $('favourites-only').checked = false;
  pickedId = null;
  persist();
  refreshSavedViews();
  announce('Filters cleared. Exploring all recipes.');
}

$('ingredient-search').addEventListener('input', updatePantry);
$('ingredient-chips').addEventListener('click', (event) => {
  const chip = event.target.closest('[data-ingredient]');
  if (!chip) return;
  const name = chip.dataset.ingredient;
  state.pantry = state.pantry.includes(name) ? state.pantry.filter((item) => item !== name) : [...state.pantry, name];
  persist();
  refreshSavedViews();
});
$('clear-pantry').addEventListener('click', () => {
  state.pantry = [];
  persist();
  refreshSavedViews();
  $('ingredient-search').focus();
  announce('Pantry cleared. Your favourites and shopping recipes are kept.');
});
for (const id of ['diet-filter', 'time-filter', 'favourites-only']) {
  $(id).addEventListener('change', renderRecipes);
}
$('recipe-search').addEventListener('input', renderRecipes);
$('recipe-more').addEventListener('click', () => {
  const firstNewIndex = visibleRecipeCount;
  visibleRecipeCount += 4;
  renderRecipes();
  const firstNewCard = $('recipe-grid').children[firstNewIndex];
  firstNewCard?.focus({ preventScroll: true });
  firstNewCard?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
});
$('find-matches').addEventListener('click', () => {
  renderRecipes();
  announce(`${matches.length} matching recipes found.`);
  $('recipes-title').setAttribute('tabindex', '-1');
  $('recipes-title').focus({ preventScroll: true });
  $('recipes').scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
});
$('shuffle').addEventListener('click', () => {
  const pick = shuffleMatch(matches, previousShuffleId);
  if (!pick) return;
  pickedId = pick.recipe.id;
  previousShuffleId = pickedId;
  renderRecipes();
  const card = [...$('recipe-grid').children].find((item) => item.dataset.recipeId === pickedId);
  card?.focus({ preventScroll: true });
  card?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  announce(`Tonight’s pick: ${pick.recipe.title}. ${pick.recipe.minutes} minutes. ${pick.missing.length} missing ingredients.`);
});
$('recipe-grid').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === 'view') openRecipe(id, button);
  if (action === 'shopping') {
    addShopping(id);
    restoreCardFocus(id, 'view');
  }
  if (action === 'favourite') {
    toggleFavourite(id);
    if (!restoreCardFocus(id, 'favourite')) $('favourites-only').focus();
  }
});

function restoreCardFocus(id, action) {
  const button = [...$('recipe-grid').querySelectorAll('button[data-action]')].find((item) => item.dataset.id === id && item.dataset.action === action);
  button?.focus({ preventScroll: true });
  return Boolean(button);
}

$('recipe-empty').addEventListener('click', (event) => {
  if (event.target.closest('[data-action="reset-filters"]')) {
    resetFilters();
    $('recipe-search').focus();
  }
});
$('shopping-recipes').addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-recipe]');
  if (!button) return;
  state.shoppingRecipes = state.shoppingRecipes.filter((id) => id !== button.dataset.removeRecipe);
  const remaining = buildShoppingList(recipes, state.shoppingRecipes, state.pantry, []);
  state.checked = state.checked.filter((name) => remaining.some((item) => item.name === name));
  persist();
  renderRecipes();
  renderShopping();
  ($('shopping-recipes').querySelector('button') || $('shopping-title')).focus();
  announce('Recipe removed from your shopping list.');
});
$('shopping-list').addEventListener('change', (event) => {
  const input = event.target.closest('[data-shopping-ingredient]');
  if (!input) return;
  const name = input.dataset.shoppingIngredient;
  state.checked = input.checked ? [...new Set([...state.checked, name])] : state.checked.filter((item) => item !== name);
  persist();
  const unchecked = buildShoppingList(recipes, state.shoppingRecipes, state.pantry, state.checked).filter((item) => !item.checked).length;
  $('shopping-badge').textContent = unchecked;
  $('shopping-badge').setAttribute('aria-label', `${unchecked} unchecked shopping ingredients`);
  announce(`${name} ${input.checked ? 'checked off' : 'unchecked'}.`);
});
$('clear-shopping').addEventListener('click', () => {
  state.shoppingRecipes = [];
  state.checked = [];
  persist();
  renderRecipes();
  renderShopping();
  $('shopping-title').focus();
  announce('Shopping list cleared.');
});
$('reset-state').addEventListener('click', () => {
  if (!window.confirm('Reset your kitchen? This will clear your saved pantry, favourites, shopping list and checked items in this browser.')) return;
  state = { pantry: [], favourites: [], shoppingRecipes: [], checked: [] };
  previousShuffleId = null;
  resetFilters();
  announce('All saved kitchen data has been reset.');
});
$('close-dialog').addEventListener('click', () => $('recipe-dialog').close());
$('recipe-dialog').addEventListener('click', (event) => {
  if (event.target === $('dialog-shopping')) addShopping(activeRecipeId);
  if (event.target === $('dialog-favourite')) toggleFavourite(activeRecipeId);
  if (event.target === $('recipe-dialog')) {
    const bounds = $('recipe-dialog').getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $('recipe-dialog').close();
  }
});
$('recipe-dialog').addEventListener('close', () => {
  if (dialogOpener?.isConnected) dialogOpener.focus();
  else if (!restoreCardFocus(activeRecipeId, 'view')) $('favourites-only').focus();
  activeRecipeId = null;
});

$('shopping-title').setAttribute('tabindex', '-1');
createPantry();
renderRecipes();
renderShopping();
