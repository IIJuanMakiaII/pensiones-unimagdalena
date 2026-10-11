-- ============================================================================
-- Oleada 11 — Cierre de seguridad e integridad antes de aceptar reservas
--
--   Archivo ÚNICO de aplicación. Idempotente: se puede ejecutar dos veces sin
--   efectos distintos. No borra datos de negocio.
--
--   Vía de aplicación (la decide el fundador, no este archivo):
--     https://supabase.com/dashboard/project/ayznnqkacpdvvufclhon/sql
--
-- POR QUÉ NO SE APLICA `oleada-2.sql` TAL CUAL
--   La tarea pedía «aplicar supabase/oleada-2.sql». Auditado el repositorio,
--   eso habría sido una REGRESIÓN. Su sección 1 (:77-81) recorta los
--   privilegios de escritura a lo que el panel necesitaba cuando se escribió:
--
--     oleada-2.sql:78  grant update (activa)                  on public.pensiones
--     oleada-2.sql:81  grant update (disponible)              on public.habitaciones
--
--   Pero oleadas posteriores ampliaron esa lista para habilitar el editor de
--   publicaciones (tareas #18/#19) y el editor de habitaciones:
--
--     oleada-3.sql:105-113   habitaciones -> disponible, tipo, genero,
--                                            precio_mensual_cop, alimentacion_incluida
--     oleada-6.sql:87-89     pensiones    -> lista completa del editor
--     oleada-10:151-163      pensiones    -> esa misma lista, menos `whatsapp`
--                                            y `autorizacion_contacto_en`
--
--   Y `crear_pension_con_habitaciones` sólo se define en oleada-1 y oleada-2:
--   ninguna oleada posterior la reescribe. Es decir: lo pendiente es la versión
--   ENDURECIDA de la función (oleada-2 §2, §3 y §4), no sus privilegios.
--
--   Aplicar oleada-2 §1 al final de la serie dejaría a `authenticated` con
--   UPDATE sobre `pensiones` únicamente en `activa`, y el editor de
--   publicaciones fallaría con `42501 permission denied for column titulo`.
--   Por eso este archivo:
--     · aplica oleada-2 DESDE SU SECCIÓN 2 (precio derivado, restricciones, RPC)
--     · y en lugar de su sección 1 REAFIRMA los privilegios vigentes,
--       que son los de oleada-10 (pensiones) y oleada-3 (habitaciones).
--   La sección 1 de oleada-2 queda así sustituida, no omitida: el estado final
--   es el que exige el producto hoy, con A-1 y A-2 cerrados.
--
-- QUÉ DEJA HECHO
--   A. `qa_oleada9`: guarda defensiva (RLS + borrado condicionado a su forma).
--   B. Privilegios de escritura al día (A-1 y A-2 cerrados, editores intactos).
--   C. Oleada 2 §2/§3/§4: precio derivado, restricciones y RPC endurecida.
--   D. Consultas de verificación, con el resultado esperado de cada una.
--
-- LO QUE ESTE ARCHIVO NO HACE
--   · No corrige el `else 10` de la RPC (ver DECISIÓN ABIERTA al final de C).
--   · No toca la fila publicada `residencia-makia` (barrio «Otro», 10 min).
--   · No crea ni borra pensiones ni habitaciones.
-- ============================================================================


-- ============================================================================
-- A) qa_oleada9 — guarda defensiva
--
--   MEDIDO el 2026-10-09 con la clave anónima contra el proyecto real:
--     GET /rest/v1/qa_oleada9  ->  HTTP 404
--     {"code":"PGRST205","message":"Could not find the table 'public.qa_oleada9'
--       in the schema cache"}
--   PostgREST expone TODAS las tablas de `public`: una tabla persistente sin
--   RLS devolvería 200 con 0 filas, no 404. El 404 prueba que NO EXISTE.
--
--   Y no puede existir: se declara TEMPORARY en el propio arnés de pruebas —
--     supabase/pruebas/oleada-9.sql:15
--       create temporary table if not exists qa_oleada9 (paso text, ok boolean, detalle text);
--   Las tablas TEMPORARY viven en `pg_temp` y mueren con la sesión del editor
--   SQL. Todos los `qa_*` del repositorio se declaran igual (oleada-1, 2, 3, 4,
--   5, 6, 7, 9 y oleada-3-verificacion-qa). La única tabla persistente que crea
--   esa carpeta es `public.slugs_reservados` (oleada-7.sql:75), y es intencional.
--
--   El aviso «creas qa_oleada9 sin RLS» del panel es del linter, que no
--   distingue TEMPORARY: avisa en el momento de ejecutar aunque no quede nada.
--
--   Entonces, ¿por qué esta sección? Porque la instrucción es cerrar el riesgo,
--   y el riesgo real es que ALGUNA VEZ exista una `public.qa_oleada9`
--   persistente —alguien que copie el arnés sin el `temporary`— y quede
--   alcanzable con la clave anónima. La guarda es idempotente y hoy es un no-op
--   (no existe nada que limpiar). Orden: primero se cierra el acceso, después se
--   decide si se borra.
-- ============================================================================
do $qa_oleada9$
declare
  v_existe boolean;
  v_forma  integer;
  v_filas  bigint;
begin
  v_existe := to_regclass('public.qa_oleada9') is not null;

  if not v_existe then
    raise notice 'qa_oleada9: no existe como tabla persistente en public. Nada que limpiar.';
    return;
  end if;

  -- 1) Cerrar el acceso sin discutir nada: si la tabla existe y está alcanzable
  --    con la clave anónima, cada segundo cuenta.
  execute 'alter table public.qa_oleada9 enable row level security';
  raise notice 'qa_oleada9: existía. RLS activada.';

  -- 2) Solo se borra si su forma es la de la tabla de pruebas del repositorio
  --    (`paso`, `ok`, `detalle`). Una tabla con otra forma NO es residuo de
  --    esos arneses, así que no se toca: se deja con RLS y se avisa.
  select count(*) into v_forma
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'qa_oleada9'
    and column_name in ('paso', 'ok', 'detalle');

  if v_forma < 3 then
    raise warning 'qa_oleada9: su forma NO es la de la tabla de pruebas. NO se borra; queda solo con RLS activada. Revísala a mano antes de decidir.';
    return;
  end if;

  execute 'select count(*) from public.qa_oleada9' into v_filas;
  raise notice 'qa_oleada9: residuo de prueba con % fila(s). Se elimina (es una tabla de resultados de QA, sin datos de negocio).', v_filas;
  execute 'drop table public.qa_oleada9';
  raise notice 'qa_oleada9: eliminada.';
end
$qa_oleada9$;


-- ============================================================================
-- B) Privilegios de escritura al día  (sustituye a oleada-2.sql:77-91)
--
--   Se reemiten las listas VIGENTES en lugar de las de la oleada 2. Si se
--   aplicaran las de la oleada 2, el editor de publicaciones y el de
--   habitaciones fallarían con `42501 permission denied for column`.
--
--   Lo que NUNCA se concede, y es el motivo de A-1 y A-2:
--     verificado, calificacion, precio_mensual, anfitrion_id, id, creada_en,
--     latitud, longitud, slug   ->  todos en `pensiones`
--     pension_id                ->  en `habitaciones` (mover una habitación de
--                                   anuncio sigue prohibido)
--   `precio_mensual_cop` de `habitaciones` SÍ se concede: el editor de
--   habitaciones lo necesita, y quien lo impone en la tarjeta es la función de
--   precio derivado de la sección C, no el privilegio.
-- ============================================================================

-- B.1 pensiones — lista de oleada-10:151-163
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

-- B.2 habitaciones — lista de oleada-3:105-113
revoke update on public.habitaciones from anon, authenticated;
grant update (
  disponible,                -- marcar ocupada / libre (panel de disponibilidad)
  tipo,
  genero,
  precio_mensual_cop,
  alimentacion_incluida
) on public.habitaciones to authenticated;

-- B.3 usuarios — lista de oleada-2:90-91, que ninguna oleada posterior cambió.
--     `rol` era auto-modificable; hoy es inerte porque ninguna política lo
--     consulta, pero sería una escalada de privilegios en cuanto alguna lo hiciera.
revoke update on public.usuarios from anon, authenticated;
grant update (nombre, email) on public.usuarios to authenticated;


-- ============================================================================
-- C) Oleada 2, desde su sección 2 — contenido íntegro de supabase/oleada-2.sql
--    a partir de la línea 94 (precio derivado, restricciones y RPC endurecida).
--    Se reproduce verbatim para que este archivo sea autosuficiente en el editor
--    SQL, que no admite inclusión de archivos. La fuente canónica sigue siendo
--    supabase/oleada-2.sql; si se edita allí, hay que rehacer esta copia.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2) A-1 / A-2 · El precio lo impone la base, nunca la petición
--
--    `precio_mensual` pasa a ser un valor DERIVADO de las habitaciones:
--      · mínimo de las habitaciones DISPONIBLES (la regla de negocio actual);
--      · si ninguna está disponible pero existen, el mínimo de todas (así el
--        valor sigue siendo significativo y no queda en 0);
--      · si la pensión no tiene habitaciones, en un INSERT queda en 0 y en un
--        UPDATE se conserva el valor ya guardado (no se destruye el dato de
--        una publicación heredada).
--
--    En un INSERT dentro de la RPC todavía no hay habitaciones, así que el
--    precio queda en 0 y el trigger `al_cambiar_habitacion` lo corrige acto
--    seguido al insertarlas. Por eso esta función y aquella se complementan.
--
--    SECURITY DEFINER + search_path fijo: la lectura de `habitaciones` no debe
--    depender de la RLS del llamante (si no, un anfitrión con la publicación
--    retirada podría no ver sus habitaciones y el precio quedaría sin
--    recalcular). La ejecución se revoca abajo para que no sea invocable por RPC.
-- ---------------------------------------------------------------------------

create or replace function public.imponer_precio_pension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_disponible integer;
  v_todas integer;
  v_derivado integer;
begin
  select min(precio_mensual_cop) filter (where disponible),
         min(precio_mensual_cop)
    into v_disponible, v_todas
    from public.habitaciones
   where pension_id = new.id;

  v_derivado := coalesce(v_disponible, v_todas);

  if tg_op = 'INSERT' then
    -- Ningún valor que venga en la petición es admisible: en este instante aún
    -- no hay habitaciones de las que derivarlo.
    new.precio_mensual := coalesce(v_derivado, 0);
  elsif v_derivado is not null then
    new.precio_mensual := v_derivado;
  end if;

  return new;
end;
$$;

drop trigger if exists antes_de_escribir_pension on public.pensiones;
create trigger antes_de_escribir_pension
  before insert or update on public.pensiones
  for each row execute function public.imponer_precio_pension();

revoke execute on function public.imponer_precio_pension() from public;
revoke execute on function public.imponer_precio_pension() from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3) A-6 · Lo que el formulario prohíbe, la base también
--
--    Los límites salen de app/actions/pensiones.ts para que interfaz y base no
--    discrepen: MAX_SERVICIOS = 12, MAX_NORMAS = 8, PRECIO_MIN = 1000,
--    PRECIO_MAX = 20000000.
--
--    Antes de añadirlos se comprobó que ninguna fila existente los incumple
--    (0 violaciones en las cuatro consultas). Es idempotente: se pueden
--    reejecutar sin efecto.
-- ---------------------------------------------------------------------------

alter table public.pensiones drop constraint if exists pensiones_servicios_limite;
alter table public.pensiones
  add constraint pensiones_servicios_limite
  check (servicios is null or array_length(servicios, 1) is null or array_length(servicios, 1) <= 12);

alter table public.pensiones drop constraint if exists pensiones_normas_limite;
alter table public.pensiones
  add constraint pensiones_normas_limite
  check (normas is null or array_length(normas, 1) is null or array_length(normas, 1) <= 8);

-- Coordenadas: en pareja y en rango válido. La ficha las publica en el `geo`
-- de los datos estructurados, así que un par imposible viaja a Google y al mapa.
alter table public.pensiones drop constraint if exists pensiones_coordenadas_rango;
alter table public.pensiones
  add constraint pensiones_coordenadas_rango
  check (
    (latitud is null and longitud is null)
    or (latitud between -90 and 90 and longitud between -180 and 180)
  );

-- Precio de habitación: el formulario exige un mínimo de 1000 COP; la base
-- solo pedía `>= 0`, así que una petición directa podía publicar a 0 (el precio
-- del anuncio pasaba a 0 y el CTA de reserva seguía ofreciéndose).
alter table public.habitaciones drop constraint if exists habitaciones_precio_mensual_cop_check;
alter table public.habitaciones drop constraint if exists habitaciones_precio_rango;
alter table public.habitaciones
  add constraint habitaciones_precio_rango
  check (precio_mensual_cop between 1000 and 20000000);


-- ---------------------------------------------------------------------------
-- 4) A-2 / A-6 · RPC transaccional endurecida
--
--    Cambios respecto a oleada-1.sql:
--      · `precio_mensual` ya NO se lee de `p_pension`: se inserta 0 y lo
--        deriva el trigger de la sección 2. Cualquier valor del cliente se
--        ignora por diseño, no por validación.
--      · Se elimina el `update ... set precio_mensual` del final: era
--        redundante con el trigger y, además, `authenticated` ya no tiene
--        privilegio para escribir esa columna (fallaría con 42501).
--      · Se añaden validaciones de forma (A-6) con mensajes en español, para
--        que el anfitrión reciba un aviso claro en lugar del error crudo de una
--        restricción. Las restricciones de la sección 3 siguen siendo la
--        barrera real.
--      · Los casts se protegen con comprobaciones previas de formato: un texto
--        no numérico ya no produce un error de tipo (22P02) sin contexto.
--
--    Sigue siendo SECURITY INVOKER: la RLS continúa aplicando dentro.
-- ---------------------------------------------------------------------------

create or replace function public.crear_pension_con_habitaciones(
  p_pension jsonb,
  p_habitaciones jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_pension_id uuid;
  v_cantidad integer;
  v_lat text;
  v_lon text;
begin
  if v_usuario is null then
    raise exception 'Sesión requerida para publicar';
  end if;

  -- Validaciones de negocio (además de las restricciones de la tabla).
  if coalesce(trim(p_pension->>'titulo'), '') = '' then
    raise exception 'El título es obligatorio';
  end if;

  -- A-6 · Forma de los arrays: deben ser listas, no texto ni números.
  if jsonb_typeof(coalesce(p_pension->'servicios', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_pension->'normas', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_pension->'imagenes', '[]'::jsonb)) <> 'array' then
    raise exception 'Los servicios, las normas y las fotos deben enviarse como listas';
  end if;

  if jsonb_array_length(coalesce(p_pension->'servicios', '[]'::jsonb)) > 12 then
    raise exception 'Demasiados servicios en una publicación (máximo 12)';
  end if;
  if jsonb_array_length(coalesce(p_pension->'normas', '[]'::jsonb)) > 8 then
    raise exception 'Demasiadas normas en una publicación (máximo 8)';
  end if;
  if jsonb_array_length(coalesce(p_pension->'imagenes', '[]'::jsonb)) > 8 then
    raise exception 'Demasiadas fotos en una publicación (máximo 8)';
  end if;

  -- A-6 · Coordenadas: si vienen, en pareja y dentro del rango válido.
  v_lat := nullif(trim(coalesce(p_pension->>'latitud', '')), '');
  v_lon := nullif(trim(coalesce(p_pension->>'longitud', '')), '');

  if v_lat is not null and v_lat !~ '^-?[0-9]{1,3}(\.[0-9]+)?$' then
    raise exception 'La latitud no es un número válido';
  end if;
  if v_lon is not null and v_lon !~ '^-?[0-9]{1,3}(\.[0-9]+)?$' then
    raise exception 'La longitud no es un número válido';
  end if;
  if (v_lat is null) <> (v_lon is null) then
    raise exception 'Indica la latitud y la longitud juntas, o ninguna de las dos';
  end if;
  if v_lat is not null
     and (v_lat::double precision not between -90 and 90
          or v_lon::double precision not between -180 and 180) then
    raise exception 'Las coordenadas están fuera del rango válido';
  end if;

  -- Habitaciones
  if jsonb_typeof(coalesce(p_habitaciones, '[]'::jsonb)) <> 'array' then
    raise exception 'Las habitaciones deben enviarse como una lista';
  end if;

  v_cantidad := coalesce(jsonb_array_length(p_habitaciones), 0);
  if v_cantidad = 0 then
    raise exception 'Publica al menos una habitación: los estudiantes filtran por tipo, género y alimentación';
  end if;
  if v_cantidad > 20 then
    raise exception 'Demasiadas habitaciones en una publicación (máximo 20)';
  end if;

  -- A-6 · Precio: primero el formato (para no castear texto arbitrario),
  -- después el rango. El deslizador del formulario exige un mínimo de 1000 COP.
  if exists (
    select 1 from jsonb_array_elements(p_habitaciones) as h
     where nullif(trim(coalesce(h->>'precio_mensual_cop', '')), '') is null
        or (h->>'precio_mensual_cop') !~ '^[0-9]{1,8}$'
  ) then
    raise exception 'Cada habitación necesita un precio mensual en pesos, sin puntos ni comas';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_habitaciones) as h
     where (h->>'precio_mensual_cop')::integer not between 1000 and 20000000
  ) then
    raise exception 'El precio de cada habitación debe estar entre 1000 y 20000000 COP';
  end if;

  -- A-6 · Uniones cerradas de tipo y género (mismas que las CHECK de la tabla).
  if exists (
    select 1 from jsonb_array_elements(p_habitaciones) as h
     where coalesce(h->>'tipo', 'individual') not in ('individual', 'compartida', 'matrimonial')
  ) then
    raise exception 'Hay una habitación con un tipo no válido';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_habitaciones) as h
     where coalesce(h->>'genero', 'mixto') not in ('mixto', 'femenino', 'masculino')
  ) then
    raise exception 'Hay una habitación con un género no válido';
  end if;

  insert into public.pensiones (
    anfitrion_id, titulo, descripcion, precio_mensual, direccion, barrio,
    distancia_a_pie_minutos, servicios, normas, imagenes, activa,
    latitud, longitud
  )
  values (
    v_usuario,
    trim(p_pension->>'titulo'),
    coalesce(p_pension->>'descripcion', ''),
    -- A-2 · El precio NO viene de la petición: lo impone el trigger
    -- `antes_de_escribir_pension` y, acto seguido, `al_cambiar_habitacion`.
    0,
    coalesce(p_pension->>'direccion', ''),
    coalesce(p_pension->>'barrio', ''),
    case
      when coalesce(p_pension->>'distancia_a_pie_minutos', '') ~ '^[0-9]{1,3}$'
        then least(120, (p_pension->>'distancia_a_pie_minutos')::smallint)
      else 10
    end,
    coalesce(
      (select array_agg(valor) from jsonb_array_elements_text(p_pension->'servicios') as valor),
      '{}'::text[]
    ),
    coalesce(
      (select array_agg(valor) from jsonb_array_elements_text(p_pension->'normas') as valor),
      '{}'::text[]
    ),
    coalesce(
      (select array_agg(valor) from jsonb_array_elements_text(p_pension->'imagenes') as valor),
      '{}'::text[]
    ),
    case when p_pension->>'activa' = 'false' then false else true end,
    v_lat::double precision,
    v_lon::double precision
  )
  returning id into v_pension_id;

  insert into public.habitaciones (
    pension_id, tipo, genero, precio_mensual_cop, alimentacion_incluida, disponible
  )
  select
    v_pension_id,
    coalesce(h->>'tipo', 'individual'),
    coalesce(h->>'genero', 'mixto'),
    (h->>'precio_mensual_cop')::integer,
    coalesce((h->>'alimentacion_incluida')::boolean, false),
    coalesce((h->>'disponible')::boolean, true)
  from jsonb_array_elements(p_habitaciones) as h;

  -- El precio ya quedó fijado por el trigger `al_cambiar_habitacion` al insertar
  -- las habitaciones. No se repite aquí a propósito: `authenticated` ya no tiene
  -- privilegio de escritura sobre `precio_mensual` y ese UPDATE fallaría.

  return v_pension_id;
end;
$$;

revoke execute on function public.crear_pension_con_habitaciones(jsonb, jsonb) from public;
revoke execute on function public.crear_pension_con_habitaciones(jsonb, jsonb) from anon;
grant execute on function public.crear_pension_con_habitaciones(jsonb, jsonb) to authenticated;


-- ============================================================================
-- Verificación rápida tras aplicar (sin escribir nada):
--
--   -- 1. El anfitrión ya no puede escribir las columnas sensibles:
--   select has_column_privilege('authenticated','public.pensiones','verificado','UPDATE')  as verificado,
--          has_column_privilege('authenticated','public.pensiones','calificacion','UPDATE') as calificacion,
--          has_column_privilege('authenticated','public.pensiones','precio_mensual','UPDATE') as precio,
--          has_column_privilege('authenticated','public.pensiones','activa','UPDATE')       as activa;
--   -- esperado: f | f | f | t
--
--   -- 2. El disparador existe:
--   select tgname from pg_trigger where tgrelid = 'public.pensiones'::regclass and not tgisinternal;
--   -- esperado: antes_de_escribir_pension
--
--   -- 3. Las restricciones nuevas:
--   select conname from pg_constraint
--    where conrelid in ('public.pensiones'::regclass, 'public.habitaciones'::regclass)
--      and conname in ('pensiones_servicios_limite','pensiones_normas_limite',
--                      'pensiones_coordenadas_rango','habitaciones_precio_rango');
--   -- esperado: las cuatro
--
-- Pruebas de aceptación completas (se revierten solas):
--   supabase/pruebas/oleada-2.sql
--
-- Reversión:
--   drop trigger if exists antes_de_escribir_pension on public.pensiones;
--   drop function if exists public.imponer_precio_pension();
--   grant update on public.pensiones to anon, authenticated;      -- NO recomendado
--   alter table public.pensiones drop constraint if exists pensiones_servicios_limite;
--   ... (restaurar la RPC anterior desde oleada-1.sql)
-- ============================================================================


-- ============================================================================
-- D) Verificación posterior — ninguna de estas consultas escribe nada.
--
--   Las siete primeras se ejecutan tal cual. La última (D.7) reproduce, desde
--   DENTRO de la base, lo que `scripts/verificar-supabase.mjs` mide desde fuera
--   con la clave anónima.
-- ============================================================================

-- D.1 ¿Queda alguna tabla `qa_*` persistente en `public`?  -> esperado: 0
select c.relname,
       c.relrowsecurity as rls_activada,
       c.reltuples::bigint as filas_estimadas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'qa\_%';
-- esperado: 0 filas (cualquier fila aquí es un residuo de pruebas que hay que revisar)

-- D.2 A-1 y A-2 cerrados, y el editor de publicaciones intacto.
--     esperado: f | f | f | f | t | t | t
select has_column_privilege('authenticated','public.pensiones','verificado','UPDATE')           as verificado,      -- f
       has_column_privilege('authenticated','public.pensiones','calificacion','UPDATE')         as calificacion,    -- f
       has_column_privilege('authenticated','public.pensiones','precio_mensual','UPDATE')       as precio_mensual,  -- f
       has_column_privilege('authenticated','public.pensiones','anfitrion_id','UPDATE')         as anfitrion_id,    -- f
       has_column_privilege('authenticated','public.pensiones','activa','UPDATE')               as activa,          -- t
       has_column_privilege('authenticated','public.pensiones','titulo','UPDATE')               as titulo,          -- t
       has_column_privilege('authenticated','public.pensiones','barrio','UPDATE')               as barrio;          -- t
-- Si `titulo` o `barrio` salieran f, el archivo se aplicó mal y el editor de
-- publicaciones (tarea #19) está roto. Es la comprobación que faltaba.

-- D.3 Habitaciones: el panel y el editor funcionan, `pension_id` sigue cerrado.
--     esperado: t | t | f
select has_column_privilege('authenticated','public.habitaciones','disponible','UPDATE')          as disponible,          -- t
       has_column_privilege('authenticated','public.habitaciones','precio_mensual_cop','UPDATE') as precio_mensual_cop,  -- t
       has_column_privilege('authenticated','public.habitaciones','pension_id','UPDATE')          as pension_id;          -- f

-- D.4 La función del precio derivado existe, es SECURITY DEFINER y no es
--     invocable por RPC.  -> esperado: 1 fila · t | f | f
select p.proname,
       p.prosecdef                                             as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE')         as anon_ejecuta,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_ejecuta
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'imponer_precio_pension';

-- D.5 El disparador que impone el precio está montado sobre `pensiones`.
--     -> esperado: antes_de_escribir_pension
select tgname
from pg_trigger
where tgrelid = 'public.pensiones'::regclass
  and not tgisinternal;

-- D.6 La RPC es la versión endurecida: SECURITY INVOKER, sólo `authenticated`.
--     -> esperado: f | f | t
select p.prosecdef                                              as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_ejecuta,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_ejecuta
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'crear_pension_con_habitaciones';

-- D.7 Las cuatro restricciones nuevas, con su definición real.
--     -> esperado: 4 filas. `habitaciones_precio_rango` debe decir >= 1000
--        (oleada-1 lo dejaba en >= 0; oleada-2 lo corrige).
select conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid in ('public.pensiones'::regclass, 'public.habitaciones'::regclass)
  and conname in ('pensiones_servicios_limite',
                  'pensiones_normas_limite',
                  'pensiones_coordenadas_rango',
                  'habitaciones_precio_rango')
order by conname;

-- D.8 El catálogo, leído COMO EL VISITANTE ANÓNIMO (mide RLS, no datos).
--     `set role` cambia el rol efectivo de la sesión; `reset role` lo devuelve.
--     Si el editor rechazara `set role`, sirve la forma equivalente
--     `select set_config('role','anon',false);` … `select set_config('role','postgres',false);`
set role anon;
select (select count(*) from public.pensiones)   as pensiones_visibles,
       (select count(*) from public.habitaciones) as habitaciones_visibles,
       (select count(*) from public.usuarios)     as usuarios_visibles;
reset role;
-- MEDIDO el 2026-10-09 con la clave anónima por REST: pensiones 1 · habitaciones 2 · usuarios 0.
-- esperado: pensiones >= 1 · habitaciones >= 1 · usuarios = 0
--   pensiones y habitaciones > 0  -> el catálogo NO está vacío por RLS ni por falta de datos
--   usuarios = 0                  -> las políticas de perfiles siguen cerradas
-- Si `usuarios` saliera > 0, hay una fuga y hay que parar.

-- D.9 Prueba de aceptación funcional de A-2, la que sí escribe (y se limpia sola):
--       supabase/pruebas/oleada-2.sql
--     14 comprobaciones: precio derivado, sello y calificación no escribibles,
--     panel intacto, y los rechazos de forma y precio. Crea dos publicaciones de
--     prueba retiradas (`activa = false`, nunca visibles en el catálogo) y las
--     borra al final. OJO: es el único de estos pasos que ESCRIBE en la base real.

-- ============================================================================
-- DECISIÓN ABIERTA (no la resuelve este archivo)
--
--   La RPC endurecida sigue FABRICANDO la distancia a pie cuando el campo falta
--   o no es un número:
--
--     supabase/oleada-2.sql:337-341
--       case
--         when coalesce(p_pension->>'distancia_a_pie_minutos', '') ~ '^[0-9]{1,3}$'
--           then least(120, (p_pension->>'distancia_a_pie_minutos')::smallint)
--         else 10
--       end,
--
--   Y `barrio` cae a cadena vacía (`coalesce(p_pension->>'barrio','')`, :336).
--   Eso es exactamente el origen del dato falso que hoy muestra el anuncio
--   publicado («Otro» y «10 min»), y es la decisión nº 1 que quedó al fundador.
--
--   Matiz importante medido en el repositorio: la aplicación YA no llega ahí.
--   `lib/pension-escritura.ts` valida el campo mirando el texto antes que el
--   número, y `app/actions/pensiones.ts:127` aborta antes de llamar a la RPC.
--   El `else 10` sólo es alcanzable por una llamada DIRECTA a la RPC con la
--   clave anónima-autenticada, es decir por API y no por la interfaz.
--
--   Opción A (la que aplica este archivo): dejar la RPC como está. Cierra el
--   agujero en la capa de aplicación; la base sigue dispuesta a inventar el dato
--   si alguien llama por fuera.
--
--   Opción B: que la base RECHACE en lugar de fabricar. Se añadiría, antes del
--   INSERT de `pensiones` dentro de la RPC, una validación equivalente a:
--
--     if coalesce(p_pension->>'barrio','') = '' then
--       raise exception 'El barrio es obligatorio';
--     end if;
--     if coalesce(p_pension->>'distancia_a_pie_minutos','') !~ '^[0-9]{1,3}$' then
--       raise exception 'La distancia a pie es obligatoria y debe ser un número de minutos';
--     end if;
--
--   y se sustituiría el `else 10` por un rechazo. NO se incluye activo aquí
--   porque cambia el contrato de la RPC para todos los llamantes y es una
--   decisión de producto, no de integridad. Queda escrita para que se decida.
-- ============================================================================

