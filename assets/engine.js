const STORAGE_KEY = 'shufflecook:roulette:v1';
const STATE_FIELDS = ['pantry', 'favourites', 'shoppingRecipes', 'checked'];

function strings(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean))]
    : [];
}

function ingredientNames(value) {
  return new Set(strings(value).map(name => name.toLowerCase()));
}

function cleanState(state) {
  return Object.fromEntries(STATE_FIELDS.map(field => [
    field,
    field === 'pantry' || field === 'checked'
      ? [...ingredientNames(state?.[field])]
      : strings(state?.[field]),
  ]));
}

// An empty pantry is discovery mode; a populated pantry requires at least one overlap.
export function findMatches(recipes, {
  pantry = [],
  diet = 'all',
  maxMinutes = 0,
  search = '',
  favouritesOnly = false,
  favourites = [],
} = {}) {
  const owned = ingredientNames(pantry);
  const favouriteIds = new Set(strings(favourites));
  const query = String(search).trim().toLowerCase();

  return recipes
    .filter(recipe => diet === 'all' || recipe.tags.includes(diet))
    .filter(recipe => !maxMinutes || recipe.minutes <= maxMinutes)
    .filter(recipe => !favouritesOnly || favouriteIds.has(recipe.id))
    .filter(recipe => !query || [
      recipe.title,
      recipe.description,
      ...recipe.tags,
      ...recipe.ingredients.map(ingredient => ingredient.name),
    ].join(' ').toLowerCase().includes(query))
    .map(recipe => {
      const available = [];
      const missing = [];
      for (const ingredient of recipe.ingredients) {
        (owned.has(ingredient.name) ? available : missing).push(ingredient);
      }
      return { recipe, available, missing, matchCount: available.length };
    })
    .filter(match => owned.size === 0 || match.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount
      || a.missing.length - b.missing.length
      || a.recipe.title.localeCompare(b.recipe.title));
}

export function shuffleMatch(matches, previousId = null, rng = Math.random) {
  if (matches.length === 0) return null;
  const alternatives = matches.filter(match => match.recipe.id !== previousId);
  const candidates = alternatives.length ? alternatives : matches;
  const random = Number(rng());
  const index = Number.isNaN(random)
    ? 0
    : Math.max(0, Math.min(candidates.length - 1, Math.floor(random * candidates.length)));
  return candidates[index];
}

export function buildShoppingList(recipes, selectedIds, pantry = [], checked = []) {
  const selected = new Set(strings(selectedIds));
  const owned = ingredientNames(pantry);
  const checkedNames = ingredientNames(checked);
  const items = new Map();

  for (const recipe of recipes) {
    if (!selected.has(recipe.id)) continue;
    for (const ingredient of recipe.ingredients) {
      if (owned.has(ingredient.name)) continue;
      if (!items.has(ingredient.name)) {
        items.set(ingredient.name, {
          name: ingredient.name,
          quantities: [],
          recipeTitles: [],
          checked: checkedNames.has(ingredient.name),
        });
      }
      const item = items.get(ingredient.name);
      if (!item.quantities.includes(ingredient.quantity)) item.quantities.push(ingredient.quantity);
      if (!item.recipeTitles.includes(recipe.title)) item.recipeTitles.push(recipe.title);
    }
  }
  return [...items.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function loadState(storage) {
  try {
    return cleanState(JSON.parse(storage.getItem(STORAGE_KEY)));
  } catch {
    return cleanState(null);
  }
}

export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(cleanState(state)));
    return true;
  } catch {
    return false;
  }
}
