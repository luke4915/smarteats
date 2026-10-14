import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// I locali di prova li prepara backend/scripts/e2e-server.js e ne scrive gli indirizzi in .run/seed.json.
const here = path.dirname(fileURLToPath(import.meta.url));
export const seed = () => JSON.parse(fs.readFileSync(path.join(here, '.run', 'seed.json'), 'utf8'));

export const urlOf = (host) => `https://${host}:${seed().port}`;

// Accede come `username` nel locale `host` e aspetta che la schermata di lavoro sia comparsa.
export async function login(page, host, username) {
  await page.goto(`${urlOf(host)}/login`);
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder(/^Password/).fill(seed().password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

// Cartella degli screenshot da guardare a occhio (non sono confronti automatici).
export const shot = (page, name) => page.screenshot({ path: path.join(here, '.run', 'schermate', `${name}.png`), fullPage: false });
