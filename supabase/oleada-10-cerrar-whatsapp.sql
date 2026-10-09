-- ============================================================================
-- Oleada 10 — Cerrar la lectura pública del teléfono del propietario
-- Ejecutar después de esquema.sql, storage-fotos.sql y oleada-1 … oleada-6.
-- Independiente de oleada-7, oleada-8 y oleada-9. Es idempotente: reejecutarla
-- deja el mismo estado.
--
-- ⚠️ NO ESTÁ APLICADA. Se entrega escrita porque desde el entorno del equipo no
--    se puede tocar la base: la única credencial disponible es la clave pública
--    y no hay herramienta de Postgres sobre este proyecto. La aplica el fundador
--    en Supabase → SQL Editor. Nadie debe dar esto por aplicado antes de eso.
--
-- QUÉ CIERRA (tarea #47 · punto 18 de la auditoría de prelanzamiento)
--
--   Con la clave pública que viaja al navegador, hoy responden 200:
--
--     GET /rest/v1/pensiones?select=whatsapp
--     GET /rest/v1/pensiones?select=autorizacion_contacto_en
--     GET /rest/v1/pensiones?select=*            ← el comodín las incluye
--
--   Es decir: cualquiera puede pedir el teléfono del propietario y la fecha en
--   que autorizó publicarlo, sin tener cuenta. Hoy hay **0 filas con número
--   guardado**, así que no se ha filtrado nada: no es una fuga, es una puerta
--   abierta. La única mitigación que existe hoy es de la aplicación —la consulta
--   del sitio no pide esa columna (lib/supabase/mapeo.ts)— y una mitigación de la
--   aplicación no cierra una API: quien consulte la API directamente no pasa por
--   la aplicación.
--
-- POR QUÉ UN ARCHIVO NUEVO Y NO LA OLEADA 9
--
--   El borrador del perfil maestro (`supabase/oleada-9-descartada.sql`, nunca
--   aplicado) mezclaba dos cosas distintas: el **perfil maestro** (rol, función,
--   políticas, borrado) y el **cierre de este número** (sus secciones 7 y 8).
--   Este archivo contiene SOLO el cierre, con las mismas sentencias exactas, para
--   que cerrar el teléfono no dependa de una decisión sobre el perfil maestro. La
--   migración vigente (`supabase/oleada-9.sql`) se limita al perfil maestro y NO
--   reemite estos grants. El rol maestro no se toca aquí.
--
--   Consecuencia práctica: como la migración vigente no toca estos permisos,
--   aplicar este archivo no compite con ella. El que sí se solapaba era el
--   borrador descartado, cuyas secciones 7 y 8 repetían estas mismas sentencias.
--
-- LA TRAMPA QUE OBLIGA A ENUMERAR COLUMNAS
--
--   En PostgreSQL, revocar el permiso de una COLUMNA no retira el permiso de la
--   TABLA. Supabase concede `select` a nivel de tabla, así que esto:
--
--     revoke select (whatsapp) on public.pensiones from anon;   -- ⚠️ inútil
--
--   no cierra nada: `anon` conserva el privilegio de tabla, que cubre todas las
--   columnas. Habría *parecido* cerrado sin estarlo, que es el peor resultado
--   posible — la comprobación habría dicho «cerrado» y la puerta seguiría
--   abierta.
--
--   Lo que sí cierra es retirar el privilegio de TABLA y volver a concederlo
--   enumerando las columnas que de verdad se leen. Es el mismo patrón de las
--   oleadas 2, 3 y 6, y aquí hay una comprobación que lo mide en vez de
--   suponerlo (ver «CÓMO SE COMPRUEBA», al final).
--
-- EFECTO REAL, SIN ADORNOS
--
--   1. `whatsapp` y `autorizacion_contacto_en` dejan de ser legibles por `anon`
--      y por `authenticated`. **Los datos no se borran**: siguen en la tabla y
--      siguen a la vista del panel de Supabase y del rol de servicio.
--   2. Cualquier consulta con comodín sobre `pensiones` pasa a fallar con
--      `42501` (permission denied for column). Comprobado antes de escribir
--      esto, en el código: **ninguna consulta de la aplicación usa comodín**.
--      Las cuatro lecturas del catálogo pasan por `COLUMNAS_PENSION` /
--      `COLUMNAS_HABITACION` (lib/supabase/mapeo.ts) y hay una prueba que lo
--      vigila (pruebas/proyeccion-datos.prueba.ts); las lecturas del panel piden
--      `id` o `id, pension_id`. El verificador de RLS también pide columnas
--      explícitas desde la tarea #33.
--   3. La lectura pública del catálogo no cambia: las 18 columnas que el sitio
--      lee siguen concedidas, y las dos que usan las políticas de RLS
--      (`activa` y `anfitrion_id`) están entre ellas.
--   4. La gestión del propietario no cambia: sigue leyendo las mismas 18
--      columnas y sigue pudiendo escribir las mismas 9 que ya podía. La columna
--      retirada no la usa ninguna pantalla desde el cambio de modelo del
--      2026-10-02 (el anfitrión ya no publica su número): el formulario no la
--      envía y el mapeo no la trae.
--
-- LO QUE NO HACE, Y POR QUÉ
--
--   · **No borra los números ya guardados.** Borrar datos no es un cambio de
--     permisos y no debe ocurrir por aplicar un archivo de seguridad. Si además
--     los quieres eliminar, es una sentencia aparte y deliberada:
--       update public.pensiones set whatsapp = null where whatsapp is not null;
--   · **No retira la restricción `pensiones_autorizacion_para_whatsapp`**, que
--     desde hoy solo vigila una columna que nadie escribe. Sigue la decisión ya
--     escrita en el borrador `oleada-9-descartada.sql`: se deja documentada y se
--     retira el día que se elimine la columna.
--   · **No toca el privilegio de INSERT**: la publicación se hace por la función
--     transaccional y el dato quedaría igual de ilegible; reemitir ese privilegio
--     por columnas pondría en riesgo el flujo de publicación sin ganar nada.
--   · **No toca `habitaciones` ni `usuarios`**, ni ninguna política de RLS, ni
--     ningún rol. El perfil maestro lo definió —y ya está aplicado— la migración
--     vigente `supabase/oleada-9.sql`; aquí no se adelanta nada de eso.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Lectura: el teléfono y la autorización salen del alcance de la API
--
--    Las 18 columnas reconcedidas son EXACTAMENTE las que lee la aplicación
--    (`COLUMNAS_PENSION` de lib/supabase/mapeo.ts). Que las dos listas coincidan
--    importa: una columna que falte aquí no llega vacía, hace fallar la consulta
--    con `42501`. Y al revés: una columna concedida de más vuelve a exponerse.
--    Las 20 columnas de la tabla son estas 18 más las dos que se retiran, así
--    que no queda ninguna fuera por descuido.
-- ---------------------------------------------------------------------------
revoke select on public.pensiones from anon, authenticated;

grant select (
  id,
  slug,
  anfitrion_id,
  titulo,
  descripcion,
  precio_mensual,
  direccion,
  barrio,
  distancia_a_pie_minutos,
  servicios,
  normas,
  calificacion,
  verificado,
  imagenes,
  activa,
  creada_en,
  latitud,
  longitud
) on public.pensiones to anon, authenticated;

-- Fuera de la lista, a propósito y en este orden: `whatsapp` (el teléfono del
-- propietario) y `autorizacion_contacto_en` (la fecha en que autorizó). Son el
-- dato personal que esta migración cierra.


-- ---------------------------------------------------------------------------
-- 2) Escritura: y dejan de poder escribirse
--
--    Se reemite la lista COMPLETA de columnas editables (la de la oleada 6) sin
--    las dos retiradas. Va en el mismo archivo porque una columna que ya nadie
--    debe leer tampoco debe poder reescribirse: si quedara concedida la
--    escritura, un `PATCH` directo contra la API podría rellenar otro número y
--    otra autorización sin pasar por ninguna pantalla.
--
--    Siguen PROHIBIDAS (hallazgos A-1 y A-2, oleada 2): `verificado`,
--    `calificacion`, `precio_mensual`, `anfitrion_id`, `id`, `creada_en`,
--    `latitud`, `longitud` y `slug`.
-- ---------------------------------------------------------------------------
revoke update on public.pensiones from anon, authenticated;

grant update (
  activa,                    -- retirar / volver a publicar (panel de disponibilidad)
  titulo,
  descripcion,
  direccion,
  barrio,
  distancia_a_pie_minutos,
  servicios,
  normas,
  imagenes
) on public.pensiones to authenticated;


-- ============================================================================
-- CÓMO SE COMPRUEBA (no escribe nada; ninguna de estas sentencias se ha
-- ejecutado todavía porque la migración no está aplicada)
--
--   En el proyecto, sin credenciales y contra la base real:
--     npm run verificar:exposicion-propietario
--   Antes de aplicar: dice EXPOSICIÓN ABIERTA y reproduce el 200.
--   Después de aplicar: dice CERRADO. Es el mismo comando en los dos momentos.
--
--   Y dentro del SQL Editor, que es la evidencia definitiva porque mira los
--   privilegios efectivos (incluida cualquier concesión heredada de PUBLIC):
--
--   -- 1) Lo privado ya no se lee, y lo público sigue igual:
--   select has_column_privilege('anon','public.pensiones','whatsapp','SELECT')                as anon_whatsapp,     -- esperado: f
--          has_column_privilege('anon','public.pensiones','autorizacion_contacto_en','SELECT') as anon_autorizacion, -- esperado: f
--          has_column_privilege('anon','public.pensiones','titulo','SELECT')                 as anon_titulo,       -- esperado: t
--          has_table_privilege ('anon','public.pensiones','SELECT')                           as anon_tabla;        -- esperado: f
--
--   -- 2) Lo mismo para el rol con sesión:
--   select has_column_privilege('authenticated','public.pensiones','whatsapp','SELECT')     as aut_whatsapp,     -- esperado: f
--          has_column_privilege('authenticated','public.pensiones','slug','SELECT')         as aut_slug,         -- esperado: t
--          has_column_privilege('authenticated','public.pensiones','activa','UPDATE')       as aut_activa,       -- esperado: t
--          has_column_privilege('authenticated','public.pensiones','whatsapp','UPDATE')     as aut_whatsapp_upd; -- esperado: f
--
--   -- 3) Las prohibidas de la oleada 2 siguen prohibidas:
--   select has_column_privilege('authenticated','public.pensiones','verificado','UPDATE')     as verificado,  -- f
--          has_column_privilege('authenticated','public.pensiones','calificacion','UPDATE')   as calificacion,-- f
--          has_column_privilege('authenticated','public.pensiones','precio_mensual','UPDATE') as precio,      -- f
--          has_column_privilege('authenticated','public.pensiones','anfitrion_id','UPDATE')   as anfitrion,   -- f
--          has_column_privilege('authenticated','public.pensiones','slug','UPDATE')           as slug;        -- f
--
--   -- 4) Ninguna fila se rompió y ninguna se borró:
--   select count(*) as publicaciones, count(whatsapp) as con_numero from public.pensiones;
--
--   Si el punto 1 devolviera `t` en `anon_whatsapp` a pesar de haber aplicado
--   este archivo, la causa es una concesión a `PUBLIC` (que se hereda y que un
--   `revoke … from anon` no retira). Se cierra con una línea más:
--     revoke select on public.pensiones from public;
--   No se incluye arriba porque en un proyecto Supabase estándar no existe esa
--   concesión y una sentencia que no se puede probar desde aquí es exactamente
--   lo que no se debe añadir «por si acaso».
--
-- ORDEN DE EJECUCIÓN RESPECTO A LA OLEADA 7 Y LA 9
--
--   Este archivo no depende de ninguna de las dos, y ninguna de las dos depende
--   de él:
--     · oleada-7 (borrado y reserva de la dirección) — sin relación.
--     · oleada-9 (perfil maestro) — sin solape: la migración vigente no reemite
--       los grants de columna. El borrador descartado sí lo hacía en sus
--       secciones 7 y 8.
--     · oleada-8 (índices) — sin relación.
--   Recomendado: aplicar **esta primero**, porque cierra una exposición real sin
--   exigir ninguna decisión de producto; después la 7. Cualquier otro orden
--   termina en el mismo estado. (Estado a 2026-10-09: esta migración y la
--   vigente `supabase/oleada-9.sql` ya están aplicadas en producción.)
--
-- REVERSIÓN (deja los permisos como estaban; no toca datos):
--   revoke select on public.pensiones from anon, authenticated;
--   grant select on public.pensiones to anon, authenticated;
--   revoke update on public.pensiones from anon, authenticated;
--   grant update on public.pensiones to anon, authenticated;
--   -- y reemitir después las listas de columnas de oleada-6.sql si se quiere
--   -- volver exactamente al estado previo a este cierre.
-- ============================================================================
