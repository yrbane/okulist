import { test } from "node:test";
import assert from "node:assert/strict";
import core from "../src/core.js";

const close = (a, b, eps = 1e-3) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b} (±${eps})`);

test("degToPx / pxToDeg sont réciproques", () => {
  const px = core.degToPx(2.5, 70, 4.2);
  close(core.pxToDeg(px, 70, 4.2), 2.5, 1e-9);
});

test("landoltGapPx : 10/10 à 60 cm = 1 minute d'arc", () => {
  // tan(1') × 600 mm ≈ 0,1745 mm ; à 4 px/mm → ≈ 0,698 px
  close(core.landoltGapPx(10, 60, 4), 0.698, 0.002);
  // 1/10 : ouverture 10× plus grande
  close(core.landoltGapPx(1, 60, 4) / core.landoltGapPx(10, 60, 4), 10, 0.01);
});

test("staircase : sans faute → dernier niveau", () => {
  const s = core.createStaircase(5, { passNeed: 2, maxTrials: 4 });
  for (let i = 0; i < 10; i++) s.answer(true);
  assert.equal(s.state.done, true);
  assert.equal(s.state.result, 4);
});

test("staircase : échec au niveau k → résultat k-1", () => {
  const s = core.createStaircase(5, { passNeed: 2, maxTrials: 4 });
  s.answer(true); s.answer(true);          // niveau 0 réussi
  s.answer(true); s.answer(true);          // niveau 1 réussi
  s.answer(false); s.answer(false); s.answer(false); // niveau 2 : 3 fautes
  assert.equal(s.state.done, true);
  assert.equal(s.state.result, 1);
});

test("staircase : échec immédiat → résultat null", () => {
  const s = core.createStaircase(5);
  s.answer(false); s.answer(false); s.answer(false);
  assert.equal(s.state.done, true);
  assert.equal(s.state.result, null);
});

test("staircase : mélange succès/échecs dans un niveau", () => {
  const s = core.createStaircase(3, { passNeed: 2, maxTrials: 4 });
  // niveau 0 : F B F B → 2 bonnes en 4 essais = réussi
  s.answer(false); s.answer(true); s.answer(false);
  assert.equal(s.state.done, false);
  s.answer(true);
  assert.equal(s.state.level, 1);
});

test("gammaFromMatch : 186 ≈ gamma 2,2 ; bornes sûres", () => {
  close(core.gammaFromMatch(186), 2.2, 0.05);
  assert.equal(core.gammaFromMatch(0), 2.2);   // valeur aberrante → défaut
  assert.equal(core.gammaFromMatch(255), 2.2);
  assert.ok(core.gammaFromMatch(240) <= 3.2);
});

test("grayForContrast : cohérent avec le gamma", () => {
  // contraste 0 → blanc ; contraste 1 → noir
  assert.equal(core.grayForContrast(0, 2.2), 255);
  assert.equal(core.grayForContrast(1, 2.2), 0);
  // 50 % de contraste sur gamma 2 : v = 255·(0,5)^(1/2)
  assert.equal(core.grayForContrast(0.5, 2), Math.round(255 * Math.SQRT1_2));
});

test("xyYtosRGB : blanc D65 → (255,255,255)", () => {
  const rgb = core.xyYtosRGB(0.3127, 0.329, 1);
  assert.ok(rgb);
  rgb.forEach((v) => assert.ok(Math.abs(v - 255) <= 1, String(rgb)));
});

test("xyYtosRGB : hors gamut → null", () => {
  assert.equal(core.xyYtosRGB(0.7, 0.29, 0.9), null); // rouge spectral trop lumineux
});

test("planches : les paires de confusion restent dans le gamut sRGB", () => {
  for (const type of ["protan", "deutan", "tritan"]) {
    const pair = core.PLATE_COLORS[type];
    for (const Y of [core.PLATE_Y_RANGE[0], core.PLATE_Y_RANGE[1]]) {
      assert.ok(core.xyYtosRGB(pair.fig[0], pair.fig[1], Y), `${type} fig Y=${Y}`);
      assert.ok(core.xyYtosRGB(pair.bg[0], pair.bg[1], Y), `${type} bg Y=${Y}`);
    }
  }
});

test("confusionPair : les deux points sont sur la ligne du point copunctal", () => {
  const base = [0.33, 0.35];
  const { fig, bg } = core.confusionPair("protan", base, 0.04);
  const cp = core.COPUNCTAL.protan;
  const cross = (p) => (p[0] - cp[0]) * (base[1] - cp[1]) - (p[1] - cp[1]) * (base[0] - cp[0]);
  close(cross(fig), 0, 1e-9);
  close(cross(bg), 0, 1e-9);
});

test("vernierOffsetPx : 20 secondes d'arc à 70 cm ≈ sub-pixel", () => {
  const px = core.vernierOffsetPx(20, 70, 4);
  assert.ok(px > 0.1 && px < 0.5, String(px));
});

test("blindSpotEval", () => {
  assert.equal(core.blindSpotEval(15.5, 5.5).kind, "ok");
  assert.equal(core.blindSpotEval(15.5, 9.5).kind, "warn");
  assert.equal(core.blindSpotEval(25, 5).kind, "warn");
  assert.equal(core.blindSpotEval(null, null).kind, "warn");
});

test("readingStats : vitesse max et taille critique", () => {
  const r = core.readingStats([
    { mm: 2.6, wpm: 180 }, { mm: 2.0, wpm: 185 }, { mm: 1.6, wpm: 178 },
    { mm: 1.25, wpm: 170 }, { mm: 1.0, wpm: 120 }, { mm: 0.8, wpm: 60 }
  ]);
  assert.equal(r.maxWpm, 185);
  assert.equal(r.cpsMm, 1.25); // 170 ≥ 0,8×185=148 ; 120 < 148
  close(r.recoMm, 1.63, 0.01);
  assert.equal(core.readingStats([]), null);
});

test("interprétations : seuils", () => {
  assert.equal(core.evalAcuity(10).kind, "ok");
  assert.equal(core.evalAcuity(6).kind, "warn");
  assert.equal(core.evalAcuity(3).kind, "alert");
  assert.equal(core.evalContrast(1.8).kind, "ok");
  assert.equal(core.evalContrast(1.2).kind, "warn");
  assert.equal(core.evalContrast(0.5).kind, "alert");
  assert.equal(core.evalNear(0.8).kind, "ok");
  assert.equal(core.evalNear(null).kind, "alert");
  assert.equal(core.evalStrain(2).kind, "ok");
  assert.equal(core.evalStrain(9).kind, "alert");
  assert.equal(core.evalVernier(25).kind, "ok");
  assert.equal(core.evalVernier(90).kind, "warn");
});

test("distance par iris : calibration puis mesure réciproques", () => {
  const focal = core.focalFromIris(38, 70); // 38 px d'iris à 70 cm
  close(core.distFromIris(38, focal), 70, 1e-9);
  close(core.distFromIris(76, focal), 35, 1e-9); // 2× plus proche → iris 2× plus grand
  assert.equal(core.distFromIris(0, focal), null);
});
