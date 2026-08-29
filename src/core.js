/* Okulist core — logique pure, sans DOM.
 * Ce fichier est la source de vérité : il est injecté tel quel dans index.html
 * par tools/build.mjs (entre les marqueurs ==CORE==) et testé par test/core.test.mjs. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.OkulistCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------- géométrie visuelle ---------- */
  const DEG = Math.PI / 180;

  /* Angle visuel (degrés) → pixels à l'écran, et réciproque. */
  function degToPx(deg, distCm, pxmm) {
    return Math.tan(deg * DEG) * distCm * 10 * pxmm;
  }
  function pxToDeg(px, distCm, pxmm) {
    return Math.atan(px / pxmm / (distCm * 10)) / DEG;
  }

  /* Échelle d'acuité française en dixièmes.
   * Anneau de Landolt : ouverture = 1/acuité minutes d'arc, anneau = 5 ouvertures. */
  const DX_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
  function landoltGapPx(dx, distCm, pxmm) {
    const arcmin = 10 / dx;
    return degToPx(arcmin / 60, distCm, pxmm);
  }

  /* ---------- escalier psychophysique ----------
   * Descente niveau par niveau. À chaque niveau : réussite après `passNeed`
   * bonnes réponses ; échec dès qu'il devient impossible de les atteindre
   * en `maxTrials` essais. L'échec fige le résultat au dernier niveau réussi. */
  function createStaircase(nLevels, opts) {
    const o = Object.assign({ passNeed: 2, maxTrials: 4 }, opts);
    const st = { level: 0, ok: 0, n: 0, lastPassed: null, done: false, result: null };
    function finish(levelIndex) {
      st.done = true;
      st.result = levelIndex;
    }
    return {
      get state() { return Object.assign({}, st); },
      answer(correct) {
        if (st.done) return st;
        st.n++;
        if (correct) st.ok++;
        if (st.ok >= o.passNeed) {
          st.lastPassed = st.level;
          if (st.level >= nLevels - 1) finish(st.lastPassed);
          else { st.level++; st.ok = 0; st.n = 0; }
        } else if (st.n - st.ok > o.maxTrials - o.passNeed) {
          finish(st.lastPassed);
        }
        return Object.assign({}, st);
      }
    };
  }

  /* ---------- gamma ----------
   * L'utilisateur ajuste un gris uni jusqu'à le confondre avec une trame
   * 1px noir / 1px blanc (luminance physique 50 %).
   * v est la valeur 0..255 du gris apparié. */
  function gammaFromMatch(v) {
    if (!(v > 10 && v < 245)) return 2.2;
    const g = Math.log(0.5) / Math.log(v / 255);
    return Math.min(3.2, Math.max(1.4, g));
  }
  /* Gris (0..255) produisant un contraste de Weber c sur fond blanc,
   * pour un écran de gamma donné. */
  function grayForContrast(c, gamma) {
    return Math.round(255 * Math.pow(1 - c, 1 / (gamma || 2.2)));
  }
  const CONTRASTS = [1, 0.5, 0.25, 0.125, 0.06, 0.03, 0.015];

  /* ---------- couleur : lignes de confusion CIE ---------- */
  function xyYtosRGB(x, y, Y) {
    if (y <= 0) return null;
    const X = (x * Y) / y, Z = ((1 - x - y) * Y) / y;
    const rl = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
    const gl = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
    const bl = 0.0557 * X - 0.204 * Y + 1.057 * Z;
    const enc = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
    const out = [rl, gl, bl].map((c) => Math.round(enc(c) * 255));
    if (out.some((v) => v < 0 || v > 255 || Number.isNaN(v))) return null;
    return out;
  }

  /* Points copunctaux (chromaticités xy que confond chaque type de dichromate). */
  const COPUNCTAL = {
    protan: [0.7465, 0.2535],
    deutan: [1.4, -0.4],
    tritan: [0.1748, 0.0]
  };
  /* Deux chromaticités sur la même ligne de confusion : un dichromate du type
   * donné ne les distingue pas (à luminance égale). */
  function confusionPair(type, base, delta) {
    const cp = COPUNCTAL[type];
    const dx = cp[0] - base[0], dy = cp[1] - base[1];
    const n = Math.hypot(dx, dy);
    const ux = dx / n, uy = dy / n;
    return {
      fig: [base[0] + ux * delta, base[1] + uy * delta],
      bg: [base[0] - ux * delta, base[1] - uy * delta]
    };
  }
  /* Palettes prêtes à l'emploi pour les planches (base et delta choisis
   * pour rester dans le gamut sRGB sur la plage de luminance utilisée). */
  const PLATE_COLORS = {
    protan: confusionPair("protan", [0.33, 0.35], 0.042),
    deutan: confusionPair("deutan", [0.33, 0.36], 0.05),
    tritan: confusionPair("tritan", [0.3, 0.315], 0.038)
  };
  const PLATE_Y_RANGE = [0.22, 0.42];

  /* ---------- acuité vernier ---------- */
  const VERNIER_ARCSEC = [120, 80, 50, 30, 20, 12];
  function vernierOffsetPx(arcsec, distCm, pxmm) {
    return degToPx(arcsec / 3600, distCm, pxmm);
  }

  /* ---------- tache aveugle ---------- */
  /* Position normale : ~15,5° en temporal, largeur ~5,5°. */
  function blindSpotEval(centerDeg, widthDeg) {
    if (centerDeg == null || widthDeg == null) return { kind: "warn", label: "Non mesurée" };
    if (widthDeg > 8.5) return { kind: "warn", label: "Élargie — à faire vérifier" };
    if (centerDeg < 11 || centerDeg > 20) return { kind: "warn", label: "Position atypique" };
    return { kind: "ok", label: "Normale" };
  }

  /* ---------- vitesse de lecture (type MNREAD simplifié) ---------- */
  /* samples : [{mm, wpm}] — taille de caractère (hauteur de capitale, mm)
   * et vitesse mesurée. Renvoie vitesse max, taille critique (plus petite
   * taille conservant ≥ 80 % de la vitesse max) et taille recommandée. */
  function readingStats(samples) {
    const valid = samples.filter((s) => s.wpm > 0);
    if (!valid.length) return null;
    const maxWpm = Math.max(...valid.map((s) => s.wpm));
    const fast = valid.filter((s) => s.wpm >= 0.8 * maxWpm);
    const cps = Math.min(...fast.map((s) => s.mm));
    return { maxWpm: Math.round(maxWpm), cpsMm: cps, recoMm: +(cps * 1.3).toFixed(2) };
  }

  /* ---------- interprétations ---------- */
  function evalAcuity(dx) {
    if (dx >= 8) return { kind: "ok", label: "Bonne" };
    if (dx >= 5) return { kind: "warn", label: "Modérément réduite" };
    return { kind: "alert", label: "Réduite" };
  }
  function evalContrast(logCS) {
    if (logCS >= 1.5) return { kind: "ok", label: "Bonne" };
    if (logCS >= 1.0) return { kind: "warn", label: "Un peu basse" };
    return { kind: "alert", label: "Basse" };
  }
  function evalNear(mmH) {
    if (mmH == null) return { kind: "alert", label: "Réduite" };
    if (mmH <= 1.0) return { kind: "ok", label: "Bonne" };
    if (mmH <= 1.6) return { kind: "warn", label: "Un peu juste" };
    return { kind: "alert", label: "Réduite" };
  }
  function evalStrain(score) {
    if (score <= 3) return { kind: "ok", label: "Faible" };
    if (score <= 7) return { kind: "warn", label: "Modérée" };
    return { kind: "alert", label: "Marquée" };
  }
  function evalVernier(arcsec) {
    if (arcsec == null) return { kind: "warn", label: "Non mesurée" };
    if (arcsec <= 30) return { kind: "ok", label: "Excellente" };
    if (arcsec <= 60) return { kind: "ok", label: "Bonne" };
    return { kind: "warn", label: "Réduite" };
  }

  /* ---------- distance par webcam ----------
   * Diamètre d'iris humain quasi constant : 11,7 mm.
   * focalPx est calibrée une fois à distance connue. */
  const IRIS_MM = 11.7;
  function focalFromIris(irisPx, distCm) { return (irisPx * distCm * 10) / IRIS_MM; }
  function distFromIris(irisPx, focalPx) {
    if (!(irisPx > 0) || !(focalPx > 0)) return null;
    return (focalPx * IRIS_MM) / irisPx / 10;
  }

  return {
    DEG, degToPx, pxToDeg,
    DX_LEVELS, landoltGapPx,
    createStaircase,
    gammaFromMatch, grayForContrast, CONTRASTS,
    xyYtosRGB, COPUNCTAL, confusionPair, PLATE_COLORS, PLATE_Y_RANGE,
    VERNIER_ARCSEC, vernierOffsetPx,
    blindSpotEval, readingStats,
    evalAcuity, evalContrast, evalNear, evalStrain, evalVernier,
    IRIS_MM, focalFromIris, distFromIris
  };
});
