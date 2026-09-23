-- ============================================================================
-- Oleada 6 — Autorización expresa para publicar el contacto del anfitrión
-- Ejecutar después de esquema.sql, storage-fotos.sql, oleada-1.sql, oleada-2.sql,
-- oleada-3.sql y oleada-4.sql. Es idempotente: se puede reejecutar sin efecto.
--
-- Nota de coordinación: esta migración se llamó primero `oleada-5.sql`, pero ese
-- nombre lo ocupa la migración de dirección legible (slug, tarea #26) que se
-- escribió en paralelo. Se renombra a oleada-6.sql para no pisarla.
--
-- Qué resuelve (tarea #30)
--
--   Hasta hoy el número de WhatsApp de un anfitrión se publicaba SIN que nadie lo
--   hubiera autorizado: la plataforma guardaba el dato y lo mostraba, pero no
--   existía ninguna constancia de consentimiento. Ese número es un dato personal
--   de una persona y queda a la vista de cualquiera, incluso de quien consulte la
--   base sin tener cuenta.
--
--   Esta migración añade `pensiones.autorizacion_contacto_en` (cuándo autorizó) y,
--   sobre todo, la RESTRICCIÓN que lo hace cumplir.
--
-- Por qué la barrera va aquí y no solo en el formulario
--
--   Un `PATCH` directo contra la API se salta el formulario. Sin la restricción,
--   «no se puede publicar sin autorizar» sería una promesa del código de la
--   interfaz, no una garantía del sistema. Es el mismo criterio que ya se aplicó
--   con el formato de 10 dígitos en oleada-4.sql: el formulario valida para dar un
--   buen mensaje de error; la base es la que impide.
--
--   La restricción dice: `whatsapp is null or autorizacion_contacto_en is not null`
--   → puede haber anuncios sin número (NULL, sin autorización pendiente) y puede
--   haber autorización sin número, pero NUNCA un número publicado sin constancia
--   de autorización.
--
-- Consentimiento retroactivo: no se inventa
--
--   Las publicaciones que existen hoy se hicieron sin esta autorización y NO se
--   les rellena la fecha aquí (sería fabricar un consentimiento). La columna queda
--   NULL y el editor pide la autorización al anfitrión la próxima vez que edite.
--   Esta migración no modifica ninguna fila.
--
-- Pertenencia a la lista de columnas editables
--
--   `autorizacion_contacto_en` entra en la MISMA lista que `whatsapp`. Se reemite
--   la lista COMPLETA y autoritativa de columnas actualizables de `pensiones`
--   (oleada-3.sql + oleada-4.sql + esta) para que aplicar este archivo deje el
--   estado correcto por sí solo: reemitir la lista a medias es exactamente cómo se
--   colaron los hallazgos A-1 (sello de verificación) y A-2 (calificación, precio).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) La columna: cuándo autorizó el anfitrión publicar su contacto
-- ---------------------------------------------------------------------------
alter table public.pensiones
  add column if not exists autorizacion_contacto_en timestamptz;

comment on column public.pensiones.autorizacion_contacto_en is
  'Fecha y hora (UTC) en que el anfitrión autorizó expresamente publicar su número de WhatsApp. NULL = no consta autorización (anuncios anteriores a esta migración). No se rellena de forma retroactiva: el consentimiento se pide de nuevo desde el editor.';


-- ---------------------------------------------------------------------------
-- 2) La barrera: sin autorización registrada, no hay número publicado
--
--    Si el valor no cumple, PostgreSQL responde 23514 con el nombre de la
--    restricción, y la interfaz lo traduce a un aviso claro que menciona la
--    casilla de autorización.
-- ---------------------------------------------------------------------------
alter table public.pensiones
  drop constraint if exists pensiones_autorizacion_para_whatsapp;

alter table public.pensiones
  add constraint pensiones_autorizacion_para_whatsapp
  check (whatsapp is null or autorizacion_contacto_en is not null);


-- ---------------------------------------------------------------------------
-- 3) Privilegios de columna — LISTA COMPLETA Y AUTORITATIVA
--
--    El `revoke` de tabla se mantiene delante porque en PostgreSQL revocar una
--    columna NO retira el privilegio de tabla: la concesión tiene que ser
--    explícita.
--
--    Siguen PROHIBIDOS (hallazgos A-1 y A-2, ver oleada-2.sql):
--    `verificado`, `calificacion`, `precio_mensual`, `anfitrion_id`, `id`,
--    `creada_en`, `latitud`, `longitud`.
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
  imagenes,
  whatsapp,                  -- número de contacto propio (tarea #21)
  autorizacion_contacto_en   -- constancia de la autorización (tarea #30)
) on public.pensiones to authenticated;


-- ============================================================================
-- Verificación rápida tras aplicar (no escribe nada):
--
--   -- 1. La columna existe, es opcional:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'pensiones'
--      and column_name = 'autorizacion_contacto_en';
--   -- esperado: autorizacion_contacto_en | timestamp with time zone | YES
--
--   -- 2. La barrera está puesta:
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.pensiones'::regclass
--      and conname = 'pensiones_autorizacion_para_whatsapp';
--   -- esperado: CHECK (whatsapp IS NULL OR autorizacion_contacto_en IS NOT NULL)
--
--   -- 3. Lo prohibido sigue prohibido y lo nuevo es editable:
--   select has_column_privilege('authenticated','public.pensiones','autorizacion_contacto_en','UPDATE') as autorizacion,
--          has_column_privilege('authenticated','public.pensiones','whatsapp','UPDATE')                 as whatsapp,
--          has_column_privilege('authenticated','public.pensiones','verificado','UPDATE')              as verificado,
--          has_column_privilege('authenticated','public.pensiones','calificacion','UPDATE')            as calificacion,
--          has_column_privilege('authenticated','public.pensiones','precio_mensual','UPDATE')          as precio,
--          has_column_privilege('authenticated','public.pensiones','anfitrion_id','UPDATE')            as anfitrion,
--          has_table_privilege('authenticated','public.pensiones','UPDATE')                            as upd_tabla;
--   -- esperado: t | t | f | f | f | f | f
--
--   -- 4. Ninguna fila existente se rompió (y ninguna se rellenó sola):
--   select count(*) as publicaciones, count(whatsapp) as con_numero,
--          count(autorizacion_contacto_en) as con_autorizacion
--     from public.pensiones;
--   -- esperado: las publicaciones de siempre, y las dos últimas cuentas a 0
--
-- Pruebas de aceptación completas (se revierten solas):
--   supabase/pruebas/oleada-6.sql
--
-- Reversión:
--   alter table public.pensiones drop constraint if exists pensiones_autorizacion_para_whatsapp;
--   alter table public.pensiones drop column if exists autorizacion_contacto_en;
--   -- y reemitir la lista de columnas de oleada-4.sql
-- ============================================================================
