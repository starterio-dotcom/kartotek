import { test, expect, type Page } from '@playwright/test';

/**
 * Kritikus folyamatok füsttesztje (Fázis 7). A teljes harnesst a `pnpm test:e2e`
 * (e2e/run-e2e.mjs) húzza fel: in-memory MongoDB + seed + API/web dev-szerverek.
 * Belépés a dev-felhasználóváltóval (az option értéke az e-mail).
 */

async function belep(page: Page, email: string) {
  await page.goto('/');
  await page.getByLabel('Felhasználó (dev)').selectOption(email);
}

test('belépés után megjelenik az áttekintés', async ({ page }) => {
  await belep(page, 'kiss.anna@pelda.hu');
  await expect(page.getByRole('heading', { level: 1, name: 'Kartoték' })).toBeVisible();
  // A lista feltöltődik a seedelt 3R-elemekkel.
  await expect(page.locator('.lista-elem').first()).toBeVisible();
});

test('skip-link fókuszra láthatóvá válik és a tartalomra ugrik', async ({ page }) => {
  await belep(page, 'kiss.anna@pelda.hu');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Ugrás a tartalomra' });
  await expect(skip).toBeFocused();
  await skip.click();
  await expect(page.locator('#fo-tartalom')).toBeVisible();
});

test('a státusz felirattal jelenik meg egy kartotékon (nem csak szín)', async ({ page }) => {
  await belep(page, 'kiss.anna@pelda.hu');
  await page.locator('.lista-elem').first().click();
  // Részlet-cím megjelent → kartotékon vagyunk.
  await expect(page.locator('.reszlet-cim')).toBeVisible();
  // A státuszjelvény szövege olvasható (EN 301 549) — egy ismert státusz felirat.
  await expect(
    page.locator('.badge').filter({ hasText: /Vázlat|Véleményezés|Jóváhagyott|Hatályos|Elavult|Archivált|Elvetve/ }).first(),
  ).toBeVisible();
});

test('a riportok nézet betölt és vált a fülek között', async ({ page }) => {
  await belep(page, 'kiss.anna@pelda.hu');
  await page.getByRole('button', { name: /Riportok/ }).click();
  await expect(page.getByRole('heading', { name: /Riportok/ })).toBeVisible();
  await page.getByRole('button', { name: 'Megfelelés' }).click();
  // A seedelt szabályzat-kód a megfelelés-riportban (valós adatból).
  await expect(page.getByText('IB-XYT-14-1213').first()).toBeVisible();
});

test('admin a Kiadások nézetben létrehozhat kiadást', async ({ page }) => {
  await belep(page, 'nagy.peter@pelda.hu'); // globális Admin
  await page.getByRole('button', { name: /Kiadások/ }).click();
  await expect(page.getByRole('heading', { name: 'Kiadások' })).toBeVisible();
  await page.getByRole('button', { name: /Új kiadás/ }).click();
  await page.getByPlaceholder(/R6/).fill('E2E-R1');
  await page.locator('input[type="date"]').fill('2026-09-01');
  await page.getByRole('button', { name: 'Létrehozás' }).click();
  await expect(page.getByText('E2E-R1').first()).toBeVisible();
});
