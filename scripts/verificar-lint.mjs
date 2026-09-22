/**
 * Paso de lint, honesto consigo mismo.
 *
 * El proyecto declara `"lint": "next lint"` pero **no tiene ESLint instalado**
 * (`eslint` y `eslint-config-next` no están en `package.json` ni en el árbol de
 * dependencias). Ejecutar `next lint` así, además de no analizar nada, abre un
 * asistente interactivo que en integración continua dejaría el paso colgado.
 *
 * Este script hace lo correcto en cada caso:
 *
 *  - **Sin ESLint** → SALTADO, con el motivo y el comando exacto que lo activa.
 *    Nunca se reporta como superado: una luz verde que no comprobó nada da
 *    confianza sin respaldo, que es peor que no tener la comprobación.
 *  - **Con ESLint** → ejecuta `next lint` de verdad y propaga su código de
 *    salida. Se activa solo: no hay que tocar la integración continua.
 *
 * Uso:  node scripts/verificar-lint.mjs
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EN_CI = process.env.GITHUB_ACTIONS === "true";

const CONFIGS = [".eslintrc", ".eslintrc.json", ".eslintrc.js", ".eslintrc.cjs", "eslint.config.js", "eslint.config.mjs", "eslint.config.ts"];
const BINARIOS = ["node_modules/eslint/package.json", "node_modules/eslint-config-next/package.json"];

const configuraciónPresente = CONFIGS.some((nombre) => existsSync(path.join(RAIZ, nombre)));
const dependenciasPresentes = BINARIOS.every((ruta) => existsSync(path.join(RAIZ, ruta)));

const COMO_ACTIVARLO = [
  "  npm install --save-dev eslint@^8 eslint-config-next@^14.2.35",
  "  # después, añadir al package.json:",
  '  #   "eslintConfig": { "extends": "next/core-web-vitals" }',
  "  # y comprometer el package-lock.json actualizado",
].join("\n");

if (!configuraciónPresente || !dependenciasPresentes) {
  const motivo = [
    !dependenciasPresentes ? "faltan las dependencias eslint / eslint-config-next" : null,
    !configuraciónPresente ? "no hay archivo de configuración de ESLint" : null,
  ]
    .filter(Boolean)
    .join(" y ");

  console.log("SALTADO  lint de ESLint — " + motivo);
  console.log("         Esto NO es una comprobación superada: no se analizó el código.");
  console.log("         `next lint` sin ESLint no analiza nada y abre un asistente interactivo.");
  console.log("         Para activarlo (una vez, con red):");
  console.log(COMO_ACTIVARLO);
  console.log("         El paso de integración continua lo ejecutará solo cuando exista.");

  if (EN_CI) {
    // Anotación visible en la cabecera del run: el verde del run no debe
    // confundirse con «el lint pasó».
    console.log(
      `::warning title=Lint SALTADO::No hay ESLint instalado: el análisis estático de estilo no se ejecutó. ` +
        `Instala eslint y eslint-config-next para activarlo.`
    );
    const resumen = process.env.GITHUB_STEP_SUMMARY;
    if (resumen) {
      appendFileSync(
        resumen,
        [
          "### ⏭️ SALTADO — lint (ESLint)",
          "",
          `**Motivo:** ${motivo}.`,
          "",
          "No se analizó el código: este paso **no** cuenta como superado.",
          "",
          "<details><summary>Para activarlo</summary>",
          "",
          "```bash",
          "npm install --save-dev eslint@^8 eslint-config-next@^14.2.35",
          "```",
          "",
          "Después añade al `package.json`:",
          "",
          '```json',
          '"eslintConfig": { "extends": "next/core-web-vitals" }',
          "```",
          "",
          "Y compromete el `package-lock.json` actualizado. El paso de integración continua lo ejecutará solo.",
          "",
          "</details>",
          "",
        ].join("\n")
      );
    }
  }

  process.exit(0);
}

console.log("ESLint presente: ejecutando `next lint`…\n");

try {
  execFileSync(process.execPath, ["node_modules/next/dist/bin/next", "lint"], {
    cwd: RAIZ,
    stdio: "inherit",
  });
} catch (error) {
  console.error("\nFALLO  `next lint` reportó problemas (código " + (error.status ?? "?") + ")");
  process.exit(typeof error.status === "number" ? error.status : 1);
}

console.log("\nOK  lint sin problemas");
