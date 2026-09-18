-- ============================================================================
-- Oleada 3 — Habilitar la edición de una publicación sin reabrir el agujero
-- Ejecutar después de esquema.sql, storage-fotos.sql, oleada-1.sql y oleada-2.sql.
-- Es idempotente: se puede reejecutar sin efecto.
--
-- Qué resuelve (tarea #18 · la mitad que faltaba de M-15 del informe maestro)
--
--   Un anfitrión tiene que poder corregir su anuncio: título, descripción,
--   dirección, barrio, distancia a pie, servicios, normas y fotos; y gestionar
--   sus habitaciones (añadir, editar y quitar).
--
--   Hoy eso FALLA en la base. La Oleada 2 revocó el privilegio de tabla de
--   `pensiones` y de `habitaciones` y volvió a conceder solo lo que el panel de
--   disponibilidad necesitaba (`activa` y `disponible`). El editor no existe
--   todavía, pero en cuanto escriba `titulo` recibirá:
--      42501 permission denied for table pensiones
--
-- La trampa que obliga a conceder columna por columna
--
--   En PostgreSQL, revocar una columna NO retira el privilegio de tabla. Por eso
--   la Oleada 2 revocó la tabla entera en lugar de una lista de columnas. La
--   consecuencia es que aquí no existe un punto medio: hay que enumerar una por
--   una las columnas que el editor escribe.
--
--   Estas concesiones NO se conceden "porque el editor las pida": se revisó una
--   por una contra lo que el editor necesita y contra lo que cuesta cerrar.
--
-- Lo que sigue PROHIBIDO para `authenticated` y `anon` (y por qué)
--
--   · `verificado` y `calificacion` — es lo que miran estudiantes y padres para
--     decidir. Los otorga el equipo, no el anunciante (hallazgo A-1).
--   · `precio_mensual` — lo impone el disparador `antes_de_escribir_pension` a
--     partir de las habitaciones. Cederlo reabriría A-2: un PATCH directo podría
--     anunciar un precio que no corresponde a ninguna habitación.
--   · `anfitrion_id`, `id`, `creada_en` — identidad y trazabilidad. Conceder
--     `anfitrion_id` permitiría además transferir la publicación a otra cuenta.
--   · `latitud` y `longitud` — el editor definido no las pide. Concederlas sería
--     privilegio de más: cuando exista el selector de mapa se añaden aquí, con su
--     propia restricción de rango (que ya existe en la base).
--   · `habitaciones.pension_id` — deliberadamente NO se concede. Es la forma más
--     fuerte de que una habitación no pueda reasignarse a la publicación de otro
--     anfitrión: ni siquiera se puede intentar. La política
--     «habitaciones: editar las propias» ya tiene `with check` y es la segunda
--     capa; no se toca.
--   · `habitaciones.anfitrion_id` — no existe como columna en esta base (la
--     pertenencia se resuelve por la pensión, y así lo refleja la política).
--
-- Estado real comprobado ANTES de escribir esta migración (no supuesto), con
-- `has_table_privilege` y `has_column_privilege` para el rol `authenticated`:
--
--   pensiones    · SELECT t · INSERT t · UPDATE tabla f · DELETE t · columnas UPDATE: {activa}
--   habitaciones · SELECT t · INSERT t · UPDATE tabla f · DELETE t · columnas UPDATE: {disponible}
--
-- Es decir: INSERT y DELETE ya están concedidos a nivel de tabla en ambas, así
-- que el editor podrá añadir y quitar habitaciones sin ninguna concesión nueva.
-- Solo falta ampliar el conjunto de columnas actualizables de UPDATE.
--
-- Qué NO cambia
--
--   · La lectura pública: no se toca ningún privilegio de SELECT ni ninguna
--     política. Catálogo y ficha siguen igual.
--   · Las políticas RLS: ya están correctas (comprobadas `qual` y `with_check`
--     de las seis políticas de escritura). No se debilitan ni se reescriben.
--   · El panel de disponibilidad (`activa`, `disponible`) y la publicación por
--     RPC: siguen operativos, sus columnas están en la lista de abajo.
--   · Los datos existentes: esta migración solo cambia permisos.
--
-- Nota de secuencia
--
--   La tarea #21 añade `pensiones.whatsapp` y suma esa columna a esta misma
--   lista (en `oleada-4.sql`, después de crear la columna). La lista de abajo
--   sigue siendo la autoritativa para todo lo demás.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) `pensiones` — columnas que el editor del anfitrión escribe
--
--    Se revoca el privilegio de tabla (invariante que dejó la Oleada 2 y que hay
--    que preservar incluso si alguien reejecutara un `grant all`) y se concede la
--    lista explícita. El orden importa: primero la tabla, después las columnas.
-- ---------------------------------------------------------------------------
revoke update on public.pensiones from anon, authenticated;

grant update (
  activa,                    -- retirar / volver a publicar (ya lo usaba el panel)
  titulo,
  descripcion,
  direccion,
  barrio,
  distancia_a_pie_minutos,
  servicios,
  normas,
  imagenes
) on public.pensiones to authenticated;


-- ---------------------------------------------------------------------------
-- 2) `habitaciones` — columnas que el editor del anfitrión escribe
--
--    Editar una habitación: tipo, género, precio, alimentación y disponibilidad.
--    Añadir y quitar habitaciones ya está cubierto por los privilegios de tabla
--    INSERT y DELETE (verificados arriba), sujetos a sus políticas RLS.
-- ---------------------------------------------------------------------------
revoke update on public.habitaciones from anon, authenticated;

grant update (
  disponible,                -- marcar ocupada / libre (ya lo usaba el panel)
  tipo,
  genero,
  precio_mensual_cop,
  alimentacion_incluida
) on public.habitaciones to authenticated;

-- `pension_id` queda fuera de la lista a propósito (ver cabecera). Si en el
-- futuro se quisiera permitir mover una habitación entre publicaciones del MISMO
-- anfitrión, habría que concederlo aquí y confiar solo en el `with check` de la
-- política. Hoy no hace falta y no se concede.


-- ============================================================================
-- Verificación rápida tras aplicar (no escribe nada):
--
--   -- 1. Las columnas concedidas son EXACTAMENTE las esperadas:
--   select c.relname as tabla,
--          (select string_agg(a.attname, ', ' order by a.attname)
--             from pg_attribute a
--            where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
--              and has_column_privilege('authenticated', c.oid, a.attnum, 'UPDATE')) as columnas
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relname in ('pensiones', 'habitaciones');
--   -- esperado:
--   --   pensiones    → activa, barrio, descripcion, direccion, distancia_a_pie_minutos,
--   --                  imagenes, normas, servicios, titulo
--   --   habitaciones → alimentacion_incluida, disponible, genero, precio_mensual_cop, tipo
--
--   -- 2. Lo prohibido sigue prohibido, y el privilegio de tabla sigue revocado:
--   select has_table_privilege('authenticated','public.pensiones','UPDATE')            as upd_tabla,
--          has_column_privilege('authenticated','public.pensiones','verificado','UPDATE')    as verificado,
--          has_column_privilege('authenticated','public.pensiones','calificacion','UPDATE')  as calificacion,
--          has_column_privilege('authenticated','public.pensiones','precio_mensual','UPDATE') as precio;
--   -- esperado: f | f | f | f
--
-- Pruebas de aceptación completas (se revierten solas):
--   supabase/pruebas/oleada-3.sql
--
-- Reversión (deja el estado de la Oleada 2: solo `activa` y `disponible`):
--   revoke update on public.pensiones from authenticated;
--   grant update (activa) on public.pensiones to authenticated;
--   revoke update on public.habitaciones from authenticated;
--   grant update (disponible) on public.habitaciones to authenticated;
-- ============================================================================
