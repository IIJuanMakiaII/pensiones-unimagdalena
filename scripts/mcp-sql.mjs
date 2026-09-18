// Ejecuta un archivo .sql contra el proyecto de Supabase usando el MCP.
//
// Uso:  node scripts/mcp-sql.mjs supabase/pruebas/mi-consulta.sql
//
// Ojo: `execute_sql` devuelve solo el ÚLTIMO resultado, así que el SELECT que te
// interesa ver debe ser la última sentencia del archivo. Para dejar la
// referencia del resultado en texto plano, termina con:
//   select 'QARESULT|' || ... as r;
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROYECTO = "ayznnqkacpdvvufclhon";

const archivo = process.argv[2];
if (!archivo) {
  console.error("Uso: node scripts/mcp-sql.mjs <archivo.sql>");
  process.exit(1);
}

const consulta = readFileSync(path.resolve(RAIZ, archivo), "utf8");
const args = path.join(RAIZ, "tmp", "mcp-sql-args.json");
mkdirSync(path.dirname(args), { recursive: true });
writeFileSync(args, JSON.stringify({ project_id: PROYECTO, query: consulta }), "utf8");

const salida = execFileSync("accio-mcp-cli", ["call", "execute_sql", "--json-file", args], {
  encoding: "utf8",
  shell: true,
  maxBuffer: 32 * 1024 * 1024,
});

console.log(salida);
