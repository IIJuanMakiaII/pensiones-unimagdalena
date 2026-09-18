/**
 * Verificación extremo a extremo de la gestión de disponibilidad (tarea #12).
 *
 * Comprueba sobre la base real y sobre el HTML real de la aplicación que una
 * habitación marcada como ocupada deja de ofrecerse, que un anfitrión distinto
 * no puede tocarla y que retirar la publicación la oculta al público.
 *
 * Crea una publicación temporal, la usa, y la borra en la misma ejecución
 * (comprueba `residuos=0` al terminar). Espera a la ventana de ISR (60 s) antes
 * de leer las páginas cuyo estado cambió.
 *
 * Uso:  node scripts/verificar-disponibilidad.mjs        (requiere el servidor en el puerto 3000)
 *       BASE_URL=http://127.0.0.1:3000 node scripts/verificar-disponibilidad.mjs
 *
 * OJO: cada ficha que Next renderiza bajo demanda —incluidas las de prueba y las
 * de ids inexistentes— queda como HTML en `.next/server/app/pensiones/`. Eso
 * contamina los verificadores que recorren esa carpeta (por ejemplo
 * `verificar-seo.mjs`, que llegó a leer 11 fichas de las cuales 10 eran pruebas).
 * Después de ejecutar este script hay que recompilar (`npm run build`) antes de
 * dar por buenos los verificadores de HTML estático.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROYECTO = "ayznnqkacpdvvufclhon";
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const TITULO = "Prueba QA disponibilidad";
/** UUID que no pertenece a ninguna publicación: simula "otro anfitrión". */
const AJENO = "11111111-1111-4111-8111-111111111111";

/* ------------------------------------------------------------------ SQL ---- */

const SQL_FASE1 = `
delete from public.habitaciones
where pension_id in (select id from public.pensiones where titulo = '${TITULO}');
delete from public.pensiones where titulo = '${TITULO}';

do $qa$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users order by created_at limit 1;
  if v_uid is null then raise exception 'No hay usuarios en auth.users'; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);

  perform public.crear_pension_con_habitaciones(
    jsonb_build_object(
      'titulo', '${TITULO}',
      'descripcion', 'Publicacion temporal de verificacion QA del panel de disponibilidad.',
      'direccion', 'Calle 30 # 12-45',
      'barrio', 'Mamatoco',
      'distancia_a_pie_minutos', 7,
      'servicios', jsonb_build_array('WiFi de alta velocidad'),
      'normas', jsonb_build_array('No fumadores'),
      'imagenes', jsonb_build_array(),
      'activa', true
    ),
    jsonb_build_array(
      jsonb_build_object('tipo','individual','genero','mixto','precio_mensual_cop',480000,'alimentacion_incluida',false,'disponible',true),
      jsonb_build_object('tipo','compartida','genero','femenino','precio_mensual_cop',300000,'alimentacion_incluida',false,'disponible',false)
    )
  );
end $qa$;

select 'QARESULT|' || p.id || '|precio=' || p.precio_mensual
  || '|habitaciones=' || (select count(*) from public.habitaciones h where h.pension_id = p.id)
  || '|libres=' || (select count(*) from public.habitaciones h where h.pension_id = p.id and h.disponible)
  as r
from public.pensiones p where p.titulo = '${TITULO}';
`;

const SQL_FASE2 = `
do $qa$
declare
  v_propietario uuid;
  v_pension uuid;
  v_habitacion uuid;
  f_otro integer := -99;
  f_anon integer := -99;
  f_propio integer := -99;
begin
  select id into v_propietario from auth.users order by created_at limit 1;
  select id into v_pension from public.pensiones where titulo = '${TITULO}';
  select id into v_habitacion from public.habitaciones
    where pension_id = v_pension and disponible order by precio_mensual_cop limit 1;

  if v_habitacion is null then raise exception 'No hay habitacion libre en la publicacion de prueba'; end if;

  -- (1) Otro anfitrion (identidad distinta, autenticada) intenta ocuparla.
  perform set_config('request.jwt.claims',
    json_build_object('sub', '${AJENO}', 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    update public.habitaciones set disponible = false where id = v_habitacion;
    get diagnostics f_otro = row_count;
  exception when others then f_otro := -1; end;

  -- (2) Sin sesion.
  perform set_config('role', 'anon', true);
  begin
    update public.habitaciones set disponible = false where id = v_habitacion;
    get diagnostics f_anon = row_count;
  exception when others then f_anon := -1; end;

  -- (3) El dueno: aqui SI debe cambiar, y es el cambio que queremos observar.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_propietario::text, 'role', 'authenticated')::text, true);
  begin
    update public.habitaciones set disponible = false where id = v_habitacion;
    get diagnostics f_propio = row_count;
  exception when others then f_propio := -1; end;

  perform set_config('qa.res',
    format('otro=%s;anon=%s;propio=%s', f_otro, f_anon, f_propio), false);
exception when others then
  perform set_config('qa.res', 'ERROR=' || sqlerrm, false);
end $qa$;

select 'QARESULT|' || coalesce(current_setting('qa.res', true), 'sin_datos')
  || '|precio=' || coalesce((select precio_mensual::text from public.pensiones where titulo = '${TITULO}'), 'null')
  || '|libres=' || (select count(*) from public.habitaciones h join public.pensiones p on p.id = h.pension_id
                    where p.titulo = '${TITULO}' and h.disponible)
  as r;
`;

const SQL_FASE3 = `
do $qa$
declare
  v_propietario uuid;
  v_pension uuid;
  f integer := -99;
begin
  select id into v_propietario from auth.users order by created_at limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_propietario::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select id into v_pension from public.pensiones where titulo = '${TITULO}';
  update public.pensiones set activa = false where id = v_pension;
  get diagnostics f = row_count;

  perform set_config('qa.res', 'retirada_filas=' || f, false);
exception when others then
  perform set_config('qa.res', 'ERROR=' || sqlerrm, false);
end $qa$;

select 'QARESULT|' || coalesce(current_setting('qa.res', true), 'sin_datos')
  || '|activa=' || coalesce((select activa::text from public.pensiones where titulo = '${TITULO}'), 'null')
  as r;
`;

const SQL_FASE4 = `
do $qa$
declare
  v_propietario uuid;
  v_pension uuid;
  f integer := -99;
begin
  select id into v_propietario from auth.users order by created_at limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_propietario::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select id into v_pension from public.pensiones where titulo = '${TITULO}';
  update public.pensiones set activa = true where id = v_pension;
  get diagnostics f = row_count;

  perform set_config('qa.res', 'republicada_filas=' || f, false);
end $qa$;

delete from public.habitaciones
where pension_id in (select id from public.pensiones where titulo = '${TITULO}');
delete from public.pensiones where titulo = '${TITULO}';

select 'QARESULT|' || coalesce(current_setting('qa.res', true), 'sin_datos')
  || '|residuos=' || (select count(*) from public.pensiones where titulo like 'Prueba QA%')
  as r;
`;

/* --------------------------------------------------------------- helpers ---- */

function sql(consulta) {
  const archivo = path.join(RAIZ, "tmp", "qa-disponibilidad-args.json");
  mkdirSync(path.dirname(archivo), { recursive: true });
  writeFileSync(archivo, JSON.stringify({ project_id: PROYECTO, query: consulta }), "utf8");

  const salida = execFileSync("accio-mcp-cli", ["call", "execute_sql", "--json-file", archivo], {
    encoding: "utf8",
    shell: true,
    maxBuffer: 32 * 1024 * 1024,
  });

  const coincidencia = salida.match(/QARESULT\|([^\\"\n]*)/);
  return coincidencia ? coincidencia[1] : `SIN_RESULTADO: ${salida.slice(0, 200)}`;
}

async function pedir(ruta) {
  const respuesta = await fetch(BASE + ruta, { headers: { "cache-control": "no-cache" } });
  return { estado: respuesta.status, html: await respuesta.text() };
}

/**
 * Lee una página esperando a que refleje un cambio hecho por SQL.
 *
 * El arnés cambia los datos directamente en la base, así que no dispara
 * `revalidateTag`: el cambio solo se ve cuando caducan las dos cachés de 60 s
 * (la de la página y la de datos), y pueden hacerlo en cascada. Una segunda
 * lectura a los 4 s no bastaba: medía el estado anterior y producía fallos
 * falsos (llegó a dar 17/23 sin que el código tuviera nada roto).
 *
 * Se sondea hasta que la condición se cumple, con un tope de intentos. La
 * condición debe describir el estado NUEVO, nunca la ausencia de algo que ya
 * faltaba: así el sondeo no puede pasar en vacío.
 */
async function pedirHasta(ruta, condicion, intentosMaximos = 9, esperaMs = 12000) {
  let respuesta = await pedir(ruta);
  let intento = 1;

  while (intento < intentosMaximos && !condicion(respuesta)) {
    await esperar(esperaMs);
    respuesta = await pedir(ruta);
    intento += 1;
  }

  return { ...respuesta, intentos: intento };
}

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/** Ventana de texto alrededor de la última aparición de la aguja (la tarjeta
 *  va después del JSON-LD, así que la primera aparición no sirve de ancla). */
function ventana(html, aguja, antes = 200, despues = 1400) {
  const posicion = html.lastIndexOf(aguja);
  if (posicion === -1) return "";
  return html.slice(Math.max(0, posicion - antes), posicion + despues).replace(/\s+/g, " ");
}

/** Guarda una muestra del render para poder revisarla cuando algo falla. */
function volcar(nombre, contenido) {
  const carpeta = path.join(RAIZ, "tmp");
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(path.join(carpeta, nombre), contenido, "utf8");
}

const resultados = [];
function comprobar(nombre, condicion, detalle = "") {
  resultados.push({ nombre, ok: Boolean(condicion), detalle });
  console.log(`  ${condicion ? "OK  " : "FALLO"}  ${nombre}${detalle ? `  [${detalle}]` : ""}`);
}

/* ------------------------------------------------------------------ flujo ---- */

console.log(`Verificación de disponibilidad contra ${BASE}\n`);

/* --- 1. Publicación de prueba: 1 habitación libre + 1 ocupada ------------- */
const fase1 = sql(SQL_FASE1);
const id = fase1.split("|")[0];
comprobar("1. publicación de prueba creada", /^[0-9a-f-]{36}$/.test(id), `id=${id}`);
comprobar("1. precio derivado de la habitación LIBRE", fase1.includes("precio=480000"), fase1);
comprobar(
  "1. 2 habitaciones, 1 libre",
  fase1.includes("habitaciones=2") && fase1.includes("libres=1"),
  fase1
);

/* --- 2. Estado con habitación libre: se puede reservar -------------------- */
const detalleA = await pedir(`/pensiones/${id}`);
comprobar("2. la ficha ofrece reservar la habitación libre", detalleA.html.includes("Reservar"), `HTTP ${detalleA.estado}`);
comprobar(
  "2. datos estructurados con el precio reservable",
  detalleA.html.includes("480000 COP"),
  ventana(detalleA.html, "priceRange", 40, 40)
);

/* --- 3. Otro anfitrión no puede tocarla; el dueño la marca ocupada -------- */
const fase2 = sql(SQL_FASE2);
comprobar("3. otro anfitrión NO puede modificarla", fase2.includes("otro=0"), fase2);
comprobar(
  "3. un anónimo NO puede modificarla",
  fase2.includes("anon=0") || fase2.includes("anon=-1"),
  fase2
);
comprobar("3. el dueño SÍ puede modificarla", fase2.includes("propio=1"), fase2);
comprobar("3. la habitación queda ocupada", fase2.includes("libres=0"), fase2);

/* --- 4. Estado con todas ocupadas: la ficha ya no ofrece reservar --------- */
const detalleB = await pedirHasta(`/pensiones/${id}`, (r) => !r.html.includes(">Reservar<"));
comprobar(
  "4. la ficha ya no ofrece una habitación ocupada",
  !detalleB.html.includes("Reservar por WhatsApp") && !detalleB.html.includes(">Reservar<"),
  `HTTP ${detalleB.estado} tras ${detalleB.intentos} intento(s)`
);
comprobar("4. la ficha lista las habitaciones como ocupadas", detalleB.html.includes("Ocupadas por ahora"));
comprobar(
  "4. la ficha ofrece consultar en vez de reservar",
  detalleB.html.includes("Consultar por WhatsApp")
);
comprobar(
  "4. los datos estructurados NO declaran un precio no reservable",
  !detalleB.html.includes("priceRange"),
  ventana(detalleB.html, "priceRange", 40, 60) || "sin priceRange"
);

/* --- 5. La tarjeta del catálogo, con la publicación sin habitaciones libres */
const home = await pedirHasta("/", (r) => r.html.includes("Sin habitaciones libres ahora"));
comprobar("5. la publicación aparece en el catálogo", home.html.includes(TITULO));
comprobar(
  "5. la tarjeta avisa de que no hay habitaciones libres",
  /* Este texto solo lo produce la rama "tiene habitaciones, todas ocupadas". */
  home.html.includes("Sin habitaciones libres ahora"),
  `apariciones="${(home.html.match(/Sin habitaciones libres ahora/g) ?? []).length}"`
);
comprobar(
  "5. ninguna tarjeta ofrece reservar una habitación ocupada",
  !home.html.includes("Reservar por WhatsApp"),
  `apariciones="${(home.html.match(/Reservar por WhatsApp/g) ?? []).length}"`
);
comprobar(
  "5. la tarjeta ofrece consultar por WhatsApp",
  home.html.includes("Consultar por WhatsApp")
);

/* --- 6. Retirar la publicación la oculta al público ----------------------- */
const fase3 = sql(SQL_FASE3);
comprobar("6. el dueño pudo retirar la publicación", fase3.includes("retirada_filas=1"), fase3);
comprobar("6. la publicación queda como no activa", fase3.includes("activa=false"), fase3);

/* Se mide el fondo: que la página deje de servir el contenido de la publicación.
   El código de estado se informa aparte, en la sección de coherencia. */
const detalleC = await pedirHasta(`/pensiones/${id}`, (r) => !r.html.includes(TITULO));
comprobar(
  "6. la ficha retirada ya no sirve su contenido",
  !detalleC.html.includes(TITULO),
  `HTTP ${detalleC.estado} tras ${detalleC.intentos} intento(s)`
);
comprobar(
  "6. la ficha retirada ya no ofrece reservar",
  !detalleC.html.includes("Reservar"),
  `HTTP ${detalleC.estado}`
);

/* --- 7. Republican y limpieza ------------------------------------------- */
const fase4 = sql(SQL_FASE4);
comprobar("7. el dueño pudo volver a publicar", fase4.includes("republicada_filas=1"), fase4);
comprobar("7. sin residuos de la prueba", fase4.includes("residuos=0"), fase4);

/* --- 8. Coherencia de códigos de estado (contexto, no bloquea la tarea #10) */
const INEXISTENTE = "/pensiones/00000000-0000-4000-8000-000000000000";
const REAL = "/pensiones/f555e5b3-6629-402a-ae37-32c366c3f022";

const esperados = [
  ["ficha de un id inexistente", INEXISTENTE, 404],
  ["ficha real", REAL, 200],
  ["ruta inexistente", "/ruta-inexistente", 404],
];

console.log("\nCoherencia de códigos de estado (contexto):");

for (const [nombre, ruta, esperado] of esperados) {
  const respuesta = await pedir(ruta);
  const ok = respuesta.estado === esperado;
  console.log(
    `  ${ok ? "OK  " : "FALLO"} HTTP ${respuesta.estado} (esperado ${esperado})  ${nombre}`
  );
}

/* ---------------------------------------------------------------- resumen ---- */

/* Los volcados del render solo se guardan si algo falló: pesan ~80 KB y no
   aportan nada cuando todo pasa. */
if (resultados.some((r) => !r.ok)) {
  volcar("qa-detalle-ocupado.html", detalleB.html);
  volcar("qa-home.html", home.html);
  console.log("\nHubo fallos: se guardó una muestra del render en tmp/.\n");
}

const fallos = resultados.filter((r) => !r.ok);
console.log(
  `\n${resultados.length - fallos.length}/${resultados.length} comprobaciones correctas` +
    (fallos.length ? ` — fallan: ${fallos.map((f) => f.nombre).join(" | ")}` : "")
);

process.exit(fallos.length === 0 ? 0 : 1);
