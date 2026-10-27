import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// iPad in orizzontale (11": 1180×820, schermo a dito): il menu laterale è stretto, con le sole icone. Logo e icone devono stare
// esattamente al centro della barra, e ogni voce deve essere un bersaglio da dito (almeno 44 px).
test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

test('tablet in orizzontale: il menu laterale è centrato e a misura di dito', async ({ page }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  const aside = page.locator('aside').first();
  await expect(aside.locator('nav a').first()).toBeVisible();
  const bar = await aside.boundingBox();
  const middle = bar.x + bar.width / 2;

  const centers = [];
  centers.push(['logo', await aside.locator('div.bg-\\[var\\(--accent\\)\\]').first().boundingBox()]);
  for (const link of await aside.locator('nav a').all()) {
    centers.push([await link.getAttribute('title'), await link.locator('svg').first().boundingBox()]);
    expect((await link.boundingBox()).height, 'bersaglio da dito').toBeGreaterThanOrEqual(44);
  }
  for (const [name, box] of centers) expect(Math.abs(box.x + box.width / 2 - middle), `${name}: fuori centro`).toBeLessThanOrEqual(1.5);
  await shot(page, 'tablet-01-menu-orizzontale');
});
