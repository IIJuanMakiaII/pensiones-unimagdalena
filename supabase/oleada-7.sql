-- ============================================================================
-- Oleada 7 — Borrar un anuncio, con las reglas en la base
-- Ejecutar después de esquema.sql, storage-fotos.sql y oleada-1.sql … oleada-6.sql.
-- Es idempotente.
--
-- Qué resuelve (tarea #33 · la mitad que faltaba de M-15)
--
--   Editar, retirar y republicar ya existían. Borrar no. Y borrar tiene una
--   diferencia que no es de matiz: **retirar se deshace, borrar no**. Por eso las
--   reglas de quién puede hacerlo y qué se lleva por delante tienen que estar en
--   la base, no en el botón que las invoca.
--
-- Las cuatro reglas que impone esta migración
--
--   1. SOLO EL DUEÑO BORRA. Ni otro anfitrión ni un anónimo. La política de
--      borrado ya existía (`esquema.sql`); aquí se reemite para que la regla
--      quede declarada en un solo sitio verificable, y la función
--      `borrar_pension()` la aplica a mano para poder devolver un código de
--      error claro en lugar de un «se borraron 0 filas» que no explica nada.
--
--   2. BORRAR SE LLEVA LAS HABITACIONES. La clave foránea
--      `habitaciones.pension_id → pensiones.id` es `on delete cascade`, así que
--      esto ya ocurría. La función las borra **también explícitamente**: no
--      dependemos de que la cascada siga ahí el día que alguien toque la clave,
--      y la prueba comprueba el resultado (0 habitaciones huérfanas), no la
--      configuración.
--
--   3. LA DIRECCIÓN DE UN ANUNCIO BORRADO NO SE REUTILIZA. Este es el punto que
--      más importa y el que no estaba resuelto en ningún sitio:
--
--        · Un enlace a `/pensiones/casa-sol` circula por WhatsApp.
--        · El anfitrión borra su anuncio: la fila desaparece y el slug queda libre.
--        · Otro anfitrión publica «Casa Sol» y el disparador le asigna
--          `casa-sol`, porque ya nadie lo ocupa.
--        · **El enlace viejo, que debería estar muerto, ahora muestra otra
--          pensión**: con su precio y su número de contacto. Quien lo recibió
--          cree que sigue hablando con el mismo arrendador.
--
--      Por eso las direcciones se apuntan en un registro (`slugs_reservados`) que
--      **sobrevive al borrado**, y ni el generador ni una carga manual pueden
--      volver a usar una. La dirección muere: responde como inexistente, para
--      siempre.
--
--   4. BORRAR NO ES RETIRAR. Retirar (`activa = false`) conserva el anuncio y se
--      deshace; por eso **no** reserva la dirección. Solo el borrado reserva.
--
-- Por qué una tabla de reserva y no un borrado lógico
--
--   La alternativa era no borrar de verdad: dejar la fila con una marca. Se
--   descartó porque un anuncio borrado conservaría para siempre el **número de
--   WhatsApp del anfitrión y sus fotos**, y el usuario que borra su anuncio está
--   pidiendo justo lo contrario (los textos legales de la tarea #30 lo prometen).
--   La reserva guarda **solo la dirección**, que no identifica a nadie por sí
--   sola, y permite que el dato personal desaparezca de verdad.
--
-- Qué NO cambia
--
--   · Ningún privilegio de columna: no se toca la lista de columnas editables de
--     la oleada 6. `verificado`, `calificacion`, `precio_mensual`, `anfitrion_id`,
--     `id` y `slug` siguen sin poder escribirse desde la API.
--   · La restricción `pensiones_autorizacion_para_whatsapp` sigue en pie.
--   · No se borra ni se modifica ninguna fila existente.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) El registro de direcciones retiradas
--
--    Append-only: nada lo borra desde la aplicación ni desde la API. Con RLS
--    activado y SIN políticas, solo las funciones `security definer` de esta
--    migración (y el servicio) pueden tocarlo; a `anon` y `authenticated` se les
--    retira el privilegio además de la política, para que la intención se lea en
--    dos sitios.
-- ---------------------------------------------------------------------------
create table if not exists public.slugs_reservados (
  slug        text primary key,
  reservado_en timestamptz not null default now(),
  motivo      text not null default 'anuncio-borrado'
);

comment on table public.slugs_reservados is
  'Direcciones públicas que no se pueden volver a usar. Un slug entra aquí cuando se BORRA el anuncio que lo tenía (no cuando se retira), para que un enlace que ya circula no acabe mostrando otra pensión. No guarda datos personales: solo la dirección.';

alter table public.slugs_reservados enable row level security;

revoke all on public.slugs_reservados from anon, authenticated;

alter table public.slugs_reservados drop constraint if exists slugs_reservados_formato;
alter table public.slugs_reservados
  add constraint slugs_reservados_formato
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80);


-- ---------------------------------------------------------------------------
-- 2) Al borrar un anuncio, su dirección queda reservada
--
--    AFTER DELETE y a nivel de fila: da igual quién borre y por qué camino
--    (la función de abajo, un `DELETE` directo contra la API o el editor SQL).
--    En cuanto la fila deja de existir, la dirección ya no puede reasignarse.
-- ---------------------------------------------------------------------------
create or replace function public.reservar_slug_al_borrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.slugs_reservados (slug) values (old.slug)
  on conflict (slug) do nothing;
  return null;
end;
$$;

drop trigger if exists despues_de_borrar_publicacion on public.pensiones;
create trigger despues_de_borrar_publicacion
  after delete on public.pensiones
  for each row execute function public.reservar_slug_al_borrar();

revoke execute on function public.reservar_slug_al_borrar() from public;
revoke execute on function public.reservar_slug_al_borrar() from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3) El generador de direcciones respeta las reservadas
--
--    Se reemplaza la función de la oleada 5 (mismo contrato, misma firma) para
--    que un anuncio nuevo **nunca** herede una dirección retirada: si el título
--    da `casa-sol` y esa dirección está reservada, el nuevo recibe `casa-sol-2`.
--
--    Y en el caso de una carga manual que traiga el slug escrito a mano: si esa
--    dirección está reservada, se **rechaza con un error explícito** en lugar de
--    aceptarla. Sin esto, quien escribiera el slug a propósito podría revivir un
--    enlace muerto, que es justo lo que hay que impedir.
-- ---------------------------------------------------------------------------
create or replace function public.asignar_slug_pension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_candidato text;
  v_n int := 1;
begin
  if new.slug is not null and new.slug <> '' then
    if exists (select 1 from public.slugs_reservados where slug = new.slug) then
      raise exception 'La dirección «%» pertenece a un anuncio borrado y no se puede reutilizar', new.slug
        using errcode = '23505',
              hint = 'Deja que la dirección se genere sola a partir del título.';
    end if;
    return new;
  end if;

  v_base := public.slugificar(new.titulo);
  if length(v_base) < 3 then
    v_base := 'pension';
  end if;

  v_candidato := v_base;
  while exists (
    select 1 from public.pensiones
     where slug = v_candidato and id is distinct from new.id
  ) or exists (
    select 1 from public.slugs_reservados where slug = v_candidato
  ) loop
    v_n := v_n + 1;
    v_candidato := v_base || '-' || v_n;
  end loop;

  new.slug := v_candidato;
  return new;
end;
$$;

revoke execute on function public.asignar_slug_pension() from public;
revoke execute on function public.asignar_slug_pension() from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4) Quién puede borrar: la política, reemitida
--
--    Ya existía en `esquema.sql`. Se reemite aquí, con el mismo criterio, para
--    que la regla esté declarada junto al resto del ciclo de borrado y para
--    dejarla a prueba de que alguien la debilite sin darse cuenta: la condición
--    es exactamente «el anuncio es tuyo».
-- ---------------------------------------------------------------------------
drop policy if exists "pensiones: borrar las propias" on public.pensiones;
create policy "pensiones: borrar las propias" on public.pensiones
  for delete to authenticated
  using ((select auth.uid()) = anfitrion_id);


-- ---------------------------------------------------------------------------
-- 5) La función con la que la interfaz borra
--
--    Por qué una función y no un `DELETE` desde la aplicación:
--
--    · La RLS ya impide borrar lo ajeno, pero un borrado bloqueado devuelve
--      «0 filas» sin decir por qué. La alternativa —no borrar nada y devolver
--      éxito— es exactamente el fallo silencioso que hay que evitar en una
--      acción **irreversible**. Aquí, o se borra, o se levanta un error que la
--      interfaz puede traducir a un mensaje.
--    · Devuelve la dirección que acaba de quedar reservada, que es la evidencia
--      de lo ocurrido y lo que el panel necesita para explicárselo al anfitrión.
--
--    SECURITY DEFINER + search_path fijo (como el resto de funciones del
--    proyecto) para que la regla sea la de esta función y no dependa de cuántas
--    políticas haya encima; la comprobación de propiedad es explícita y la
--    identidad sale siempre de la sesión, nunca de un argumento.
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

  if v_propietario is distinct from v_usuario then
    raise exception 'Esa publicación no es tuya, así que no se borró nada'
      using errcode = '42501';
  end if;

  -- Primero las habitaciones (ver regla 2). Es un borrado explícito: no
  -- dependemos de que la cascada siga configurada.
  delete from public.habitaciones where pension_id = p_pension_id;

  delete from public.pensiones
   where id = p_pension_id
     and anfitrion_id = v_usuario;

  get diagnostics v_filas = row_count;
  if v_filas <> 1 then
    -- No debería ocurrir; si ocurre, no se informa de un éxito que no hubo.
    raise exception 'No se pudo borrar la publicación (filas afectadas: %)', v_filas
      using errcode = 'P0001';
  end if;

  -- La dirección ya quedó reservada por el disparador `despues_de_borrar_publicacion`.
  return v_slug;
end;
$$;

revoke execute on function public.borrar_pension(uuid) from public;
revoke execute on function public.borrar_pension(uuid) from anon;
grant execute on function public.borrar_pension(uuid) to authenticated;


-- ============================================================================
-- Verificación rápida tras aplicar (no escribe nada):
--
--   -- 1. La tabla de reserva existe y está cerrada a la API:
--   select relrowsecurity from pg_class where oid = 'public.slugs_reservados'::regclass;   -- t
--   select has_table_privilege('authenticated','public.slugs_reservados','SELECT');         -- f
--
--   -- 2. Los dos disparadores:
--   select tgname from pg_trigger where tgrelid = 'public.pensiones'::regclass and not tgisinternal;
--   -- esperado: antes_de_asignar_slug, antes_de_escribir_pension,
--   --           despues_de_borrar_publicacion
--
--   -- 3. La política de borrado:
--   select policyname, cmd, qual from pg_policies
--    where schemaname='public' and tablename='pensiones' and cmd='DELETE';
--
--   -- 4. Las restricciones anteriores siguen en pie:
--   select has_column_privilege('authenticated','public.pensiones','verificado','UPDATE'),  -- f
--          has_column_privilege('authenticated','public.pensiones','calificacion','UPDATE'), -- f
--          has_column_privilege('authenticated','public.pensiones','precio_mensual','UPDATE'), -- f
--          has_column_privilege('authenticated','public.pensiones','anfitrion_id','UPDATE'),  -- f
--          has_column_privilege('authenticated','public.pensiones','slug','UPDATE'),          -- f
--          (select count(*) from pg_constraint
--            where conrelid='public.pensiones'::regclass
--              and conname='pensiones_autorizacion_para_whatsapp');                             -- 1
--
--   -- 5. Reservas acumuladas (vacío hasta el primer borrado):
--   select * from public.slugs_reservados order by reservado_en desc;
--
-- Pruebas de aceptación completas (crean datos, comprueban y limpian):
--   supabase/pruebas/oleada-7.sql
--
-- Reversión (no borra datos de anuncios; solo deshace lo que añade esta oleada):
--   drop trigger if exists despues_de_borrar_publicacion on public.pensiones;
--   drop function if exists public.reservar_slug_al_borrar();
--   drop function if exists public.borrar_pension(uuid);
--   drop policy if exists "pensiones: borrar las propias" on public.pensiones;
--   -- y volver a aplicar la función `asignar_slug_pension` de oleada-5.sql
--   -- (la tabla slugs_reservados se puede dejar: no molesta a nadie)
-- ============================================================================
