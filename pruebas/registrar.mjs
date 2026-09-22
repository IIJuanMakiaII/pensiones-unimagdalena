/**
 * Punto de entrada de las pruebas: registra el resolutor del alias `@/`.
 *
 * Se usa con el ejecutor de pruebas que ya incluye Node:
 *
 *   node --import ./pruebas/registrar.mjs --test pruebas/*.prueba.ts
 *
 * Nota: las pruebas importan archivos `.ts` directamente, lo que aprovecha el
 * "type stripping" de Node (estable desde Node 22). Por eso la integración
 * continua fija Node 22 — no es una preferencia, es el requisito de ejecución.
 */
import { register } from "node:module";

register(new URL("./cargador-alias.mjs", import.meta.url).href);
