import test from 'node:test';
import assert from 'node:assert/strict';
import { recipes, pantryIngredients } from '../assets/recipes.js';
import { findMatches, shuffleMatch, buildShoppingList, loadState, saveState } from '../assets/engine.js';

const ingredient = (name, quantity = '1 tbsp') => ({ name, quantity });
const recipe = (id, title, ingredients, overrides = {}) => ({
  id, title, ingredients, description: 'A simple supper.', minutes: 20, servings: 2,
  tags: ['vegetarian'], steps: ['Cook and serve.'], ...overrides,
});
const fixtures = [
  recipe('z', 'Zesty Rice', [ingredient('rice'), ingredient('lemon')], {
    tags: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], minutes: 15,
  }),
  recipe('a', 'Apple Rice', [ingredient('rice'), ingredient('lemon'), ingredient('apple')]),
  recipe('b', 'Bean Bowl', [ingredient('beans'), ingredient('lemon')]),
  recipe('c', 'Creamy Pasta', [ingredient('pasta'), ingredient('cream')], { minutes: 30 }),
];
const ids = matches => matches.map(match => match.recipe.id);
const emptyState = () => ({ pantry: [], favourites: [], shoppingRecipes: [], checked: [] });
const key = 'shufflecook:roulette:v1';
function memoryStorage(initial) {
  const data = new Map(initial === undefined ? [] : [[key, initial]]);
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test('catalogue has complete original recipes and a sorted unique canonical pantry', () => {
  assert.ok(recipes.length >= 12);
  assert.equal(new Set(recipes.map(item => item.id)).size, recipes.length);
  for (const item of recipes) {
    for (const field of ['id', 'title', 'description']) assert.ok(item[field].trim());
    assert.ok(Number.isInteger(item.minutes) && item.minutes > 0);
    assert.ok(Number.isInteger(item.servings) && item.servings > 0);
    assert.ok(item.ingredients.length >= 3);
    assert.ok(item.steps.length >= 4 && item.steps.every(step => typeof step === 'string' && step.length > 30));
    assert.ok(item.tags.every(tag => ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'].includes(tag)));
    for (const entry of item.ingredients) {
      assert.match(entry.name, /^[a-z]+(?: [a-z]+)*$/);
      assert.ok(entry.quantity.trim());
    }
    assert.equal(new Set(item.ingredients.map(entry => entry.name)).size, item.ingredients.length);
  }
  assert.deepEqual(pantryIngredients, [...new Set(
    recipes.flatMap(item => item.ingredients.map(entry => entry.name)),
  )].sort());
});

test('empty pantry returns all recipes, ranked by missing count then title', () => {
  const matches = findMatches(fixtures);
  assert.deepEqual(ids(matches), ['b', 'c', 'z', 'a']);
  assert.ok(matches.every(match => match.matchCount === 0 && match.available.length === 0));
  assert.deepEqual(findMatches([]), []);
});

test('nonempty pantry requires overlap and ranks by available, missing, then title', () => {
  const matches = findMatches(fixtures, { pantry: [' rice ', 'LEMON', 'rice'] });
  assert.deepEqual(ids(matches), ['z', 'a', 'b']);
  assert.equal(matches[0].matchCount, 2);
  assert.deepEqual(matches[0].available, fixtures[0].ingredients);
  assert.deepEqual(matches[0].missing, []);
  assert.deepEqual(matches[2].missing, [ingredient('beans')]);
  assert.deepEqual(findMatches(fixtures, { pantry: ['unknown ingredient'] }), []);
  assert.equal(findMatches(fixtures, { pantry: ['', ' '] }).length, fixtures.length);
  assert.deepEqual(ids(findMatches(fixtures, { pantry: ['lemon'] })), ['b', 'z', 'a']);
});

test('diet, inclusive time limit, case-insensitive search and favourites compose', () => {
  assert.deepEqual(ids(findMatches(fixtures, { diet: 'vegan' })), ['z']);
  assert.deepEqual(ids(findMatches(fixtures, { diet: 'gluten-free', maxMinutes: 15 })), ['z']);
  assert.equal(findMatches(fixtures, { maxMinutes: 0 }).length, 4);
  assert.deepEqual(findMatches(fixtures, { maxMinutes: 14 }), []);
  assert.deepEqual(ids(findMatches(fixtures, { search: ' APPLE ' })), ['a']);
  assert.deepEqual(ids(findMatches(fixtures, { search: 'cream' })), ['c']);
  assert.equal(findMatches(fixtures, { search: 'simple supper' }).length, 4);
  assert.deepEqual(findMatches(fixtures, { search: 'not present' }), []);
  assert.deepEqual(findMatches(fixtures, { diet: 'not-a-tag' }), []);
  assert.deepEqual(findMatches(fixtures, { favouritesOnly: true }), []);
  assert.deepEqual(ids(findMatches(fixtures, {
    pantry: ['lemon'], diet: 'vegetarian', maxMinutes: 20, search: 'rice',
    favouritesOnly: true, favourites: ['a', 'c', 'unknown'],
  })), ['a']);
  assert.equal(findMatches(fixtures, { favourites: ['a'] }).length, 4);
});

test('matching does not mutate recipes or options and preserves ingredient objects', () => {
  const before = JSON.stringify(fixtures);
  const pantry = Object.freeze(['lemon']);
  const matches = findMatches(Object.freeze([...fixtures]), { pantry });
  assert.equal(matches.find(match => match.recipe.id === 'z').available[0], fixtures[0].ingredients[1]);
  assert.equal(JSON.stringify(fixtures), before);
});

test('shuffle handles empty, singleton, exclusions and random boundaries', () => {
  const matches = findMatches(fixtures);
  const before = [...matches];
  assert.equal(shuffleMatch([]), null);
  assert.equal(shuffleMatch([matches[0]], matches[0].recipe.id, () => 1), matches[0]);
  assert.equal(shuffleMatch(matches, null, () => 0), matches[0]);
  assert.equal(shuffleMatch(matches, null, () => 0.999999), matches.at(-1));
  assert.equal(shuffleMatch(matches, null, () => 1), matches.at(-1));
  assert.equal(shuffleMatch(matches, null, () => -1), matches[0]);
  assert.equal(shuffleMatch(matches, null, () => NaN), matches[0]);
  assert.equal(shuffleMatch(matches, matches[0].recipe.id, () => 0), matches[1]);
  assert.equal(shuffleMatch(matches, 'unknown', () => 0), matches[0]);
  for (const value of [0, 0.25, 0.5, 0.75, 1]) {
    assert.notEqual(shuffleMatch(matches, matches[1].recipe.id, () => value).recipe.id, matches[1].recipe.id);
  }
  assert.deepEqual(matches, before);
});

test('shopping list merges names, preserves distinct quantities and excludes pantry', () => {
  const source = [
    recipe('one', 'First', [ingredient('rice', '100 g'), ingredient('lemon', '½ fruit')]),
    recipe('two', 'Second', [ingredient('rice', '200 g'), ingredient('lemon', '½ fruit')]),
    recipe('three', 'Third', [ingredient('rice', '100 g'), ingredient('beans', '1 tin')]),
  ];
  const before = JSON.stringify(source);
  assert.deepEqual(buildShoppingList(source, ['one', 'two', 'three', 'one', 'missing'], [' LEMON '], ['RICE']), [
    { name: 'beans', quantities: ['1 tin'], recipeTitles: ['Third'], checked: false },
    { name: 'rice', quantities: ['100 g', '200 g'], recipeTitles: ['First', 'Second', 'Third'], checked: true },
  ]);
  assert.deepEqual(buildShoppingList(source, []), []);
  assert.deepEqual(buildShoppingList(source, ['missing']), []);
  assert.deepEqual(buildShoppingList(source, ['one'], ['rice', 'lemon']), []);
  assert.equal(buildShoppingList(source, ['one', 'two'])[0].quantities.length, 1);
  assert.equal(JSON.stringify(source), before);
});

test('state round-trips with the versioned key and fresh default arrays', () => {
  const storage = memoryStorage();
  const state = {
    pantry: ['rice', 'lemon'], favourites: [recipes[0].id],
    shoppingRecipes: [recipes[1].id], checked: ['beans'],
  };
  assert.deepEqual(loadState(storage), emptyState());
  assert.equal(saveState(storage, state), true);
  assert.equal(storage.getItem(key), JSON.stringify(state));
  assert.deepEqual(loadState(storage), state);
  const first = loadState(null);
  first.pantry.push('rice');
  assert.deepEqual(loadState(null), emptyState());
});

test('state validates array members, trims, normalizes names and removes duplicates', () => {
  const dirty = {
    pantry: [' RICE ', 'rice', 2, null, '', '  '],
    favourites: 'wrong', shoppingRecipes: [' one ', 'one', false],
    checked: [' LEMON ', {}, 'lemon'], other: 'ignored',
  };
  const expected = { pantry: ['rice'], favourites: [], shoppingRecipes: ['one'], checked: ['lemon'] };
  assert.deepEqual(loadState(memoryStorage(JSON.stringify(dirty))), expected);
  const storage = memoryStorage();
  assert.equal(saveState(storage, dirty), true);
  assert.deepEqual(loadState(storage), expected);
  assert.deepEqual(dirty.pantry, [' RICE ', 'rice', 2, null, '', '  ']);
});

test('corrupt, primitive and missing stored states return safe defaults', () => {
  for (const value of ['{broken', 'null', '[]', '"hello"', '42', '{}', '{"pantry":{}}']) {
    assert.deepEqual(loadState(memoryStorage(value)), emptyState());
  }
  assert.deepEqual(loadState(), emptyState());
});

test('storage access errors and unavailable storage are contained', () => {
  const blocked = {
    getItem() { throw new Error('Access denied'); },
    setItem() { throw new Error('Quota exceeded'); },
  };
  const getterBlocked = {
    get getItem() { throw new Error('Unavailable'); },
    get setItem() { throw new Error('Unavailable'); },
  };
  for (const storage of [undefined, null, {}, blocked, getterBlocked]) {
    assert.deepEqual(loadState(storage), emptyState());
    assert.equal(saveState(storage, emptyState()), false);
  }
  const storage = memoryStorage();
  assert.equal(saveState(storage, null), true);
  assert.deepEqual(loadState(storage), emptyState());
});
