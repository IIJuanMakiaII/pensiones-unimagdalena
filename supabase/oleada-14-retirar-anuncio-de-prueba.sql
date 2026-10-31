-- ===========================================================================
-- ⛔ DESCARTADO — NO APLICAR  ·  2026-10-11
--
--    Este archivo **no es una migración pendiente** y no debe ejecutarse.
--
--    Es el SQL que se había preparado para retirar de la superficie pública
--    «Residencia 101 (Pension de Prueba)» —`slug = residencia-makia`—, cuando
--    se creía que era un anuncio de prueba sin dueño.
--
--    El fundador aclaró que es una **demostración intencional**: existe para
--    enseñar a los primeros anfitriones cómo se ve una pensión publicada, y él
--    la oculta y la reactiva en segundos con el rol de maestro desde el panel.
--    En consecuencia la tarea #58 quedó **archivada**, y esta operación no se
--    aplica: la visibilidad de la demostración es una decisión de producto, no
--    un defecto de datos que haya que corregir de una vez y para siempre.
--
--    Se conserva el archivo —y no se borra— porque está sin rastrear en Git,
--    así que borrarlo lo perdería de verdad, y porque documenta una operación
--    que puede volver a hacer falta si algún día la demostración deja de serlo.
--    Si eso pasa, esto se vuelve a evaluar entonces, no antes: reejecutado hoy
--    dejaría el catálogo público sin nada que enseñar.
--
--    Lo que sigue es su texto original, ya sin valor operativo.
-- ===========================================================================


-- ===========================================================================
-- (archivado) Oleada 14 · Retirar el anuncio de prueba de la superficie pública
--              (tarea #58, fila 1 de la hoja de ruta de la auditoría)
--
-- QUÉ ES ESTO
--
--    NO es una migración: no cambia el esquema. Es una **operación de datos**
--    de una sola sentencia, y se guarda junto a las migraciones solo porque se
--    aplica en la misma pasada que ellas.
--
--    Retira el único inmueble publicado —«Residencia 101 (Pension de Prueba)»,
--    slug `residencia-makia`— de la superficie pública. El sitio promete
--    verificación presencial; un anuncio de prueba en la calle desmiente esa
--    promesa, y era lo primero que veía un padre.
--
--    **EL REGISTRO NO SE BORRA.** Solo se apaga su visibilidad. Decisión del
--    usuario, y es la razón de que se pueda revertir en un minuto (sección 5).
--
-- POR QUÉ `activa = false` BASTA PARA LOS CUATRO PRIMEROS CRITERIOS
--
--    `activa` es el mecanismo de visibilidad del catálogo, y la comprobación es
--    del motor, no de la aplicación:
--
--      1. Catálogo → `obtenerPensiones()` filtra `.eq("activa", true)`.
--      2. Sitemap  → `obtenerPensionesReales()` filtra igual,
--                    que es la fuente única de `app/sitemap.ts`.
--      3. Barrios  → `lib/barrios.ts:97` hace `if (!pension.activa) continue;`,
--                    así que hereda la misma garantía.
--      4. Ficha    → aquí hay algo más fuerte que un filtro: la RLS. La política
--                    «pensiones: lectura publica de activas» (esquema.sql:130-131)
--                    reza `using (activa or (select auth.uid()) = anfitrion_id)`.
--                    Con `activa = false`, la clave anónima no la ve, y
--                    `obtenerPensionPorId()` devuelve `null` → `notFound()` en
--                    `app/pensiones/[id]/page.tsx:71` y `:106`.
--
--    El criterio 4 pide «404 y que no se pueda indexar». Un 404 **no es
--    indexable**: no hace falta tocar `app/robots.ts` ni añadir un `noindex`, y
--    por eso esta operación no toca ni una línea de la aplicación. Si hiciera
--    falta un `noindex` aquí, sería señal de que el 404 no está funcionando.
--
-- POR QUÉ TENÍA QUE IR DESPUÉS DE LAS MIGRACIONES
--
--    El orden previsto —no forma parte del SQL: es el mismo que aplica al
--    proyecto entero y vive en el runbook— era primero las migraciones y después
--    el código. Esta operación quedaba para la misma pasada que `oleada-11`,
--    `oleada-12` y `oleada-13`. Ya no aplica: está descartada.
--
--    El motivo del orden sigue siendo cierto y contraintuitivo: la aplicación
--    pide `verificado_en` en su proyección (`lib/supabase/mapeo.ts`,
--    `COLUMNAS_PENSION`), así que contra una base sin `oleada-13` esa consulta
--    falla con `42703` y el catálogo se sirve vacío —el sitio publicado mostraría
--    «Todavía no hay pensiones publicadas» con un anuncio real dentro—. Medido
--    por dos vías independientes.
--
--    De ahí salía una consecuencia sobre la verificación que conviene recordar:
--    en ese estado los criterios públicos pasaban solos, por el error y no por la
--    retirada. Es la trampa de verde falso que sigue cubriendo
--    `scripts/verificar-retirada.mjs`, hoy con otra pregunta: que la base y la
--    superficie pública **coincidan** con el estado que la demostración tenga.
--
-- IDEMPOTENTE (cuando era aplicable)
--
--    La condición `and activa` hacía que una segunda ejecución afectara 0 filas y
--    no dijera nada falso.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1) Antes de tocar nada: leer y registrar el estado actual
--
--    Sirve para dos cosas. La primera es dejar constancia del valor anterior
--    —lo que exige la reversibilidad—: el resultado de esta consulta es el que
--    va en la sección 4. La segunda es confirmar que la fila es **una** y que es
--    la que se cree; si devuelve varias o ninguna, DETENERSE y no ejecutar la
--    sección 3.
--
--    MEDIDO el 2026-10-11 contra la base real, con la clave anónima:
--      id             f555e5b3-6629-402a-ae37-32c366c3f022
--      slug           residencia-makia
--      titulo         Residencia 101 (Pension de Prueba)
--      barrio         Otro
--      activa         true
--      verificado     false
--      precio_mensual 600000
--      creada_en      2026-09-18T01:47:46.707833+00:00
-- ---------------------------------------------------------------------------

select id, slug, titulo, barrio, activa, verificado, precio_mensual, creada_en
  from public.pensiones
 order by creada_en asc;


-- ---------------------------------------------------------------------------
-- 2) La misma lectura, acotada a la fila objetivo
--
--    `activa` es la columna que se va a tocar, así que se lee explícitamente.
-- ---------------------------------------------------------------------------

select id, slug, activa, precio_mensual
  from public.pensiones
 where slug = 'residencia-makia';


-- ---------------------------------------------------------------------------
-- 3) La retirada  ·  DESACTIVADA
--
--    La sentencia está **comentada**: un archivo descartado no debe poder cambiar
--    nada aunque alguien lo pegue entero en el editor. Sin esto, seleccionar todo
--    y ejecutar habría retirado la demostración de verdad.
--
--    UNA sentencia, UNA columna. No hay borrado, ni cambio de esquema, ni
--    permisos nuevos. `and activa` la hace idempotente: en la segunda ejecución
--    afecta 0 filas.
--
--    Lo que NO se toca, a propósito:
--      · `verificado` y `verificado_en` quedan como están. Retirar no es
--        desmentir la verificación; el anuncio simplemente deja de publicarse.
--      · Las habitaciones no se tocan. Siguen existiendo, colgando de un
--        anuncio que ya no se muestra al público.
--      · El propietario (`anfitrion_id`) y el maestro siguen viéndolo: la
--        política RLS lo permite, así que el anuncio sigue siendo gestionable
--        desde el panel. Retirar no es esconder; es dejar de publicar.
-- ---------------------------------------------------------------------------

-- update public.pensiones
--    set activa = false
--  where slug = 'residencia-makia'
--    and activa;


-- ---------------------------------------------------------------------------
-- 4) Después: comprobar el efecto
--
--    Se pide por `id`, no por `slug`, y **sin filtrar por `activa`**: filtrar
--    por la columna que se acaba de cambiar haría que la consulta no encontrara
--    la fila y el resultado pareciera un borrado. El objetivo es justo
--    distinguir «retirado» de «borrado», así que la fila tiene que salir.
--
--    Esperado:
--      · 1 fila;
--      · activa = false;
--      · el resto de columnas intactas.
-- ---------------------------------------------------------------------------

select id, slug, activa, verificado, precio_mensual
  from public.pensiones
 where id = 'f555e5b3-6629-402a-ae37-32c366c3f022';


-- ---------------------------------------------------------------------------
-- 5) Lo que hay que saber antes de un `update` sobre esta tabla: el disparador
--    del precio
--
--    `pensiones` tiene un disparador `antes_de_escribir_pension`
--    (`before insert or update`, oleada-2:146-149) que ejecuta
--    `imponer_precio_pension()`: **recalcula `precio_mensual`** a partir de las
--    habitaciones y **ignora lo que venga en la petición**, por diseño.
--
--    Es decir: un `update` de `activa` no es inocuo por sí solo — arrastra el
--    recálculo del precio. Por eso se midió antes de escribir esta operación:
--
--      precio_mensual guardado ............ 600000
--      habitaciones ....................... 2, ambas `disponible`
--      min(precio) de las disponibles ..... 600000   ← el valor derivado
--
--    Coinciden, así que la retirada **no altera el precio**. Pero la coincidencia
--    es del dato, no una garantía del SQL: si en el futuro el precio guardado
--    dejara de coincidir con el derivado, un `update` lo normalizaría en
--    silencio. Queda escrito para que nadie lo descubra por sorpresa.
--
--    Para revertir esto no hay nada que hacer: es el comportamiento diseñado.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 6) Valor anterior, para revertir en un minuto
--
--    Columnas tocadas por esta operación:
--
--      `activa`            true  →  false
--      `precio_mensual`    600000  →  600000   (recalculado por el disparador;
--                                              el valor no cambia)
--
--    Ninguna otra columna se modifica. Y el registro **no se borra**: la
--    reversión de la sección 7 devuelve el sitio exactamente a su estado previo.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 7) Reversión
--
--    Devuelve el anuncio a la superficie pública. Misma forma: una sentencia,
--    una columna, idempotente.
--
--    OJO con lo que esto significa: volver a publicar el anuncio de prueba lo
--    devuelve al catálogo, al sitemap y a las páginas de barrio, y su ficha
--    vuelve a responder 200 e indexable. Revertir es tan fácil como retirar, y
--    por eso conviene que sea una decisión, no un accidente.
-- ---------------------------------------------------------------------------

-- update public.pensiones
--    set activa = true
--  where slug = 'residencia-makia'
--    and not activa;


-- ---------------------------------------------------------------------------
-- 8) Lo que esta operación NO hace, y por qué
--
--    · **No borra el registro.** Prohibido por el encargo: el anuncio puede
--      volver a hacer falta para enseñar el flujo completo.
--    · **No añade un `noindex`.** El 404 ya resuelve la indexabilidad; poner un
--      `noindex` sería tapar un 404 que no funciona.
--    · **No toca `app/robots.ts` ni ningún componente.** No hace falta: toda la
--      visibilidad pública de esta tabla pasa por `activa`.
--    · **No añade ni cambia permisos.** `activa` ya era escribible por
--      `authenticated` (oleada-10:151-163), y quien aplica esto lo hace como
--      dueño del proyecto, no como anónimo.
--    · **No crea índices.** El índice `pensiones_catalogo_idx (activa, creada_en desc)`
--      ya existe y es justo el que sirve este filtro.
--    · **No vacía el almacenamiento.** Las fotos del anuncio siguen en su
--      carpeta: retirar no es borrar.
-- ---------------------------------------------------------------------------
