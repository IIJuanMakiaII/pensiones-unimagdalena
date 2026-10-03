-- ============================================================================
-- Oleada 9 — Perfil maestro y el número del anfitrión fuera del alcance público
-- Ejecutar después de esquema.sql, storage-fotos.sql y oleada-1 … oleada-7.
-- Es idempotente.
--
-- ⚠️ NO ESTÁ APLICADA. Se entrega escrita y probada porque desde el entorno del
--    equipo no se puede tocar la base (la herramienta disponible pertenece a otra
--    organización y rechaza el proyecto). La aplica el fundador en el editor SQL.
--
-- CAMBIO DE MODELO DE NEGOCIO (decisión del fundador, 2026-10-02)
--
--   La plataforma gestiona el contacto y **la reserva del primer mes**, y después
--   cuadra con el dueño (comisión del 10%). Dos consecuencias que caen aquí:
--
--     · El anfitrión **ya no publica su número de WhatsApp**: el contacto lo
--       lleva la plataforma. El número deja de usarse y deja de ser legible.
--     · Hace falta un **perfil maestro** que vea todas las pensiones, gestione su
--       disponibilidad y pueda borrar.
--
-- Qué hace, en cinco partes
--
--   1. Añade el rol `maestro`. **Se concede por SQL, nunca desde la aplicación**:
--      el disparador de alta (`crear_perfil_usuario`) mantiene su lista blanca de
--      dos roles, así que un registro con `rol: maestro` en los metadatos cae al
--      rol por defecto, y el privilegio de escritura sobre `rol` ya estaba
--      retirado desde la oleada 2. Esta migración NO toca esa lista blanca.
--   2. `es_maestro()`: la única forma de preguntar si quien llama es maestro. Una
--      función `stable` y `security definer` para que la comprobación no dependa
--      de las políticas de `usuarios` ni se repita como subconsulta en cada fila.
--   3. El maestro **lee todo**, incluidas las retiradas.
--   4. El maestro **edita la disponibilidad de cualquier habitación** y **borra
--      cualquier publicación**. El anfitrión conserva exactamente lo que tenía.
--   5. `pensiones.whatsapp` y `pensiones.autorizacion_contacto_en` dejan de ser
--      legibles por la API. **Los datos se conservan**: esto no borra nada.
--
-- Lo que NO hace, y por qué
--
--   · **No borra los números ya guardados.** Sería destructivo y esta migración
--     es explícitamente no destructiva. Si además quieres eliminar los valores
--     existentes, es un `update public.pensiones set whatsapp = null` aparte,
--     deliberadamente fuera de este archivo.
--   · **No retira la restricción `pensiones_autorizacion_para_whatsapp`.** Queda
--     sin objeto (solo vigila una columna que ya nadie escribe), pero retirar una
--     restricción es una decisión con consecuencias y no aporta nada hoy: se deja,
--     documentada, y se retira el día que se elimine la columna.
--   · **No le da al maestro permiso para editar títulos, precios o fotos.** El
--     fundador pidió acceso, disponibilidad y borrado; el resto sigue siendo del
--     anfitrión. Si quiere editar todo, es una política más (está anotado abajo).
--   · **No toca el privilegio de INSERT** de `pensiones`: la creación se hace por
--     la función transaccional y reemitir ese privilegio por columnas pondría en
--     riesgo el flujo de publicación sin ganar nada (el dato quedaría igual de
--     ilegible).
--
-- Orden con la tarea #39
--
--   Esta migración retira `whatsapp` de las columnas que la aplicación puede
--   escribir. Si se aplica **antes** de que la interfaz deje de enviarlo, publicar
--   un anuncio sigue funcionando (la publicación se crea) pero el formulario
--   mostrará el aviso honesto de que el número no se guardó. Lo ideal es
--   aplicarla junto con la #39; si no, no se rompe nada y no hay pérdida de datos.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0) Aviso si falta la oleada 7, de la que depende el borrado
--
--    `borrar_pension` reserva la dirección del anuncio borrado mediante el
--    disparador de la oleada 7. Sin él, borrar funciona pero la dirección queda
--    libre y podría acabar mostrando otro anuncio: exactamente el fallo que esa
--    oleada cierra. El aviso es ruidoso a propósito.
-- ---------------------------------------------------------------------------
do $aviso$
begin
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.pensiones'::regclass
       and tgname = 'despues_de_borrar_publicacion'
  ) then
    raise warning 'Oleada 7 no aplicada: las direcciones de los anuncios borrados NO quedarán reservadas. Aplica supabase/oleada-7.sql antes que esta.';
  end if;
end
$aviso$;


-- ---------------------------------------------------------------------------
-- 1) El rol `maestro`
--
--    Solo se amplía el `check`. La lista blanca del disparador de alta no se
--    toca: sigue admitiendo únicamente `estudiante` y `anfitrion`, así que el rol
--    maestro **no se puede pedir desde una pantalla de registro**.
-- ---------------------------------------------------------------------------
alter table public.usuarios drop constraint if exists usuarios_rol_check;
alter table public.usuarios
  add constraint usuarios_rol_check check (rol in ('estudiante', 'anfitrion', 'maestro'));


-- ---------------------------------------------------------------------------
-- 2) `es_maestro()`: una sola pregunta, un solo sitio
--
--    SECURITY DEFINER para que lea `usuarios` sin pasar por sus políticas (que
--    solo dejan leer el propio perfil) y para que la respuesta no dependa de
--    cambios futuros en ellas. STABLE porque dentro de una misma consulta el
--    resultado no cambia, y así PostgreSQL puede evaluarla una vez.
--
--    La identidad sale SIEMPRE de la sesión (`auth.uid()`), nunca de un
--    argumento: una función que aceptara un id de usuario convertiría cualquier
--    política en una puerta abierta.
-- ---------------------------------------------------------------------------
create or replace function public.es_maestro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.usuarios u
     where u.id = (select auth.uid())
       and u.rol = 'maestro'
  );
$$;

revoke execute on function public.es_maestro() from public;
revoke execute on function public.es_maestro() from anon;
grant execute on function public.es_maestro() to authenticated;


-- ---------------------------------------------------------------------------
-- 3) El maestro LEE todo, incluidas las publicaciones retiradas
--
--    Son políticas permisivas, así que se suman a las que ya existen: el catálogo
--    público no cambia, y el maestro además ve lo que el público no ve.
-- ---------------------------------------------------------------------------
drop policy if exists "pensiones: el maestro lee todas" on public.pensiones;
create policy "pensiones: el maestro lee todas" on public.pensiones
  for select to authenticated
  using (public.es_maestro());

drop policy if exists "habitaciones: el maestro lee todas" on public.habitaciones;
create policy "habitaciones: el maestro lee todas" on public.habitaciones
  for select to authenticated
  using (public.es_maestro());


-- ---------------------------------------------------------------------------
-- 4) El maestro edita la disponibilidad de cualquier habitación
--
--    Es una política de fila: las columnas que se pueden escribir siguen
--    limitadas por el privilegio de columna, que es el mismo para el anfitrión y
--    para el maestro. Es decir: el maestro puede tocar las mismas columnas que el
--    anfitrión, sobre cualquier fila; **no** puede tocar las prohibidas.
-- ---------------------------------------------------------------------------
drop policy if exists "habitaciones: el maestro edita la disponibilidad" on public.habitaciones;
create policy "habitaciones: el maestro edita la disponibilidad" on public.habitaciones
  for update to authenticated
  using (public.es_maestro())
  with check (public.es_maestro());


-- ---------------------------------------------------------------------------
-- 5) Borrado: lo propio o el maestro
--
--    Se eliminan los dos nombres posibles de la política anterior para que el
--    resultado sea el mismo tanto si la oleada 7 se aplicó como si no.
-- ---------------------------------------------------------------------------
drop policy if exists "pensiones: borrar las propias" on public.pensiones;
drop policy if exists "pensiones: borrar las propias o el maestro" on public.pensiones;
create policy "pensiones: borrar las propias o el maestro" on public.pensiones
  for delete to authenticated
  using ((select auth.uid()) = anfitrion_id or public.es_maestro());


-- ---------------------------------------------------------------------------
-- 6) La función de borrado, ahora también para el maestro
--
--    Se reemite completa (la de la oleada 7 era solo del dueño). El predicado del
--    `delete` refleja la misma regla que la comprobación previa: si la guarda
--    fallara por un cambio futuro, el borrado sigue acotado a lo permitido.
-- ---------------------------------------------------------------------------
create or replace function public.borrar_pension(p_pension_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario     uuid := (select auth.uid());
  v_propietario uuid;
  v_slug        text;
  v_filas       integer;
begin
  if v_usuario is null then
    raise exception 'Necesitas una sesión para borrar una publicación'
      using errcode = '42501';
  end if;

  select p.anfitrion_id, p.slug
    into v_propietario, v_slug
    from public.pensiones p
   where p.id = p_pension_id;

  if not found then
    raise exception 'Esa publicación ya no existe'
      using errcode = 'P0002';
  end if;

  if v_propietario is distinct from v_usuario and not public.es_maestro() then
    raise exception 'Esa publicación no es tuya, así que no se borró nada'
      using errcode = '42501';
  end if;

  -- Primero las habitaciones: no dependemos de que la cascada siga configurada.
  delete from public.habitaciones where pension_id = p_pension_id;

  delete from public.pensiones
   where id = p_pension_id
     and (anfitrion_id = v_usuario or public.es_maestro());

  get diagnostics v_filas = row_count;
  if v_filas <> 1 then
    raise exception 'No se pudo borrar la publicación (filas afectadas: %)', v_filas
      using errcode = 'P0001';
  end if;

  return v_slug;
end;
$$;

revoke execute on function public.borrar_pension(uuid) from public;
revoke execute on function public.borrar_pension(uuid) from anon;
grant execute on function public.borrar_pension(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 7) El número del anfitrión, fuera del alcance de la API
--
--    ⚠️ La trampa que obliga a enumerar columnas: en PostgreSQL, revocar una
--    columna NO retira el privilegio de tabla. Con el `grant select on tables`
--    que Supabase aplica por defecto, un `revoke select (whatsapp)` habría
--    quedado sin efecto — habría parecido cerrado sin estarlo. Por eso se retira
--    el privilegio de tabla y se vuelve a conceder **enumerando las columnas que
--    sí se leen**. Es la misma decisión que en las oleadas 2 y 3.
--
--    Efecto colateral que hay que conocer: cualquier consulta con comodín
--    (`select=*`, o sin `select`, que en PostgREST equivale a todas las columnas)
--    pasa a fallar con `42501` para `anon` y `authenticated`. La aplicación ya no
--    usa comodines —la proyección explícita de la oleada 8 está protegida por una
--    prueba— y el verificador de RLS se actualizó por el mismo motivo.
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


-- ---------------------------------------------------------------------------
-- 8) Y dejan de poder escribirse
--
--    Se reemite la **lista completa** de columnas editables (la de la oleada 6)
--    sin `whatsapp` ni `autorizacion_contacto_en`. Las prohibidas siguen fuera:
--    `verificado`, `calificacion`, `precio_mensual`, `anfitrion_id`, `id` y
--    `slug` (que se fija solo al publicar).
-- ---------------------------------------------------------------------------
revoke update on public.pensiones from anon, authenticated;

grant update (
  activa,
  barrio,
  descripcion,
  direccion,
  distancia_a_pie_minutos,
  imagenes,
  normas,
  servicios,
  titulo
) on public.pensiones to authenticated;


-- ============================================================================
-- Verificación tras aplicar (no escribe nada; NO se ha ejecutado todavía):
--
--   -- 1. El rol existe y la lista blanca del alta sigue con dos roles:
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'usuarios_rol_check';
--   -- esperado: el check con 'estudiante', 'anfitrion' y 'maestro'
--   select position('maestro' in prosrc) = 0 as alta_no_admite_maestro
--     from pg_proc where proname = 'crear_perfil_usuario';
--   -- esperado: t  (un registro no puede pedir el rol maestro)
--
--   -- 2. El número ya no se puede leer:
--   select has_column_privilege('anon','public.pensiones','whatsapp','SELECT'),                -- f
--          has_column_privilege('anon','public.pensiones','autorizacion_contacto_en','SELECT'), -- f
--          has_column_privilege('anon','public.pensiones','titulo','SELECT');                 -- t
--
--   -- 3. Las prohibidas siguen prohibidas:
--   select has_column_privilege('authenticated','public.pensiones','verificado','UPDATE'),    -- f
--          has_column_privilege('authenticated','public.pensiones','calificacion','UPDATE'),  -- f
--          has_column_privilege('authenticated','public.pensiones','precio_mensual','UPDATE'),-- f
--          has_column_privilege('authenticated','public.pensiones','anfitrion_id','UPDATE'),  -- f
--          has_column_privilege('authenticated','public.pensiones','slug','UPDATE');          -- f
--
--   -- 4. Las políticas del maestro:
--   select policyname, cmd from pg_policies
--    where schemaname = 'public' and policyname like '%maestro%' order by policyname;
--
-- Conceder el perfil maestro (SOLO por SQL; nunca desde la aplicación):
--   update public.usuarios set rol = 'maestro' where email = 'correo-de-la-cuenta';
--
-- Si además quieres borrar los números ya guardados (esta migración NO lo hace):
--   update public.pensiones set whatsapp = null where whatsapp is not null;
--
-- Reversión (deja el esquema como estaba; no toca datos):
--   drop policy if exists "pensiones: el maestro lee todas" on public.pensiones;
--   drop policy if exists "habitaciones: el maestro lee todas" on public.habitaciones;
--   drop policy if exists "habitaciones: el maestro edita la disponibilidad" on public.habitaciones;
--   drop policy if exists "pensiones: borrar las propias o el maestro" on public.pensiones;
--   drop function if exists public.es_maestro();
--   -- y volver a aplicar la lista de columnas y la política de borrado de la oleada 7
--
-- Pruebas de aceptación (crean datos, comprueban y limpian):
--   supabase/pruebas/oleada-9.sql
-- ============================================================================
