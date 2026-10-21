-- ============================================================================
-- Oleada 18 — Lectura de reservas: la fecha, sin abrir la columna
-- Proyecto: Nido · Supabase/Postgres · tarea #118
--
-- sha256 (de este archivo, sin esta misma linea): d0f930d348a8fa1ec757f6f88017754620d7f8c3717a08ec42faed7834a52fb8
--
--   Verificacion exacta (PowerShell 5.1), ruta en $ruta:
--     $u   = [System.Text.UTF8Encoding]::new($false)
--     $l   = [System.IO.File]::ReadAllLines($ruta, $u)
--     $sin = $l | Where-Object { $_ -notmatch '^-- sha256 \(de este archivo' }
--     $txt = ($sin -join "`n") + "`n"
--     $b   = $u.GetBytes($txt)
--     [System.BitConverter]::ToString(
--       [System.Security.Cryptography.SHA256]::Create().ComputeHash($b)
--     ).Replace('-','').ToLower()
--
-- ----------------------------------------------------------------------------
-- POR QUE EXISTE ESTA OLEADA
--
--   La oleada 17 dejo `reservada_en` ilegible para `anon` y `authenticated`, y
--   eso es deliberado: el estado de una reserva no se lee ni se escribe desde el
--   navegador. El unico camino son dos funciones `security definer`.
--
--   Pero el panel del maestro necesita mostrar CUANDO se reservo, y sin lectura
--   no puede: al recargar, la fecha desaparece. Hay dos maneras de resolverlo y
--   solo una es correcta:
--
--     * conceder SELECT sobre `reservada_en`  ->  NO. Deshace la oleada 17.
--     * una funcion de lectura que devuelva    ->  SI. Es esta migracion.
--       solo la fecha, y solo a quien ya
--       podia marcarla
--
--   Esta funcion NO devuelve `reservada_por` ni `disponible_antes_de_reservar`:
--   el panel necesita la fecha, y todo lo demas que se devuelve de mas es
--   superficie que alguien acabara usando para otra cosa.
--
-- ----------------------------------------------------------------------------
-- ORDEN DE DESPLIEGUE
--
--   1. Requiere la oleada 17 aplicada. El bloque 0 aborta si no lo esta.
--   2. Se aplica ESTA migracion sola, entera, en una transaccion.
--   3. Se ejecuta el bloque 3. V.2 a V.5 tienen que dar lo que dicen.
--   4. Solo entonces el panel (#106) puede leer la fecha al recargar.
--
--   Es aditiva: crea una funcion y reparte su permiso. No toca ninguna tabla,
--   ninguna columna, ninguna politica ni ninguna otra funcion.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0) Guardas de dependencia — fallar aqui es mejor que fallar a medias
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.habitaciones') is null then
    raise exception 'Falta public.habitaciones: aplica supabase/esquema.sql antes de esta migracion';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_attribute as a
     where a.attrelid = 'public.habitaciones'::regclass
       and a.attname  = 'reservada_en'
       and a.attnum   > 0
       and not a.attisdropped
  ) then
    raise exception 'Falta la columna public.habitaciones.reservada_en: aplica supabase/oleada-17-habitacion-reservada.sql antes de esta migracion';
  end if;

  if to_regprocedure('public.es_maestro()') is null then
    raise exception 'Falta public.es_maestro(): aplica supabase/oleada-9.sql antes de esta migracion';
  end if;

  if to_regprocedure('public.marcar_habitacion_reservada(uuid)') is null
     or to_regprocedure('public.liberar_habitacion_reservada(uuid)') is null then
    raise exception 'Faltan las funciones de la oleada 17: aplica supabase/oleada-17-habitacion-reservada.sql antes de esta migracion';
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- 1) La funcion — el unico camino de LECTURA del estado
--
--    Mismo patron que las dos de escritura, sin inventar nada:
--      * `security definer` porque el cliente no puede leer la columna;
--      * `set search_path = pg_catalog` y referencias cualificadas, para que un
--        `search_path` manipulado por quien llama no redirija `habitaciones`;
--      * el predicado es EL MISMO de las otras dos, literal:
--            es_maestro() or el anfitrion dueno de la pension
--        No se añade ni se quita nada: quien puede marcar es quien puede leer
--        que esta marcado, y nadie mas.
--
--    Devuelve cero filas, no un error, cuando quien llama no tiene derecho a
--    ver ninguna. Un estudiante con cuenta que abra el panel no debe recibir un
--    42501: debe recibir nada. El 42501 se reserva para quien no puede ni
--    ejecutar la funcion.
--
--    `stable` y no `volatile`: solo lee. Permite a PostgREST tratarla como
--    consulta y al planificador no repetirla dentro de una misma sentencia.
-- ---------------------------------------------------------------------------

create or replace function public.listar_reservas()
returns table (
  habitacion_id uuid,
  reservada_en  timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  return query
    select h.id            as habitacion_id,
           h.reservada_en  as reservada_en
      from public.habitaciones as h
      join public.pensiones    as p on p.id = h.pension_id
     where h.reservada_en is not null
       and (public.es_maestro() or p.anfitrion_id = (select auth.uid()))
     order by h.reservada_en desc, h.id;
end;
$$;

comment on function public.listar_reservas() is
  'Devuelve las reservas visibles para quien llama: todas si es maestro, solo las de sus pensiones si es anfitrion dueno, ninguna en cualquier otro caso. Existe porque reservada_en no es legible desde el cliente (oleada 17): la fecha de una reserva se lee por aqui y por ningun otro sitio. No devuelve reservada_por ni disponible_antes_de_reservar a proposito.';


-- ---------------------------------------------------------------------------
-- 2) Privilegios — reemitidos completos, en el mismo orden que la oleada 17
--
--    `public` trae EXECUTE por defecto en Postgres para toda funcion nueva. Hay
--    que revocarlo de los tres, y solo despues conceder a `authenticated`.
--    `anon` se queda fuera: sin sesion no hay panel que pintar y no hay motivo
--    para que la funcion sea alcanzable.
--
--    Que `authenticated` pueda ejecutarla NO significa que vea algo: para quien
--    no sea maestro ni anfitrion dueno, la funcion devuelve cero filas.
-- ---------------------------------------------------------------------------

revoke all on function public.listar_reservas() from public;
revoke all on function public.listar_reservas() from anon;
revoke all on function public.listar_reservas() from authenticated;

grant execute on function public.listar_reservas() to authenticated;


-- ---------------------------------------------------------------------------
-- 3) Verificacion posterior — ninguna de estas consultas escribe nada
--    (salvo V.4, que va en un bloque que se revierte por excepcion)
--
--    **La migracion no esta terminada hasta que V.2, V.3, V.4 y V.5 cuadran.**
-- ---------------------------------------------------------------------------

-- V.1 · La funcion existe, con la firma y las propiedades declaradas.
select p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as argumentos,
       pg_catalog.pg_get_function_result(p.oid)             as devuelve,
       p.prosecdef                                          as security_definer,
       p.provolatile                                        as volatilidad,
       p.proconfig                                          as configuracion
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'listar_reservas';
-- Esperado: 1 fila, security_definer = t, volatilidad = s,
--           configuracion = {search_path=pg_catalog}

-- V.2 · Quien puede ejecutarla. `has_function_privilege` es la prueba que
--       distingue «no existe» de «no puedes»; una sonda HTTP no lo distingue,
--       porque PostgREST no expone las funciones que el rol no puede ejecutar.
select
  pg_catalog.has_function_privilege('public',        'public.listar_reservas()', 'EXECUTE') as rol_public,
  pg_catalog.has_function_privilege('anon',          'public.listar_reservas()', 'EXECUTE') as anon,
  pg_catalog.has_function_privilege('authenticated', 'public.listar_reservas()', 'EXECUTE') as authenticated;
-- Esperado: f | f | t

-- V.3 · GUARDA DE REGRESION. Si alguien resolvio el problema concediendo SELECT
--       sobre las columnas, esta consulta lo delata: tiene que seguir en f.
select
  pg_catalog.has_column_privilege('anon',          'public.habitaciones', 'reservada_en',  'SELECT') as anon_reservada_en,
  pg_catalog.has_column_privilege('authenticated', 'public.habitaciones', 'reservada_en',  'SELECT') as auth_reservada_en,
  pg_catalog.has_column_privilege('authenticated', 'public.habitaciones', 'reservada_por', 'SELECT') as auth_reservada_por,
  pg_catalog.has_table_privilege ('anon',          'public.habitaciones', 'SELECT')                  as anon_select_tabla;
-- Esperado: f | f | f | f

-- V.4 · PRUEBA FUNCIONAL. Marca una habitacion, lee la fecha por la funcion con
--       tres identidades distintas y termina en `raise`, asi que revierte todo
--       y no deja ninguna habitacion reservada.
--       Resuelve las cuentas desde los datos en vez de llevarlas escritas: esta
--       migracion no debe adivinar UUIDs.
do $$
declare
  v_id            uuid;
  v_anfitrion     uuid;
  v_maestro       uuid;
  v_fecha         timestamptz;
  v_leida         timestamptz;
  v_filas_maestro integer;
  v_filas_dueno   integer;
  v_filas_otro    integer;
begin
  select u.id into v_maestro
    from public.usuarios as u
   where u.rol = 'maestro'
   order by u.id
   limit 1;

  if v_maestro is null then
    raise exception 'No hay ninguna cuenta con rol maestro: esta prueba no puede correr';
  end if;

  select h.id, p.anfitrion_id into v_id, v_anfitrion
    from public.habitaciones as h
    join public.pensiones    as p on p.id = h.pension_id
   order by h.creada_en
   limit 1;

  -- 1) Como maestro: marca.
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text,
    true
  );
  v_fecha := public.marcar_habitacion_reservada(v_id);

  select count(*) into v_filas_maestro from public.listar_reservas();
  select r.reservada_en into v_leida
    from public.listar_reservas() as r
   where r.habitacion_id = v_id;

  -- 2) Como anfitrion dueno de la pension: ve la suya.
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.json_build_object('sub', v_anfitrion::text, 'role', 'authenticated')::text,
    true
  );
  select count(*) into v_filas_dueno from public.listar_reservas();

  -- 3) Como una cuenta que no es ninguna de las dos: cero filas, sin error.
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.json_build_object('sub', '00000000-0000-0000-0000-000000000000', 'role', 'authenticated')::text,
    true
  );
  select count(*) into v_filas_otro from public.listar_reservas();

  raise exception 'V4_RESULTADO %', pg_catalog.jsonb_build_object(
    'fecha_marcada',        v_fecha,
    'fecha_leida',          v_leida,
    'fechas_iguales',       (v_fecha is not distinct from v_leida),
    'filas_maestro',        v_filas_maestro,
    'filas_dueno',          v_filas_dueno,
    'filas_otra_cuenta',    v_filas_otro
  )::text;
end
$$;
-- Esperado: 1 fila por reserva en `filas_maestro` y en `filas_dueno`,
--           fechas_iguales = true, y `filas_otra_cuenta` = 0.
--           El propio mensaje de error es el resultado, y deja la base igual.

-- V.5 · Despues de V.4 nadie quedo reservado.
select count(*) as reservadas
  from public.habitaciones as h
 where h.reservada_en is not null;
-- Esperado: 0

-- V.6 · Las tres columnas siguen fuera del alcance del cliente, contadas de una
--       vez. Es la foto que dejo la oleada 17 y tiene que seguir siendo esta.
select a.attname as columna,
       pg_catalog.has_column_privilege('anon',          'public.habitaciones', a.attname, 'SELECT') as anon_lee,
       pg_catalog.has_column_privilege('authenticated', 'public.habitaciones', a.attname, 'SELECT') as auth_lee
  from pg_catalog.pg_attribute as a
 where a.attrelid = 'public.habitaciones'::regclass
   and a.attnum   > 0
   and not a.attisdropped
   and a.attname in ('reservada_en', 'reservada_por', 'disponible_antes_de_reservar')
 order by a.attname;
-- Esperado: 3 filas, anon_lee = f y auth_lee = f en las tres.


-- ---------------------------------------------------------------------------
-- 4) Reversion — se ejecuta entera y deja la base como estaba
--
--    Esta oleada solo añade una funcion. Revertirla no pierde ningun dato: la
--    fecha sigue en la columna, lo que se pierde es la capacidad de LEERLA desde
--    el panel, y el panel volveria a mostrar «Reservada» sin fecha al recargar.
--
--    Probarse en seco es obligatorio y es facil: crear la funcion y borrarla
--    dentro de la misma transaccion deja la base exactamente igual.
--
--      begin;
--        -- bloque 0, bloque 1, bloque 2 enteros
--        drop function if exists public.listar_reservas();
--        -- V.1 debe devolver 0 filas
--      commit;
-- ---------------------------------------------------------------------------

-- drop function if exists public.listar_reservas();
