import { test, expect } from '@playwright/test';

/**
 * OIDC böngésző-flow (Fázis 8). Az `e2e/run-oidc.mjs` húzza fel a web+api OIDC-módot
 * a futó Keycloak (localhost:8088) + seedelt Docker-mongo ellen. A teszt végigviszi a
 * valódi Authorization Code + PKCE belépést a Keycloak login-oldalán át.
 */
test('Keycloak-belépés végigvihető, az app hitelesít és betölt', async ({ page }) => {
  await page.goto('/');

  // Bejelentkezés (a fejlécben és az üres állapotban is van gomb).
  await page.getByRole('button', { name: 'Bejelentkezés' }).first().click();

  // Átirányítás a Keycloak login-oldalára.
  await page.waitForURL(/localhost:8088\/realms\/kartotek/);
  await page.fill('#username', 'kiss.anna');
  await page.fill('#password', 'Proba123!');
  await page.click('#kc-login');

  // Vissza az appba, belépve: a fejléc a nevet mutatja, a lista betölt.
  await expect(page.locator('.felh-nev')).toHaveText('Kiss Anna', { timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Kilépés' })).toBeVisible();
  await expect(page.locator('.lista-elem').first()).toBeVisible();
});

test('kijelentkezés után újra a bejelentkezés látszik', async ({ page }) => {
  // Belépés (újra, friss kontextus).
  await page.goto('/');
  await page.getByRole('button', { name: 'Bejelentkezés' }).first().click();
  await page.waitForURL(/localhost:8088/);
  await page.fill('#username', 'kiss.anna');
  await page.fill('#password', 'Proba123!');
  await page.click('#kc-login');
  await expect(page.locator('.felh-nev')).toHaveText('Kiss Anna', { timeout: 15_000 });

  // Kilépés → vissza a bejelentkezés-állapotba.
  await page.getByRole('button', { name: 'Kilépés' }).click();
  await expect(page.getByRole('button', { name: 'Bejelentkezés' }).first()).toBeVisible({
    timeout: 15_000,
  });
});
