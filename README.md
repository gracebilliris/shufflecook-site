# ShuffleCook · Recipe Roulette

The public web companion to ShuffleCook, built with plain HTML, CSS, SVG and JavaScript. No build step, external recipe API, accounts, analytics or runtime dependencies.

**Live:** https://gracebilliris.github.io/shufflecook-site/

**Kitchen:** https://gracebilliris.github.io/shufflecook-site/app/

## Use

Select pantry ingredients, optionally filter by dietary tag/time or search, and choose **Find my matches**. A nonempty pantry requires at least one matching ingredient; an empty pantry explores all 12 original recipes. **Surprise me** picks only from the current matches and avoids the previous pick when possible.

On phones, **Pantry & filters** starts collapsed so recipes are immediately reachable. Four recipes appear at a time; **Show more recipes** reveals the rest. A shuffled pick always appears first, even if it was not previously visible.

Open **Let's cook** for quantities, servings and complete instructions. Hearts save favourites. **Add missing** creates a shopping list without pantry ingredients, with amounts shown separately per recipe. Check items off or remove a recipe. **Clear pantry** keeps favourites and shopping recipes; **Reset saved data** clears everything after confirmation.

Pantry, favourites, shopping recipe IDs and checkoffs are saved in local storage on this browser only. Filters reset on reload. Blocked storage displays a warning; the current visit remains usable. There is no native-app sync or guaranteed offline web support. Dietary tags are ingredient guides, not allergy guarantees; check product labels.

## Run and test

Use Node.js 22 or later:

```sh
node scripts/serve.mjs
# Open http://127.0.0.1:5183/
node --test tests/engine.test.mjs
```

Browser regression tests require an existing Playwright installation and Chromium:

```sh
# Keep the local server running in another terminal.
PLAYWRIGHT_MODULE=/absolute/path/to/node_modules/@playwright/test/index.mjs \
  node tests/browser.test.mjs
# Test the deployed site:
BASE_URL=https://gracebilliris.github.io/shufflecook-site/ \
  PLAYWRIGHT_MODULE=/absolute/path/to/node_modules/@playwright/test/index.mjs \
  node tests/browser.test.mjs
```

The browser check covers pantry selection, filtering, shuffling, full instructions, favourites, shopping checkoffs/reload, reset/empty states, unavailable storage, and mobile overflow. Screenshots go to ignored `.artifacts/`.

## Deploy

The existing public repository is `gracebilliris/shufflecook-site`. GitHub Pages deploys **`main`, repository root**, using its existing legacy Pages build. Push static source files to `main`; no separate deployment workflow or generated `dist` is needed. `.nojekyll` is retained. Verify under **Settings → Pages**, or:

```sh
gh api repos/gracebilliris/shufflecook-site/pages
gh run list --repo gracebilliris/shufflecook-site --workflow pages-build-deployment
```

All asset links are relative, including the `/shufflecook-site/` project prefix. Existing `privacy/` and `support/` URLs and native-app information are preserved, with separate web companion guidance. This repository does not change the native ShuffleCook application.
