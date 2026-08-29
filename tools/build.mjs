/* Injecte src/core.js dans index.html entre les marqueurs ==CORE==.
 * index.html reste un fichier unique auto-suffisant ; src/core.js reste
 * la source de vérité testée. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = join(root, "index.html");
const core = readFileSync(join(root, "src/core.js"), "utf8").trimEnd();
const html = readFileSync(htmlPath, "utf8");

const BEGIN = "/* ==CORE-BEGIN== (généré par tools/build.mjs — ne pas éditer ici) */";
const END = "/* ==CORE-END== */";
const start = html.indexOf(BEGIN);
const end = html.indexOf(END);
if (start === -1 || end === -1 || end < start) {
  console.error("Marqueurs ==CORE== introuvables dans index.html");
  process.exit(1);
}
const out = html.slice(0, start + BEGIN.length) + "\n" + core + "\n" + html.slice(end);
if (out === html) {
  console.log("index.html déjà à jour");
} else {
  writeFileSync(htmlPath, out);
  console.log("core.js injecté dans index.html");
}
