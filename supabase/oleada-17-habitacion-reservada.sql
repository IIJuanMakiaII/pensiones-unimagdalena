-- ============================================================================
-- Oleada 17 — El estado «reservada» de una habitación
-- Proyecto: Nido · Supabase/Postgres · tarea #103
--
-- ⚠ ORDEN DE DESPLIEGUE — leer antes de pegar
--
--   1. Se aplica ESTA migración primero, sola, en el editor SQL.
--   2. Se ejecuta el bloque de verificación G, y G.3, G.4 y G.7 tienen que
--      devolver lo que dicen. Si alguna no cuadra, NO se despliega nada más.
--   3. Solo entonces el Ingeniero puede fusionar el botón del panel (#106),
--      que es lo único que llama a estas dos funciones.
--
--   Al revés no: el botón nuevo llama a `marcar_habitacion_reservada(uuid)`.
--   Si el código entra antes, cada pulsación responde 404 PGRST202 —
--   «Could not find the function»— porque la función todavía no existe.
--   No rompe el catálogo, pero deja la función muerta en la interfaz.
--
-- QUE HACE, Y POR QUE ASI
--
--   Juan gestiona las reservas FUERA de la plataforma. No hay pasarela, no hay
--   evento de «pago confirmado» y no hay tabla de reservas: cuando el pago se
--   confirma, lo sabe él, no el sistema. Lo que esta migración añade es el
--   registro de ese hecho sobre la habitación —cuándo y quién— y la garantía de
--   que una habitación reservada deja de ofrecerse.
--
--   La garantía se apoya en el predicado que YA existe. El catálogo, la ficha y
--   el precio «desde» filtran por `habitaciones.disponible`
--   (`lib/pensiones.ts:27`, `components/DetallePension.tsx:26-27`,
--   `lib/filtros.ts:67-68,146`). Por eso marcar una reserva pone
--   `disponible = false`: **ninguna consulta pública cambia de forma**, y la
--   habitación desaparece de la oferta en el mismo instante. El estado nuevo no
--   sustituye al booleano, lo acompaña.
--
--   Y se registra `disponible_antes_de_reservar` para poder devolver la
--   habitación exactamente al valor que tenía. Sin eso, liberar una reserva
--   obligaría a adivinar si el anfitrión la había apagado por su cuenta.
--
-- ADITIVA. No renombra ni quita `disponible`, no toca `pensiones`, no toca
-- precios, comisión ni anticipo, y no reescribe una sola fila existente: las
-- tres columnas nacen NULL y NULL es «no reservada».
--
-- Idempotente: se puede pegar dos veces sin efecto adicional.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0) Guardas de dependencia — fallar aquí es mejor que fallar a medias
-- ---------------------------------------------------------------------------

do $$
begin
  if pg_catalog.to_regclass('public.habitaciones') is null then
    raise exception 'Falta public.habitaciones: aplica supabase/esquema.sql antes de esta migracion';
  end if;

  -- Las dos funciones preguntan por el rol maestro con la funcion de oleada-9.
  -- Sin ella, el `raise` seria un error de compilacion en tiempo de ejecucion y
  -- el mensaje no diria por que.
  if pg_catalog.to_regprocedure('public.es_maestro()') is null then
    raise exception 'Falta public.es_maestro(): aplica supabase/oleada-9.sql antes de esta migracion';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- 1) El estado: tres columnas, y una sola forma de representarlo
--
--    `reservada_en is not null`  ⇔  la habitación está reservada.
--
--    `reservada_por` es auditoría (quién pulsó), no la fuente de verdad: si esa
--    cuenta se borrara, la reserva sigue siendo cierta y su fecha se conserva.
--    Por eso la FK es `on delete set null` y los checks no la exigen.
-- ---------------------------------------------------------------------------

alter table public.habitaciones
  add column if not exists reservada_en timestamptz;

alter table public.habitaciones
  add column if not exists reservada_por uuid
    references public.usuarios(id) on delete set null;

-- Qué valor tenía `disponible` antes de la reserva, para restaurarlo al liberar.
alter table public.habitaciones
  add column if not exists disponible_antes_de_reservar boolean;

comment on column public.habitaciones.reservada_en is
  'Cuando se confirmo la reserva. NULL = no reservada. Lo escribe solo marcar_habitacion_reservada(); el cliente no tiene privilegio de escritura sobre esta columna. No se reasigna: liberar la pone a NULL.';

comment on column public.habitaciones.reservada_por is
  'Cuenta que marco la reserva (maestro o anfitrion dueno). Auditoria, no fuente de verdad: si la cuenta se borra, la reserva sigue siendo cierta y conserva su fecha.';

comment on column public.habitaciones.disponible_antes_de_reservar is
  'Valor de `disponible` justo antes de reservar. Existe para que liberar devuelva la habitacion al estado que tenia, sin adivinar si el anfitrion la habia apagado por su cuenta. NULL cuando no hay reserva.';


-- ---------------------------------------------------------------------------
-- 2) Los cuatro estados imposibles que la tabla ahora no admite
--
--    Se recrean con `drop` + `add` porque Postgres no tiene
--    `add constraint if not exists`. Es seguro: los checks se validan contra las
--    filas existentes, y todas las filas existentes cumplen (las tres columnas
--    son NULL y NULL significa «no reservada»).
-- ---------------------------------------------------------------------------

-- 2.1 No se puede ofrecer una habitación reservada. Es la garantía central: si
--     alguien intenta `update habitaciones set disponible = true` sobre una
--     reservada, el update falla con 23514 en vez de publicarla por error.
alter table public.habitaciones
  drop constraint if exists habitaciones_reservada_no_se_ofrece;
alter table public.habitaciones
  add constraint habitaciones_reservada_no_se_ofrece
  check (reservada_en is null or disponible = false);

-- 2.2 Una reserva siempre sabe a qué estado volver.
alter table public.habitaciones
  drop constraint if exists habitaciones_reserva_con_valor_previo;
alter table public.habitaciones
  add constraint habitaciones_reserva_con_valor_previo
  check (reservada_en is null or disponible_antes_de_reservar is not null);

-- 2.3 Sin reserva no queda rastro: ni valor previo ni autor colgando.
alter table public.habitaciones
  drop constraint if exists habitaciones_sin_reserva_sin_rastro;
alter table public.habitaciones
  add constraint habitaciones_sin_reserva_sin_rastro
  check (
    reservada_en is not null
    or (disponible_antes_de_reservar is null and reservada_por is null)
  );

-- 2.4 Quién sin cuándo es imposible: el autor no puede sobrevivir a la fecha.
alter table public.habitaciones
  drop constraint if exists habitaciones_autor_con_fecha;
alter table public.habitaciones
  add constraint habitaciones_autor_con_fecha
  check (reservada_por is null or reservada_en is not null);


-- ---------------------------------------------------------------------------
-- 3) Las dos funciones — el único camino de escritura del estado
--
--    `security definer` porque el cliente NO tiene privilegio sobre las tres
--    columnas (ver sección 4): si fuera invoker, el propio `update` fallaría con
--    42501. Al ser definer, la función es la puerta y las columnas quedan fuera
--    del alcance del navegador: nadie puede marcarse una reserva desde el
--    cliente, ni poniendo un `PATCH` a mano.
--
--    `set search_path = pg_catalog` y todas las referencias cualificadas: es el
--    patrón de `borrar_pension` (oleada-9) y `maestro_actualizar_campos_pension`,
--    y evita que un `search_path` manipulado por el llamante redirija
--    `habitaciones` a otra tabla.
--
--    Permisos: el maestro administra y el anfitrión dueño sabe cuándo cobró.
--    Cualquier otra cuenta recibe 42501. El dueño se resuelve por la pensión,
--    que es el mismo predicado de propiedad que usan las políticas (esquema.sql:161).
-- ---------------------------------------------------------------------------

create or replace function public.marcar_habitacion_reservada(p_habitacion_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_usuario        uuid := (select auth.uid());
  v_anfitrion      uuid;
  v_disponible     boolean;
  v_reservada_en   timestamptz;
  v_fecha          timestamptz;
begin
  if v_usuario is null then
    raise exception 'Necesitas una sesion para marcar una habitacion como reservada'
      using errcode = '42501';
  end if;

  if p_habitacion_id is null then
    raise exception 'Indica la habitacion que se reserva'
      using errcode = '22023';
  end if;

  -- `for update of h` bloquea la fila: dos pulsaciones simultáneas se
  -- serializan y la segunda ve el estado que dejó la primera.
  select p.anfitrion_id, h.disponible, h.reservada_en
    into v_anfitrion, v_disponible, v_reservada_en
    from public.habitaciones as h
    join public.pensiones as p on p.id = h.pension_id
   where h.id = p_habitacion_id
     for update of h;

  if not found then
    raise exception 'Esa habitacion no existe'
      using errcode = 'P0002';
  end if;

  if not (public.es_maestro() or v_anfitrion = v_usuario) then
    raise exception 'Solo el maestro o el anfitrion dueno de la pension puede marcar una reserva'
      using errcode = '42501';
  end if;

  -- Idempotente: si ya estaba reservada devuelve su fecha, sin reescribirla.
  -- Volver a pulsar no puede mover el «cuándo» ni el autor.
  if v_reservada_en is not null then
    return v_reservada_en;
  end if;

  update public.habitaciones as h
     set disponible                   = false,
         disponible_antes_de_reservar = v_disponible,
         reservada_en                 = pg_catalog.now(),
         reservada_por                = v_usuario
   where h.id = p_habitacion_id
  returning h.reservada_en into v_fecha;

  return v_fecha;
end;
$$;


create or replace function public.liberar_habitacion_reservada(p_habitacion_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_usuario        uuid := (select auth.uid());
  v_anfitrion      uuid;
  v_reservada_en   timestamptz;
  v_disponible_antes boolean;
begin
  if v_usuario is null then
    raise exception 'Necesitas una sesion para liberar una habitacion'
      using errcode = '42501';
  end if;

  if p_habitacion_id is null then
    raise exception 'Indica la habitacion que se libera'
      using errcode = '22023';
  end if;

  select p.anfitrion_id, h.reservada_en, h.disponible_antes_de_reservar
    into v_anfitrion, v_reservada_en, v_disponible_antes
    from public.habitaciones as h
    join public.pensiones as p on p.id = h.pension_id
   where h.id = p_habitacion_id
     for update of h;

  if not found then
    raise exception 'Esa habitacion no existe'
      using errcode = 'P0002';
  end if;

  if not (public.es_maestro() or v_anfitrion = v_usuario) then
    raise exception 'Solo el maestro o el anfitrion dueno de la pension puede liberar una reserva'
      using errcode = '42501';
  end if;

  -- No estaba reservada: no hay nada que liberar, y no se toca `disponible`.
  -- Devolver `false` permite que la interfaz lo diga en vez de fingir que hizo algo.
  if v_reservada_en is null then
    return false;
  end if;

  update public.habitaciones
     set disponible                   = coalesce(v_disponible_antes, false),
         disponible_antes_de_reservar = null,
         reservada_en                 = null,
         reservada_por                = null
   where id = p_habitacion_id;

  return true;
end;
$$;


-- ---------------------------------------------------------------------------
-- 4) Privilegios por columna, reemitidos COMPLETOS
--
--    Aquí está el riesgo de esta migración, así que queda escrito:
--
--    · `pensiones` ya es por columna desde oleada-10/13/16. `habitaciones` NO lo
--      era: conservaba el `SELECT` de tabla que Supabase concede por defecto. Y
--      una tabla con grant de tabla hace que **toda columna nueva nazca legible**
--      por `anon`, sin que nadie lo decida. Con las tres columnas nuevas eso
--      significaría publicar quién marcó la reserva.
--
--    · Convertir el SELECT a columnas tiene una trampa conocida: `select=*` deja
--      de funcionar y responde 42501, y con él caería el catálogo entero. Por eso
--      se comprobó antes de escribir esto que ningún consumidor pide `*`:
--        - la app usa `COLUMNAS_HABITACION` (7 columnas, `lib/supabase/mapeo.ts:107`);
--        - `verificar-supabase.mjs:44` pide `id,pension_id,disponible`;
--        - las funciones que leen la tabla (`imponer_precio_pension`,
--          `crear_pension_con_habitaciones`) piden `precio_mensual_cop`,
--          `pension_id` y `disponible`, o son `security definer`.
--      Si esa lista y esta se separan, G.9 lo dice con un 200 o un 42501, no con
--      un catálogo vacío silencioso.
--
--    · La lista del UPDATE se reemite igual que la dejó oleada-11:154-161. Si se
--      omitiera, el panel de disponibilidad dejaría de poder marcar habitaciones
--      libres y ocupadas: otra vez 42501, esta vez en una escritura.
--
--    Las tres columnas nuevas quedan deliberadamente FUERA de las dos listas:
--    · fuera del SELECT: `anon` no lee cuándo ni quién reservó;
--    · fuera del UPDATE: ni el anfitrión ni el maestro las escriben a mano; solo
--      las dos funciones de la sección 3.
-- ---------------------------------------------------------------------------

revoke select on public.habitaciones from anon, authenticated;
grant select (
  id,
  pension_id,
  tipo,
  genero,
  precio_mensual_cop,
  alimentacion_incluida,
  disponible,
  creada_en
) on public.habitaciones to anon, authenticated;

revoke update on public.habitaciones from anon, authenticated;
grant update (
  disponible,                -- marcar ocupada / libre (panel de disponibilidad)
  tipo,
  genero,
  precio_mensual_cop,
  alimentacion_incluida
) on public.habitaciones to authenticated;

-- `revoke all` y no solo `execute`: `public` viene con EXECUTE por defecto en
-- Postgres, y ese es el grant que `anon` hereda si nadie lo quita.
revoke all on function public.marcar_habitacion_reservada(uuid) from public, anon, authenticated;
grant execute on function public.marcar_habitacion_reservada(uuid) to authenticated;

revoke all on function public.liberar_habitacion_reservada(uuid) from public, anon, authenticated;
grant execute on function public.liberar_habitacion_reservada(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 5) Verificación posterior — ninguna de estas consultas escribe nada
--    (salvo G.7, que va en una transacción que se revierte)
--
--    **La migración no está terminada hasta que G.3, G.4 y G.7 cuadran.**
-- ---------------------------------------------------------------------------

-- G.1 · Las tres columnas existen y son anulables (NULL = no reservada).
select column_name, data_type, is_nullable
  from pg_catalog.pg_columns
 where table_name = 'habitaciones'
   and column_name in ('reservada_en', 'reservada_por', 'disponible_antes_de_reservar')
 order by column_name;
-- Esperado: 3 filas, is_nullable = YES en las tres.

-- G.2 · Los cuatro checks están puestos (y solo esos cuatro son nuevos).
select conname
  from pg_catalog.pg_constraint
 where conrelid = 'public.habitaciones'::regclass
   and contype = 'c'
 order by conname;
-- Esperado: aparecen habitaciones_autor_con_fecha,
-- habitaciones_reserva_con_valor_previo, habitaciones_reservada_no_se_ofrece
-- y habitaciones_sin_reserva_sin_rastro.

-- G.3 · El estado NO se lee desde fuera. Las dos columnas con dato de negocio
--       tienen que dar `f | f`. Si alguna da `t`, no se despliega el botón.
select
  pg_catalog.has_column_privilege('anon',          'public.habitaciones', 'reservada_en', 'SELECT') as anon_reservada_en,
  pg_catalog.has_column_privilege('authenticated', 'public.habitaciones', 'reservada_por', 'SELECT') as auth_reservada_por;
-- Esperado: f | f

-- G.4 · Lo que la app SÍ necesita sigue concedido, y el estado no es editable.
select
  pg_catalog.has_column_privilege('anon',          'public.habitaciones', 'disponible',    'SELECT') as anon_disponible,
  pg_catalog.has_column_privilege('authenticated', 'public.habitaciones', 'disponible',    'UPDATE') as auth_update_disponible,
  pg_catalog.has_column_privilege('authenticated', 'public.habitaciones', 'reservada_en',  'UPDATE') as auth_update_reservada,
  pg_catalog.has_table_privilege ('anon',          'public.habitaciones', 'SELECT')                  as anon_select_tabla;
-- Esperado: t | t | f | f
--   `anon_select_tabla` en f es lo correcto: el SELECT es por columna desde ahora.

-- G.5 · Las dos funciones existen y son `security definer`.
select proname, prosecdef
  from pg_catalog.pg_proc
 where proname in ('marcar_habitacion_reservada', 'liberar_habitacion_reservada')
 order by proname;
-- Esperado: 2 filas, ambas prosecdef = t.

-- G.6 · `anon` no puede llamarlas.
select
  pg_catalog.has_function_privilege('anon', 'public.marcar_habitacion_reservada(uuid)', 'EXECUTE')  as anon_marcar,
  pg_catalog.has_function_privilege('anon', 'public.liberar_habitacion_reservada(uuid)', 'EXECUTE') as anon_liberar;
-- Esperado: f | f

-- G.7 · PRUEBA FUNCIONAL. Va comentada porque necesita el uuid de una cuenta
--       maestra real, y esta migración no debe adivinar cuentas.
--       Sustituye <UUID_MAESTRO> y ejecútala entera: termina en rollback, así que
--       no deja ninguna habitación reservada.
--
--   begin;
--     -- Simula la sesión de esa cuenta maestra, como hace el editor SQL.
--     set local role authenticated;
--     select pg_catalog.set_config(
--       'request.jwt.claims',
--       pg_catalog.json_build_object('sub', '<UUID_MAESTRO>', 'role', 'authenticated')::text,
--       true
--     );
--
--     -- Estado de partida de una habitación real.
--     select id, disponible, reservada_en from public.habitaciones order by creada_en limit 1;
--
--     -- Marcar: devuelve la fecha y deja la habitación fuera de la oferta.
--     select public.marcar_habitacion_reservada(
--       (select id from public.habitaciones order by creada_en limit 1)
--     );
--     select disponible, reservada_en is not null as reservada,
--            disponible_antes_de_reservar
--       from public.habitaciones order by creada_en limit 1;
--     -- Esperado: disponible = f, reservada = t, disponible_antes_de_reservar = t
--
--     -- Repetir no mueve la fecha (idempotente).
--     select public.marcar_habitacion_reservada(
--       (select id from public.habitaciones order by creada_en limit 1)
--     );
--
--     -- Ofrecerla otra vez debe FALLAR con 23514:
--     -- update public.habitaciones set disponible = true
--     --  where id = (select id from public.habitaciones order by creada_en limit 1);
--
--     -- Liberar: vuelve al valor que tenía.
--     select public.liberar_habitacion_reservada(
--       (select id from public.habitaciones order by creada_en limit 1)
--     );
--     -- Esperado: true, y disponible vuelve a t
--   rollback;

-- G.8 · La consulta EXACTA que hace la aplicación. Es la que decide si el
--       catálogo sigue en pie; con la clave anónima tiene que dar 200 con filas.
--
--   curl -s -w '\n%{http_code}\n' \
--     "$SUPABASE_URL/rest/v1/habitaciones?select=id,pension_id,tipo,genero,precio_mensual_cop,alimentacion_incluida,disponible" \
--     -H "apikey: $ANON_KEY"
--
--   Esperado: 200 y las habitaciones que ya se veían. Un 42501 aquí significa que
--   la lista del `grant select` y `COLUMNAS_HABITACION` se separaron.

-- G.9 · Nadie quedó reservado por accidente.
select count(*) as reservadas
  from public.habitaciones
 where reservada_en is not null;
-- Esperado: 0 después de aplicar (G.7 se revierte).


-- ---------------------------------------------------------------------------
-- 6) Reversión — se ejecuta entera, en una transacción, y deja la tabla como
--    estaba en `41aca1e`. No pierde datos: las tres columnas nacieron NULL.
--
--    Está comentada para que pegar el archivo completo no la ejecute. Si hace
--    falta, se descomenta y se corre sola.
--
--   begin;
--     drop function if exists public.liberar_habitacion_reservada(uuid);
--     drop function if exists public.marcar_habitacion_reservada(uuid);
--
--     alter table public.habitaciones
--       drop constraint if exists habitaciones_autor_con_fecha;
--     alter table public.habitaciones
--       drop constraint if exists habitaciones_sin_reserva_sin_rastro;
--     alter table public.habitaciones
--       drop constraint if exists habitaciones_reserva_con_valor_previo;
--     alter table public.habitaciones
--       drop constraint if exists habitaciones_reservada_no_se_ofrece;
--
--     alter table public.habitaciones
--       drop column if exists disponible_antes_de_reservar;
--     alter table public.habitaciones
--       drop column if exists reservada_por;
--     alter table public.habitaciones
--       drop column if exists reservada_en;
--
--     -- El SELECT vuelve a ser de tabla, que es como estaba antes de esta oleada.
--     revoke select on public.habitaciones from anon, authenticated;
--     grant select on public.habitaciones to anon, authenticated;
--
--     revoke update on public.habitaciones from anon, authenticated;
--     grant update (disponible, tipo, genero, precio_mensual_cop, alimentacion_incluida)
--       on public.habitaciones to authenticated;
--   commit;
--
--   Orden de los drops: las funciones primero, porque su cuerpo nombra las
--   columnas; luego los checks, que también las nombran; y solo después las
--   columnas. Al revés, Postgres rechaza el `drop column` por dependencia.


-- ---------------------------------------------------------------------------
-- 7) DECISIÓN ABIERTA que esta migración deja escrita y no toma
--
--   a) ¿El estado «reservada» se distingue de «ocupada» en la interfaz del
--      estudiante? Esta migración guarda la diferencia —`reservada_en` no es
--      `disponible`— pero el catálogo seguirá diciendo «Ocupadas por ahora»,
--      porque `DetallePension.tsx:26-27` solo mira `disponible`. Mostrar
--      «Reservada» es un cambio de interfaz, sin migración nueva.
--
--   b) ¿Se exige que la pensión esté `verificado = true` para marcar una reserva?
--      Hoy NO se exige: `pensiones.verificado` es un booleano que el maestro pone
--      a mano, y la única pensión publicada lo tiene en `false`. Exigirlo dejaría
--      la función inutilizable hasta que el maestro se verifique a sí mismo. Es
--      una regla de negocio, no de integridad: se decide en la interfaz o en una
--      oleada posterior, no aquí.
-- ============================================================================
