-- ============================================================================
-- Oleada 2 — Cerrar la superficie de escritura
-- Ejecutar después de esquema.sql, storage-fotos.sql y oleada-1.sql. Es idempotente.
--
-- Qué resuelve (hallazgos A-1, A-2 y A-6 de
-- docs/auditorias/seguridad-panel-disponibilidad.md)
--
--  1. A-1 · El anfitrión podía AUTOTORGARSE el sello `verificado` y la
--     calificación 5.0. La política RLS resuelve *qué filas* puede tocar, no
--     *qué columnas*: `has_column_privilege` daba `true` para todas y no había
--     ningún trigger sobre `pensiones`. Medido con la sesión del propio
--     anfitrión antes de esta migración:
--       update pensiones set verificado = true, calificacion = 5.0 → 1 fila.
--     Eso es lo que veían padres y estudiantes al decidir, escrito por quien
--     recibe el sello.
--
--  2. A-2 · El precio publicado era manipulable: la RPC lo tomaba del cliente
--     (`coalesce((p_pension->>'precio_mensual')::integer, 0)`) y, si la
--     habitación enviada ya estaba ocupada, no había recálculo que lo pisara.
--     Medido antes: RPC con `precio_mensual: 1234` → precio guardado 1234.
--
--  3. A-6 · La RPC aceptaba lo que el formulario prohíbe (habitación a 0,
--     arrays sin límite, coordenadas fuera de rango). El formulario no es una
--     frontera de seguridad: la base sí.
--
-- Decisión de diseño (y por qué se eligen LAS DOS correcciones del informe)
--
--   El informe proponía elegir entre (a) revocar el privilegio de
--   `precio_mensual` —con la precaución de quitar el `update` de la RPC, que es
--   SECURITY INVOKER y fallaría con "permission denied for column"— o (b) no
--   revocarlo y añadir un trigger que imponga el valor calculado.
--
--   Aquí se aplican las dos, porque cubren fallos distintos:
--     · el privilegio de columna es una barrera DECLARATIVA: la base rechaza la
--       escritura antes de evaluar RLS (error 42501). Cubre el ataque directo.
--     · el trigger `imponer_precio_pension` cubre el caso de que alguien vuelva
--       a conceder el privilegio, o de que una función con privilegios
--       elevados (SECURITY DEFINER) escriba la columna en el futuro. Sin él,
--       la corrección dependería de que nadie olvide un GRANT.
--
--   Y por eso la RPC de la sección 4 deja de leer `precio_mensual` del cliente
--   y deja de hacer su propio `UPDATE` sobre esa columna: el precio lo deriva
--   siempre la base a partir de las habitaciones.
--
-- Qué NO cambia
--   · El contrato de tipos: `Pension.precioMensual`, `verificado` y
--     `calificacion` siguen leyéndose igual (la lectura pública no se toca).
--   · El panel del anfitrión: sigue escribiendo exactamente `pensiones.activa`
--     y `habitaciones.disponible`, que son las únicas columnas que necesita.
--   · `sincronizar_precio_pension` (el trigger de `habitaciones`) se mantiene
--     como está: solo recalcula el precio si queda alguna habitación libre.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) A-1 · Privilegios de columna
--
--    Se revoca el UPDATE a nivel de TABLA y se vuelve a conceder únicamente la
--    columna que la interfaz escribe de verdad.
--
--    Por qué así y no `revoke update (columna)`: en PostgreSQL, revocar una
--    columna no retira el privilegio de tabla, así que un `grant all on tables
--    to authenticated` (el valor por defecto de Supabase) seguiría concediendo
--    la escritura de todas las columnas. Revocar la tabla y reconceder la
--    columna es explícito y no deja lugar a interpretación.
--
--    PARA EL FUTURO: cuando se implemente «editar una publicación ya
--    publicada» (M-15 del informe maestro) habrá que añadir aquí las columnas
--    que ese editor necesite, p. ej.
--      grant update (titulo, descripcion, direccion, barrio,
--                    distancia_a_pie_minutos, servicios, normas, imagenes)
--        on public.pensiones to authenticated;
--    Lo que NO debe concederse nunca a `authenticated` es `verificado`,
--    `calificacion` ni `precio_mensual`.
-- ---------------------------------------------------------------------------

revoke update on public.pensiones from anon, authenticated;
grant update (activa) on public.pensiones to authenticated;

revoke update on public.habitaciones from anon, authenticated;
grant update (disponible) on public.habitaciones to authenticated;

-- `usuarios` no lo escribe la aplicación (el perfil lo crea el trigger
-- `al_crear_usuario`, que es SECURITY DEFINER). Se protegen los campos de
-- identidad y de privilegio; `nombre` y `email` quedan libres por si más
-- adelante se añade un editor de perfil.
-- Sin esto, `rol` era auto-modificable: hoy es inerte porque ninguna política
-- lo consulta, pero sería una escalada de privilegios en cuanto alguna lo
-- hiciera.
revoke update on public.usuarios from anon, authenticated;
grant update (nombre, email) on public.usuarios to authenticated;


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
