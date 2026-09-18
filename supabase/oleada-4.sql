-- ============================================================================
-- Oleada 4 — Número de contacto propio de cada publicación (10 dígitos)
-- Ejecutar después de esquema.sql, storage-fotos.sql, oleada-1.sql, oleada-2.sql
-- y oleada-3.sql. Es idempotente: se puede reejecutar sin efecto.
--
-- Qué resuelve (tarea #21)
--
--   Hasta hoy TODOS los botones de reserva del sitio abrían el WhatsApp de la
--   plataforma: el estudiante escribía al marketplace, no al dueño de la pensión.
--   Esta migración añade el dato que falta para que cada anuncio conecte con
--   quien alquila: `pensiones.whatsapp`.
--
-- Decisión de formato (fija, del tablero)
--
--   Se guardan EXACTAMENTE 10 dígitos, sin código de país. El +57 lo añade la
--   aplicación al construir el enlace `wa.me`. Así el dato queda normalizado y no
--   depende de cómo lo escriba cada anfitrión (con +57, con espacios, con guiones
--   o con el 0 inicial de marcación nacional: todo eso se rechaza aquí y se
--   normaliza en la interfaz).
--
--   La restricción exige «10 dígitos», NO «empieza por 3». Es deliberado: en
--   Colombia un teléfono fijo del área de Santa Marta con el indicativo
--   (60X XXX XXXX) también tiene 10 dígitos, y sería un error rechazar el número
--   real de un anfitrión que atiende por su línea fija. Lo que sí se rechaza es
--   cualquier valor que no sean diez cifras: 9, 11, letras, espacios, guiones o
--   el prefijo «+57».
--
-- La columna es NULLABLE, y es obligatorio que lo sea
--
--   Las publicaciones que ya existen no tienen número propio y no se les puede
--   inventar uno: NULL significa «esta publicación todavía no tiene contacto
--   directo» y la interfaz usa el número de la plataforma como respaldo hasta que
--   el anfitrión ponga el suyo desde el editor. Ninguna fila se modifica.
--
-- Privacidad: hasta dónde llega esta migración
--
--   El número NO va a los datos estructurados (JSON-LD) ni a los metadatos: es un
--   dato de contacto de una persona, no del negocio. Eso se garantiza en el código
--   (tareas #19 y #22), no aquí.
--
--   Lo que sí conviene saber, sin adornos: `whatsapp` queda legible por el rol
--   `anon`. No es un descuido — la ficha y el catálogo se sirven de forma
--   anónima y con caché (ISR), así que necesitan leer el número para construir el
--   enlace de contacto. Mientras el contacto sea directo, el número es visible
--   para quien inspeccione la página; es inherente a la función. Si en algún
--   momento se decide exigir sesión para verlo, la vía sería exponerlo por una
--   función `security definer` en lugar de por la columna, y retirar el privilegio
--   de lectura de esta columna a `anon`. No se hace ahora porque cambiaría la
--   funcionalidad que se pidió.
--
-- Pertenencia a la lista de columnas editables
--
--   `whatsapp` entra en la MISMA lista de `oleada-3.sql` (el editor del anfitrión
--   lo escribe). En esta migración se reemite la lista COMPLETA y autoritativa
--   de columnas actualizables de `pensiones`, para que aplicarla deje el estado
--   correcto por sí sola y no haya dos listas que puedan divergir.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) La columna
-- ---------------------------------------------------------------------------
alter table public.pensiones add column if not exists whatsapp text;

comment on column public.pensiones.whatsapp is
  'Número de contacto del anfitrión: exactamente 10 dígitos, SIN código de país (el +57 lo añade la aplicación al construir el enlace wa.me). NULL = la publicación aún no tiene número propio y la interfaz usa el de la plataforma. No debe publicarse en datos estructurados ni en metadatos.';

-- ---------------------------------------------------------------------------
-- 2) Formato: exactamente 10 dígitos, solo cifras. NULL permitido.
--
--    El CHECK es la barrera real: el formulario valida para dar un buen mensaje
--    de error, pero un `PATCH` directo contra la API se salta el formulario.
--    Si el valor no cumple, PostgreSQL responde 23514 con el nombre de la
--    restricción, y la interfaz lo traduce a un aviso claro.
-- ---------------------------------------------------------------------------
alter table public.pensiones drop constraint if exists pensiones_whatsapp_formato;
alter table public.pensiones
  add constraint pensiones_whatsapp_formato
  check (whatsapp is null or whatsapp ~ '^[0-9]{10}$');


-- ---------------------------------------------------------------------------
-- 3) Privilegios de columna — LISTA COMPLETA Y AUTORITATIVA
--
--    Se reemite la lista entera (la de oleada-3.sql más `whatsapp`) para que este
--    archivo sea autosuficiente. El `revoke` de tabla se mantiene delante: en
--    PostgreSQL revocar una columna NO retira el privilegio de tabla, así que la
--    concesión tiene que ser explícita.
--
--    Siguen PROHIBIDOS (por los hallazgos A-1 y A-2, ver oleada-2.sql):
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
  whatsapp                   -- número de contacto propio (tarea #21)
) on public.pensiones to authenticated;

-- El INSERT de la columna ya está cubierto por el privilegio de tabla INSERT
-- (verificado en oleada-3.sql), así que un anfitrión puede fijar el número tanto
-- al publicar como al editar. No hace falta ninguna concesión adicional.


-- ============================================================================
-- Verificación rápida tras aplicar (no escribe nada):
--
--   -- 1. La columna existe, es opcional y tiene la restricción de formato:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'pensiones' and column_name = 'whatsapp';
--   -- esperado: whatsapp | text | YES
--
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.pensiones'::regclass and conname = 'pensiones_whatsapp_formato';
--   -- esperado: CHECK (whatsapp IS NULL OR whatsapp ~ '^[0-9]{10}$'::text)
--
--   -- 2. Lo prohibido sigue prohibido y `whatsapp` es editable:
--   select has_column_privilege('authenticated','public.pensiones','whatsapp','UPDATE')       as whatsapp,
--          has_column_privilege('authenticated','public.pensiones','verificado','UPDATE')      as verificado,
--          has_column_privilege('authenticated','public.pensiones','calificacion','UPDATE')    as calificacion,
--          has_column_privilege('authenticated','public.pensiones','precio_mensual','UPDATE')  as precio,
--          has_table_privilege('authenticated','public.pensiones','UPDATE')                    as upd_tabla;
--   -- esperado: t | f | f | f | f
--
--   -- 3. Ninguna fila existente se rompió:
--   select count(*) as publicaciones, count(whatsapp) as con_numero from public.pensiones;
--   -- esperado: las publicaciones de siempre y 0 con número (aún no hay ninguno)
--
-- Pruebas de aceptación completas (se revierten solas):
--   supabase/pruebas/oleada-4.sql
--
-- Reversión:
--   alter table public.pensiones drop constraint if exists pensiones_whatsapp_formato;
--   alter table public.pensiones drop column if exists whatsapp;
--   -- y reemitir la lista de columnas de oleada-3.sql
-- ============================================================================
