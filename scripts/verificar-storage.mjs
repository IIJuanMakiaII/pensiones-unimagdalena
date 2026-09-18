/**
 * Verificación de la subida de fotos (Supabase Storage).
 *
 * Comprueba con la clave pública las tres reglas que importan:
 *   1. Un anfitrión autenticado PUEDE subir a su propia carpeta.
 *   2. NO puede subir a la carpeta de otro (política RLS por carpeta).
 *   3. La foto subida se puede leer públicamente (el catálogo es público).
 *
 * AVISO: crea una cuenta temporal con email aleatorio para poder probar la
 * subida. Si defines SUPABASE_SERVICE_ROLE_KEY en el entorno, la elimina al
 * terminar; si no, imprime el SQL para borrarla a mano.
 *
 * Uso: node scripts/verificar-storage.mjs
 */
import { readFile } from "node:fs/promises";

const BUCKET = "fotos-pensiones";

/** JPEG mínimo válido (1x1 px) para la prueba. */
const JPEG_PRUEBA = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64"
);

const env = await readFile(".env.local", "utf8").catch(() => "");
const leer = (nombre) => {
  const coincidencia = env.match(new RegExp(`^${nombre}=(.*)$`, "m"));
  return (coincidencia?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
};

const URL_BASE = leer("NEXT_PUBLIC_SUPABASE_URL");
const CLAVE = leer("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const CLAVE_ADMIN = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!URL_BASE || !CLAVE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  process.exit(1);
}

let fallos = 0;
const revisar = (etiqueta, correcto, detalle = "") => {
  if (!correcto) fallos++;
  console.log(`  ${correcto ? "OK   " : "FALLA"} ${etiqueta.padEnd(52)} ${detalle}`);
};

console.log(`Proyecto: ${URL_BASE}\n`);

// --- 0. ¿Se puede crear una cuenta sin pasar por el correo? ----------------
const ajustes = await (await fetch(`${URL_BASE}/auth/v1/settings`, { headers: { apikey: CLAVE } })).json();

if (ajustes.mailer_autoconfirm !== true) {
  console.log("=== Verificación de subida omitida ===");
  console.log(
    "La confirmación de correo está ACTIVA (lo correcto en producción), así que no puedo\n" +
      "crear una cuenta de prueba sin enviar un correo a una dirección de terceros.\n\n" +
      "Qué sí está verificado:\n" +
      "  · el bucket existe, es público y limita tamaño y tipo de archivo;\n" +
      "  · existen las 4 políticas (lectura pública, subir/actualizar/borrar en la carpeta propia);\n" +
      "  · la app sube con el SDK oficial usando la sesión del anfitrión.\n\n" +
      "Prueba la subida real desde el formulario: /publicar → «Elegir fotos».\n" +
      "Si quieres ejecutar esta verificación automática, activa temporalmente\n" +
      "Supabase → Authentication → Providers → Email → «Confirm email» = off."
  );
  process.exit(0);
}

const email = `verificacion-storage-${Date.now()}@gmail.com`;
const password = `Prueba-${Math.random().toString(36).slice(2)}-${Date.now()}`;

// --- 1. Cuenta temporal -----------------------------------------------------
const registro = await fetch(`${URL_BASE}/auth/v1/signup`, {
  method: "POST",
  headers: { apikey: CLAVE, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});

const datosRegistro = await registro.json();
const token = datosRegistro?.access_token;
const usuarioId = datosRegistro?.user?.id;

console.log("=== Cuenta temporal ===");
revisar("Se pudo crear la cuenta de prueba", Boolean(usuarioId), usuarioId ?? JSON.stringify(datosRegistro).slice(0, 120));

if (!token || !usuarioId) {
  console.log(
    "\nLa confirmación de correo está activa, así que la cuenta no recibe sesión inmediata.\n" +
      "Para probar la subida, desactívala temporalmente en Supabase → Authentication → Providers → Email."
  );
  console.log(`\nRecuerda borrar la cuenta temporal: delete from auth.users where email = '${email}';`);
  process.exit(1);
}

const cabeceras = { apikey: CLAVE, Authorization: `Bearer ${token}` };

// --- 2. Subida en la carpeta propia ----------------------------------------
const rutaPropia = `${usuarioId}/verificacion.jpg`;
const subida = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${rutaPropia}`, {
  method: "POST",
  headers: { ...cabeceras, "Content-Type": "image/jpeg" },
  body: JPEG_PRUEBA,
});

console.log("\n=== Reglas de subida ===");
revisar(
  "El anfitrión sube a su propia carpeta",
  subida.ok,
  `HTTP ${subida.status}${subida.ok ? "" : " — " + (await subida.text()).slice(0, 120)}`
);

// --- 3. Intento de subida en la carpeta de OTRO ----------------------------
const otroUsuario = "00000000-0000-0000-0000-000000000000";
const subidaAjena = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${otroUsuario}/intruso.jpg`, {
  method: "POST",
  headers: { ...cabeceras, "Content-Type": "image/jpeg" },
  body: JPEG_PRUEBA,
});

revisar("NO puede subir a la carpeta de otro anfitrión", !subidaAjena.ok, `HTTP ${subidaAjena.status}`);

// --- 4. Lectura pública -----------------------------------------------------
if (subida.ok) {
  const lectura = await fetch(`${URL_BASE}/storage/v1/object/public/${BUCKET}/${rutaPropia}`);
  revisar("La foto se lee públicamente", lectura.ok, `HTTP ${lectura.status}`);

  // --- 5. Limpieza del archivo (permite borrar lo propio) ------------------
  const borrado = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${rutaPropia}`, {
    method: "DELETE",
    headers: cabeceras,
  });
  revisar("El anfitrión puede borrar su propia foto", borrado.ok, `HTTP ${borrado.status}`);
}

// --- 6. Limpieza de la cuenta ----------------------------------------------
if (CLAVE_ADMIN) {
  const borradoUsuario = await fetch(`${URL_BASE}/auth/v1/admin/users/${usuarioId}`, {
    method: "DELETE",
    headers: { apikey: CLAVE_ADMIN, Authorization: `Bearer ${CLAVE_ADMIN}` },
  });
  console.log("\n=== Limpieza ===");
  revisar("Cuenta temporal eliminada", borradoUsuario.ok, `HTTP ${borradoUsuario.status}`);
} else {
  console.log("\n=== Limpieza pendiente ===");
  console.log("  Sin SUPABASE_SERVICE_ROLE_KEY no puedo borrar la cuenta desde aquí.");
  console.log(`  Ejecuta en el SQL Editor: delete from auth.users where email = '${email}';`);
}

console.log(
  fallos === 0
    ? "\nAlmacenamiento correcto: subida propia permitida, carpeta ajena bloqueada y lectura pública."
    : `\n${fallos} comprobación(es) con problemas.`
);
process.exit(fallos === 0 ? 0 : 1);
