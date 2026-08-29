import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const indexUrl =
  "file://" + join(dirname(fileURLToPath(import.meta.url)), "..", "index.html");

async function open(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(indexUrl);
  return errors;
}

test("la page charge sans erreur JavaScript", async ({ page }) => {
  const errors = await open(page);
  await expect(page).toHaveTitle("Okulist");
  await expect(page.locator("h2")).toContainText("Faites le point");
  expect(errors).toEqual([]);
});

test("le parcours complet se traverse jusqu'au bilan", async ({ page }) => {
  const errors = await open(page);

  await page.getByRole("button", { name: "Commencer le calibrage" }).click();
  await expect(page.locator("h2")).toContainText("Calibrage de l'écran");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.locator("h2")).toContainText("gamma");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Chaque test est passable : on saute tout jusqu'au bilan.
  const expected = [
    "Acuité de loin — œil droit", "Acuité de loin — œil gauche",
    "Test duochrome — œil droit", "Test duochrome — œil gauche",
    "Cadran d'astigmatisme — œil droit", "Cadran d'astigmatisme — œil gauche",
    "Sensibilité au contraste", "Acuité vernier",
    "Vision de près", "Vitesse de lecture",
    "Tache aveugle — œil droit", "Tache aveugle — œil gauche",
    "Grille d'Amsler — œil droit", "Grille d'Amsler — œil gauche",
    "Vision des couleurs", "Fatigue visuelle numérique"
  ];
  for (const title of expected) {
    await expect(page.locator("h2")).toContainText(title);
    await page.getByRole("button", { name: "Passer ce test →" }).click();
  }
  await expect(page.locator("h2")).toContainText("Votre bilan");
  await expect(page.locator("main")).toContainText("Tous les tests ont été passés");
  expect(errors).toEqual([]);
});

test("un test répondu apparaît dans le bilan", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "Commencer le calibrage" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  // Sauter jusqu'au questionnaire de fatigue (15 sauts), y répondre.
  for (let i = 0; i < 15; i++) {
    await page.getByRole("button", { name: "Passer ce test →" }).click();
  }
  await expect(page.locator("h2")).toContainText("Fatigue visuelle");
  const continuer = page.getByRole("button", { name: "Continuer" });
  await expect(continuer).toBeDisabled();
  for (const row of await page.locator(".qrow").all()) {
    await row.getByRole("button", { name: "Souvent" }).click();
  }
  await expect(continuer).toBeEnabled();
  await continuer.click();

  await expect(page.locator("h2")).toContainText("Votre bilan");
  await expect(page.locator("main")).toContainText("Fatigue visuelle numérique");
  await expect(page.locator("main")).toContainText("Score 12 / 12");
  // Score maximal → recommandations d'hygiène marquées « Pour vous »
  await expect(page.locator("main")).toContainText("Pauses et clignement");
  expect(errors).toEqual([]);
});

test("l'historique trace l'évolution sur plusieurs bilans", async ({ page }) => {
  const errors = await open(page);
  // Deux séances passées avec acuité mesurée, pré-enregistrées.
  await page.evaluate(() => {
    localStorage.setItem("okulist-history", JSON.stringify([
      { d: "2026-08-01", od: 8, og: 7, logCS: 1.5, near: 1.0, strain: 2 },
      { d: "2026-08-15", od: 7, og: 7, logCS: 1.5, near: 1.25, strain: 4 }
    ]));
  });
  await page.reload();
  await page.getByRole("button", { name: "Commencer le calibrage" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  for (let i = 0; i < 15; i++) {
    await page.getByRole("button", { name: "Passer ce test →" }).click();
  }
  for (const row of await page.locator(".qrow").all()) {
    await row.getByRole("button", { name: "Jamais" }).click();
  }
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.locator("h2")).toContainText("Votre bilan");
  await expect(page.locator("main")).toContainText("Évolution");
  await expect(page.locator(".histwrap svg")).toBeVisible();
  await expect(page.locator(".htable tr")).toHaveCount(4); // en-tête + 3 séances
  expect(errors).toEqual([]);
});

test("le clavier répond au test d'acuité", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "Commencer le calibrage" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.locator("h2")).toContainText("Acuité de loin");
  // Répondre au clavier fait avancer l'essai (le niveau reste affiché).
  await expect(page.locator("#tinfo")).toContainText("niveau");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#tinfo")).toContainText("niveau");
  expect(errors).toEqual([]);
});
