import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const { chromium, expect } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5183/';
const artifacts = resolve(import.meta.dirname, '../.artifacts');
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});

try {
  await page.goto(baseURL);
  await expect(page.getByRole('link', { name: 'Try Recipe Roulette' })).toBeVisible();
  await expect(page.locator('a[href="privacy/"]').first()).toBeVisible();
  await expect(page.locator('a[href="support/"]').first()).toBeVisible();
  await page.getByRole('link', { name: 'Try Recipe Roulette' }).click();
  await expect(page.locator('[data-recipe-id]')).toHaveCount(4);
  await page.locator('#recipe-more').click();
  await expect(page.locator('[data-recipe-id]')).toHaveCount(8);
  await expect(page.locator('[data-recipe-id]').nth(4)).toBeFocused();
  await page.locator('#recipe-more').click();
  await expect(page.locator('[data-recipe-id]')).toHaveCount(12);
  await expect(page.locator('#recipe-more')).toBeHidden();
  await expect(page.locator('[data-recipe-art]')).toHaveCount(12);
  const illustrations = await page.locator('[data-recipe-art]').evaluateAll(elements => elements.map(svg => ({
    id: svg.dataset.recipeArt,
    description: svg.getAttribute('aria-label'),
    artwork: svg.innerHTML,
    bounds: svg.getBBox().width,
  })));
  assert.equal(new Set(illustrations.map(art => art.artwork)).size, 12, 'Every recipe needs its own illustration');
  assert.ok(illustrations.every(art => art.description.startsWith('Illustration of ') && art.bounds > 100), 'Artwork must render with a descriptive accessible name');

  await page.locator('#ingredient-search').fill('chick');
  await page.locator('[data-ingredient="chickpeas"]').click();
  await expect(page.locator('[data-ingredient="chickpeas"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-recipe-id]')).toHaveCount(2);
  await page.locator('#diet-filter').selectOption('vegan');
  await page.locator('#time-filter').selectOption('30');
  await page.locator('#find-matches').click();
  await expect(page.locator('[data-recipe-id]')).toHaveCount(1);
  await expect(page.locator('.ingredients-preview').first()).toContainText('You have: chickpeas');
  await expect(page.locator('[data-recipe-id] h3')).toHaveText('Lemon Chickpea Couscous');

  await page.locator('#clear-pantry').click();
  await page.locator('#ingredient-search').fill('olive');
  await page.locator('[data-ingredient="olive oil"]').click();
  assert.ok(await page.locator('[data-recipe-id]').count() > 1);
  await page.locator('#shuffle').click();
  const firstPick = await page.locator('.is-pick').getAttribute('data-recipe-id');
  await page.locator('#shuffle').click();
  const secondPick = await page.locator('.is-pick').getAttribute('data-recipe-id');
  assert.notEqual(firstPick, secondPick, 'shuffle must avoid immediate repeats');
  const pickedCard = page.locator('.is-pick');
  assert.ok((await pickedCard.locator('.recipe-meta').innerText()).includes('min'));
  await pickedCard.locator('[data-action="favourite"]').click();
  await page.locator('#favourites-only').check();
  await expect(page.locator('[data-recipe-id]')).toHaveCount(1);
  await page.locator('[data-action="view"]').click();
  await expect(page.locator('#recipe-dialog')).toBeVisible();
  assert.ok(await page.locator('.dialog-steps li').count() >= 4);
  await expect(page.locator('.dialog-meta')).toContainText('Serves 2');
  await page.locator('#dialog-shopping').click();
  await page.locator('#close-dialog').click();
  assert.ok(await page.locator('[data-shopping-ingredient]').count() > 0);
  await expect(page.locator('[data-shopping-ingredient="olive oil"]')).toHaveCount(0);
  const checkedName = await page.locator('[data-shopping-ingredient]').first().getAttribute('data-shopping-ingredient');
  await page.locator('[data-shopping-ingredient]').first().check();
  await page.reload();
  await expect(page.locator('[data-ingredient="olive oil"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`[data-shopping-ingredient="${checkedName}"]`)).toBeChecked();
  await page.locator('#favourites-only').check();
  await expect(page.locator('[data-recipe-id]')).toHaveCount(1);
  await expect(page.locator('[data-action="favourite"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action="favourite"]').click();
  await expect(page.locator('#recipe-empty')).toBeVisible();
  await expect(page.locator('#shuffle')).toBeDisabled();
  await page.locator('[data-action="reset-filters"]').click();
  await expect(page.locator('[data-recipe-id]')).toHaveCount(4);
  await page.locator('[data-remove-recipe]').click();
  await expect(page.locator('[data-shopping-ingredient]')).toHaveCount(0);
  await expect(page.locator('#shopping-empty')).toBeVisible();
  await page.locator('#recipe-search').fill('no such meal xyz');
  await expect(page.locator('#recipe-empty')).toBeVisible();
  await expect(page.locator('#recipe-search')).toBeFocused();
  await page.locator('[data-action="reset-filters"]').click();

  // Populate all saved fields once more before checking the destructive reset.
  await page.locator('[data-action="favourite"]').first().click();
  await page.locator('[data-action="shopping"]:not(:disabled)').first().click();
  await page.locator('[data-shopping-ingredient]').first().check();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#reset-state').click();
  await expect(page.locator('[data-recipe-id]')).toHaveCount(4);
  await expect(page.locator('[data-shopping-ingredient]')).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shufflecook:roulette:v1')));
  assert.deepEqual(saved, { pantry: [], favourites: [], shoppingRecipes: [], checked: [] });
  await page.reload();
  await expect(page.locator('[data-recipe-id]')).toHaveCount(4);
  await page.screenshot({ path: resolve(artifacts, 'recipe-roulette-desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('about:blank');
  await page.goto(new URL('app/', baseURL).href);
  await expect(page.locator('#pantry-controls')).not.toHaveAttribute('open', '');
  await expect(page.locator('#ingredient-search')).toBeHidden();
  await expect(page.locator('#shuffle')).toBeInViewport();
  await page.locator('#pantry-controls summary').click();
  await expect(page.locator('#ingredient-search')).toBeVisible();
  await page.locator('#ingredient-search').fill('chick');
  await page.locator('[data-ingredient="chickpeas"]').click();
  await expect(page.locator('#pantry-summary')).toContainText('1 ingredient selected');
  await page.locator('#find-matches').click();
  await expect(page.locator('#recipes-title')).toBeFocused();
  await expect(page.locator('[data-recipe-id]')).toHaveCount(2);
  await page.locator('#pantry-controls summary').click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile page must not overflow');
  await page.locator('[data-action="view"]').first().click();
  await expect(page.locator('#recipe-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#recipe-dialog')).not.toBeVisible();
  await page.screenshot({ path: resolve(artifacts, 'recipe-roulette-mobile.png'), fullPage: true });
  await page.goto(new URL('privacy/', baseURL).href);
  await expect(page.getByRole('heading', { name: 'No personal data collection' })).toBeVisible();
  await page.goto(new URL('support/', baseURL).href);
  await expect(page.getByRole('link', { name: 'Open the support tracker' })).toBeVisible();

  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage disabled'); } });
  });
  const blockedPage = await blockedContext.newPage();
  blockedPage.on('pageerror', error => errors.push(error.message));
  await blockedPage.goto(new URL('app/', baseURL).href);
  await expect(blockedPage.locator('#storage-warning')).toBeVisible();
  await expect(blockedPage.locator('[data-recipe-id]')).toHaveCount(4);
  await blockedPage.locator('[data-action="favourite"]').first().click();
  await expect(blockedPage.locator('[data-action="favourite"]').first()).toHaveAttribute('aria-pressed', 'true');
  await blockedContext.close();
  assert.deepEqual(errors, [], 'no browser exceptions or failing HTTP assets');
  console.log(`PASS browser regression: ${baseURL} — pantry, filters, shuffle, recipe, favourites/reload, shopping/reload, reset, empty states, storage failure, mobile, privacy/support`);
} catch (error) {
  console.error(await page.evaluate(() => ({
    url: location.href,
    scroll: scrollY,
    shuffleTop: document.getElementById('shuffle')?.getBoundingClientRect().top,
    pantryOpen: document.getElementById('pantry-controls')?.open,
  })));
  await page.screenshot({ path: resolve(artifacts, 'browser-failure.png') });
  throw error;
} finally {
  await browser.close();
}
