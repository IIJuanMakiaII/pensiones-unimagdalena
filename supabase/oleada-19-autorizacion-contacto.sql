-- ============================================================================
-- Oleada 19 — La autorización del formulario de contacto, guardada con su fecha
-- Proyecto: Nido · Supabase/Postgres · tarea #7
--
-- ⚠ ORDEN DE DESPLIEGUE — leer antes de pegar
--
--   1. Se aplica ESTA migración primero, sola, en el editor SQL.
--   2. NO hay que comprobar nada a mano para estar a salvo: la guarda del §5 se
--      ejecuta sola, dentro de la misma transacción, y **aborta el commit** si
--      la llamada de cuatro argumentos —la que hace hoy el formulario en
--      producción— dejó de guardar. Si el editor responde «GUARDA 19 (…): …»,
--      no se aplicó nada y la base sigue como estaba.
--   3. Si el commit salió bien, se ejecuta el bloque de verificación E y se
--      guarda su salida en `docs/`. E.2 y E.3 son las que deciden.
--   4. Solo entonces el Ingeniero integra la tarea #8, que manda el quinto
--      argumento. El código nuevo contra esta migración responde 400; el código
--      viejo contra ella sigue funcionando igual.
--
--   La pregunta que esta oleada tenía que responder —«tras aplicar la 19, ¿el
--   formulario de respaldo que está en producción sigue guardando?»— la
--   responde el §5 con una llamada real, no con un razonamiento. Si la guarda
--   pasa, la respuesta es sí, y está medida.
--
-- POR QUE EXISTE ESTA OLEADA
--
--   El formulario de /contacto pide una casilla de autorización y
--   `app/actions/contacto.ts` bloquea el envío si no viene marcada. La casilla,
--   por tanto, YA se comprueba. Lo que no ocurre es que quede constancia:
--   `registrar_contacto_respaldo` acepta cuatro parámetros y la tabla no tiene
--   ninguna columna de autorización.
--
--   El resultado es una situación difícil de defender ante una reclamación de
--   datos personales (Ley 1581 de 2012): el sistema exige el permiso y luego lo
--   tira. Esta oleada guarda el hecho y su fecha.
--
-- POR QUE SE RETIRA LA FIRMA DE CUATRO ARGUMENTOS
--
--   Un quinto parámetro con valor por defecto mantiene funcionando la LLAMADA
--   de cuatro argumentos, pero **no** mantiene funcionando la FUNCIÓN de cuatro
--   argumentos: en PostgreSQL, `create or replace` con una firma distinta crea
--   una sobrecarga nueva, no reemplaza. Con dos funciones del mismo nombre
--   PostgREST responde `PGRST203` —«Could not choose the best candidate
--   function»— a la llamada de cuatro parámetros con nombre, que es exactamente
--   la que hace el código desplegado hoy.
--
--   Por eso se retira la de cuatro y queda una sola, la de cinco con tres
--   valores por defecto (`p_mensaje`, `p_pension_slug` y `p_autorizacion`). La
--   llamada antigua sigue respondiendo, posicional y por nombre: la guarda del
--   §5 lo comprueba con llamadas reales antes del commit, no por razonamiento.
--
-- QUE NO HACE, A PROPOSITO
--
--   · No rellena `autorizacion_en` en las filas anteriores. No hay forma de
--     saber si aquellas personas marcaron la casilla —el formulario la exigía,
--     pero el dato no se guardó—, así que se deja `NULL` = «sin constancia».
--     Inventar una fecha sería peor que no tenerla.
--   · No añade `NOT NULL`: rompería esa misma lectura retroactiva.
--   · No toca el formulario, ni la acción de servidor, ni el aviso de
--     privacidad, ni los textos legales. Eso es la tarea #8 y el texto ya
--     publicado.
--   · No incluye la versión del aviso aceptado. Sería la siguiente columna
--     útil; hoy no hay versión publicada con número, así que no hay qué
--     guardar todavía. Queda anotado al final.
--
-- Idempotente: se puede pegar dos veces sin efecto añadido.
-- No se ha aplicado: lo aplica quien administra el proyecto.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0) Guardas de dependencia — fallar aquí es mejor que fallar a medias
-- ---------------------------------------------------------------------------

do $$
begin
  if pg_catalog.to_regclass('public.contactos_respaldo') is null then
    raise exception 'Falta public.contactos_respaldo: aplica supabase/oleada-12-contactos-respaldo.sql antes de esta migracion';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) La columna: una fecha, y `NULL` con un significado claro
--
--    `autorizacion_en is not null`  ⇔  consta que la persona marcó la casilla.
--    `autorizacion_en is null`       ⇔  no hay constancia (fila anterior a
--                                        esta oleada, o llamada sin el dato).
--
--    No se usa un booleano: la fecha prueba el hecho Y el momento, y un
--    booleano solo prueba el hecho. Para responder «¿cuándo autorizó?» no
--    habría segunda consulta posible.
-- ---------------------------------------------------------------------------

alter table public.contactos_respaldo
  add column if not exists autorizacion_en timestamptz;

comment on column public.contactos_respaldo.autorizacion_en is
  'Momento en que la persona marco la casilla de autorizacion del formulario de /contacto. NULL = sin constancia (filas anteriores a la oleada 19, o llamadas que no envian el quinto argumento). Lo escribe solo registrar_contacto_respaldo(); el cliente no tiene privilegio de escritura sobre esta columna.';

-- ---------------------------------------------------------------------------
-- 2) Fuera la firma de cuatro argumentos
--
--    Es el paso que evita la ambigüedad de PostgREST descrita en la cabecera.
--    Entre este `drop` y el `create` de abajo no hay ventana visible: las dos
--    sentencias van en la misma transacción y el DDL es transaccional en
--    PostgreSQL.
--
--    Si en el futuro se creara otra sobrecarga, `drop function` con la firma
--    exacta es lo que hay que repetir. Nunca `drop function ... ()` a secas.
-- ---------------------------------------------------------------------------

drop function if exists public.registrar_contacto_respaldo(text, text, text, text);

-- ---------------------------------------------------------------------------
-- 3) La función, con el quinto argumento
--
--    `p_autorizacion` es de tres estados, y cada uno hace algo distinto:
--
--      true   -> se guarda `now()`. La persona autorizó.
--      false  -> se rechaza con 22023. Autorizar es condición para guardar el
--                contacto, igual que en el formulario; que la base lo repita no
--                es redundancia, es que una llamada directa a la RPC no pasa
--                por el formulario.
--      null   -> se guarda `NULL`. Es el caso del código desplegado hoy, que no
--                manda el argumento: se conserva el contacto —que es lo que hay
--                que no perder— y se deja constancia de que no hay constancia.
--
--    El `default null` es lo que hace que la llamada de cuatro argumentos siga
--    respondiendo (E.3).
-- ---------------------------------------------------------------------------

create or replace function public.registrar_contacto_respaldo(
  p_nombre       text,
  p_contacto     text,
  p_mensaje      text    default null,
  p_pension_slug text    default null,
  p_autorizacion boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Misma limpieza que `lib/contacto-respaldo.ts`: colapsar el espacio y
  -- recortar los extremos. Sin esto, un nombre de solo espacios pasaría el
  -- `check` de longitud si la comprobación se hiciera antes de normalizar.
  v_nombre   text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_contacto text := btrim(regexp_replace(coalesce(p_contacto, ''), '\s+', ' ', 'g'));
  v_mensaje  text := nullif(btrim(coalesce(p_mensaje, '')), '');
  v_slug     text := nullif(btrim(coalesce(p_pension_slug, '')), '');
  v_autorizacion timestamptz;
begin
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 80 then
    raise exception 'El nombre debe tener entre 2 y 80 caracteres.'
      using errcode = '22023';
  end if;

  if char_length(v_contacto) < 5 or char_length(v_contacto) > 120 then
    raise exception 'El contacto debe tener entre 5 y 120 caracteres.'
      using errcode = '22023';
  end if;

  if v_mensaje is not null and char_length(v_mensaje) > 1200 then
    raise exception 'El mensaje no puede pasar de 1200 caracteres.'
      using errcode = '22023';
  end if;

  if v_slug is not null and v_slug !~ '^[a-z0-9-]{1,80}$' then
    raise exception 'El identificador del anuncio no tiene un formato válido.'
      using errcode = '22023';
  end if;

  -- Aquí está lo nuevo. `is not true` NO se usa a propósito: `null` tiene un
  -- significado propio y hay que distinguirlo de un «no».
  if p_autorizacion is true then
    v_autorizacion := now();
  elsif p_autorizacion is false then
    raise exception 'Sin autorización no se puede guardar el contacto.'
      using errcode = '22023';
  else
    v_autorizacion := null;
  end if;

  insert into public.contactos_respaldo (
    nombre, contacto, mensaje, pension_slug, autorizacion_en
  )
  values (v_nombre, v_contacto, v_mensaje, v_slug, v_autorizacion);
end;
$$;

comment on function public.registrar_contacto_respaldo(text, text, text, text, boolean) is
  'Guarda un contacto del formulario de respaldo. Valida dentro para que una llamada directa no pueda saltarse las reglas del formulario. p_autorizacion: true sella la fecha, false se rechaza, null no deja constancia (compatibilidad con el codigo anterior a la oleada 19).';

-- ---------------------------------------------------------------------------
-- 4) El permiso · solo la función, nada de la tabla
--
--    Primero quitar todo, después conceder lo justo: `anon` puede llamar a esta
--    función y nada más. Los privilegios de la firma antigua desaparecieron con
--    su `drop`; estos son los de la única que queda.
-- ---------------------------------------------------------------------------
revoke all on function public.registrar_contacto_respaldo(text, text, text, text, boolean) from public;
revoke all on function public.registrar_contacto_respaldo(text, text, text, text, boolean) from anon, authenticated;
grant execute on function public.registrar_contacto_respaldo(text, text, text, text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) GUARDA PRE-COMMIT — la prueba que decide si esto se aplica o no
--
--    Lo anterior ya cambió el catálogo. Si algo salió mal, el formulario de
--    /contacto deja de guardar y nadie se entera hasta que un estudiante
--    escribe. Esta guarda comprueba, ANTES del `commit`, todo lo que puede
--    romperlo. Si algo falla, lanza una excepción, la transacción entera se
--    deshace y la base queda exactamente como estaba: sin columna, con la
--    función de cuatro argumentos y con el formulario funcionando.
--
--    Se comprueba aquí y no después porque después ya no hay vuelta: el commit
--    estaría hecho.
--
--    Lo que se comprueba, y por qué cada cosa:
--
--      (1) En el catálogo: UNA sola función con ese nombre. Dos serían
--          `PGRST203` en cuanto PostgREST recibiera la llamada de cuatro
--          argumentos con nombre. Esta es la comprobación que responde a la
--          pregunta de verdad, porque PostgREST elige por firma.
--      (2) Que esa función siga teniendo cinco argumentos, tres con valor por
--          defecto, los mismos nombres y `security definer`.
--      (3) Que `anon` pueda ejecutarla: sin el `grant`, el formulario
--          respondería 42501 y el contacto se perdería.
--      (4) El comportamiento real: las dos formas de la llamada de CUATRO
--          argumentos —posicional y por nombre— tienen que guardar.
--      (5) Que esas llamadas dejen `autorizacion_en` en NULL, que es lo
--          honesto: no consta autorización.
--      (6) Que la llamada de cinco con `true` selle la fecha y la de `false`
--          sea rechazada.
--      (7) Que no quede ninguna fila de prueba. Si quedara, se aborta: es
--          preferible no aplicar nada a dejar basura en una tabla de datos
--          personales de producción.
--
--    Las filas de prueba se borran al final. Si algo salta antes, el `abort`
--    de la transacción se las lleva igualmente.
-- ---------------------------------------------------------------------------

do $$
declare
  v_n          integer;
  v_args       integer;
  v_defaults   integer;
  v_nombres    text[];
  v_seguro     boolean;
  v_oid        oid;
  v_anon       boolean;
  v_creadas    integer;
  v_con_fecha  integer;
  v_restantes  integer;
  v_fallo      text;
  v_sonda      constant text := 'prueba-oleada-19@ejemplo.invalid';
begin
  -- (1) Una sola función con ese nombre
  select count(*) into v_n
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'registrar_contacto_respaldo';

  if v_n <> 1 then
    raise exception 'GUARDA 19 (1): hay % funciones registrar_contacto_respaldo y tiene que haber exactamente 1. Con dos, PostgREST responde PGRST203 a la llamada de cuatro argumentos y el formulario deja de guardar.', v_n;
  end if;

  -- (2) La forma de la función
  select p.pronargs::integer, p.pronargdefaults::integer, p.proargnames, p.prosecdef, p.oid
    into v_args, v_defaults, v_nombres, v_seguro, v_oid
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'registrar_contacto_respaldo';

  if v_args <> 5 or v_defaults <> 3 then
    raise exception 'GUARDA 19 (2): la función quedó con % argumentos y % con valor por defecto; se esperaban 5 y 3.', v_args, v_defaults;
  end if;

  if not ('p_nombre' = any(v_nombres)
          and 'p_contacto' = any(v_nombres)
          and 'p_mensaje' = any(v_nombres)
          and 'p_pension_slug' = any(v_nombres)
          and 'p_autorizacion' = any(v_nombres)) then
    raise exception 'GUARDA 19 (2): los nombres de argumento no son los esperados (%). El código desplegado llama por nombre y dejaría de resolver.', v_nombres;
  end if;

  if not v_seguro then
    raise exception 'GUARDA 19 (2): la función perdió SECURITY DEFINER.';
  end if;

  -- (3) El permiso
  select pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE') into v_anon;
  if not v_anon then
    raise exception 'GUARDA 19 (3): anon no puede ejecutar la función. El formulario respondería 42501 y el contacto se perdería.';
  end if;

  -- (4) La llamada de cuatro argumentos, POSICIONAL
  v_fallo := null;
  begin
    perform public.registrar_contacto_respaldo(
      'Prueba Oleada 19', v_sonda, 'guarda posicional', 'residencia-makia');
  exception when others then
    v_fallo := sqlerrm;
  end;

  if v_fallo is not null then
    raise exception 'GUARDA 19 (4): la llamada POSICIONAL de cuatro argumentos falló: %', v_fallo;
  end if;

  -- (4) La llamada de cuatro argumentos, POR NOMBRE — es la forma exacta en
  --     que viaja por PostgREST desde `supabase.rpc(nombre, { cuatro claves })`.
  v_fallo := null;
  begin
    perform public.registrar_contacto_respaldo(
      p_nombre       => 'Prueba Oleada 19',
      p_contacto     => v_sonda,
      p_mensaje      => 'guarda por nombre',
      p_pension_slug => 'residencia-makia');
  exception when others then
    v_fallo := sqlerrm;
  end;

  if v_fallo is not null then
    raise exception 'GUARDA 19 (4): la llamada POR NOMBRE de cuatro argumentos falló: %. Es la que hace el formulario en producción.', v_fallo;
  end if;

  -- (5) Guardaron las dos, y ninguna dejó fecha
  select count(*), count(*) filter (where autorizacion_en is not null)
    into v_creadas, v_con_fecha
    from public.contactos_respaldo
   where contacto = v_sonda;

  if v_creadas <> 2 then
    raise exception 'GUARDA 19 (5): las dos llamadas de cuatro argumentos dejaron % filas; se esperaban 2.', v_creadas;
  end if;

  if v_con_fecha <> 0 then
    raise exception 'GUARDA 19 (5): una llamada sin autorización dejó fecha en autorizacion_en. No puede pasar: sería una prueba de consentimiento falsa.';
  end if;

  -- (6) La nueva: con `true` sella, con `false` rechaza
  perform public.registrar_contacto_respaldo(
    'Prueba Oleada 19', v_sonda, null, null, true);

  select count(*) into v_con_fecha
    from public.contactos_respaldo
   where contacto = v_sonda and autorizacion_en is not null;

  if v_con_fecha <> 1 then
    raise exception 'GUARDA 19 (6): la llamada con autorización no selló la fecha.';
  end if;

  v_fallo := null;
  begin
    perform public.registrar_contacto_respaldo(
      'Prueba Oleada 19', v_sonda, null, null, false);
  exception when others then
    v_fallo := sqlerrm;
  end;

  if v_fallo is null then
    raise exception 'GUARDA 19 (6): una llamada con autorización en falso se guardó. Tenía que rechazarse con 22023.';
  end if;

  -- (7) Limpieza y comprobación de que no queda nada
  delete from public.contactos_respaldo where contacto = v_sonda;

  select count(*) into v_restantes
    from public.contactos_respaldo
   where contacto = v_sonda;

  if v_restantes <> 0 then
    raise exception 'GUARDA 19 (7): quedaron % filas de prueba tras la limpieza. Se aborta antes que dejar basura en producción.', v_restantes;
  end if;

  raise notice 'GUARDA 19 superada: una sola función de 5 argumentos (3 con valor por defecto), anon puede ejecutarla, la llamada de CUATRO argumentos guarda en sus dos formas y deja autorizacion_en en NULL.';
end;
$$;

commit;

-- ============================================================================
-- 6) Verificación · ejecutar después y comparar con lo esperado
--
--    La guarda del §5 ya comprobó lo importante antes de confirmar. Esto de
--    aquí es la lectura, para dejar constancia en el registro de aplicación.
-- ============================================================================
--
-- E.1 · La columna existe y admite nulos
--
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name   = 'contactos_respaldo'
--      and column_name  = 'autorizacion_en';
--
--   Esperado: 1 fila · `autorizacion_en` · `timestamp with time zone` · `YES`
--
-- E.2 · Sin sobrecargas: UNA sola función con ese nombre, y de cinco argumentos
--       (si esta consulta devuelve 2, PostgREST responderá PGRST203 y el
--       formulario dejará de guardar nada)
--
--   select p.oid::regprocedure as firma,
--          p.pronargs           as argumentos,
--          p.prosecdef          as security_definer,
--          pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon_puede
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'registrar_contacto_respaldo';
--
--   Esperado: 1 fila · `registrar_contacto_respaldo(text,text,text,text,boolean)`
--             · 5 · t · t
--
-- E.3 · La llamada antigua, la que hace el código desplegado HOY, sigue
--       respondiendo. Dos formas, las dos tienen que pasar:
--
--   -- posicional, cuatro argumentos (equivale a como lo llama supabase-js)
--   select public.registrar_contacto_respaldo(
--     'Prueba Nido', 'prueba@ejemplo.com', 'Comprobación E.3', 'residencia-makia');
--
--   -- por nombre, cuatro argumentos (la forma exacta en que viaja por REST)
--   select public.registrar_contacto_respaldo(
--     p_nombre       => 'Prueba Nido',
--     p_contacto     => 'prueba@ejemplo.com',
--     p_mensaje      => 'Comprobación E.3',
--     p_pension_slug => 'residencia-makia');
--
--   Esperado en las dos: sin error. Sin `22023`, sin `PGRST203`.
--
--   -- Y la fila queda con la columna nueva en NULL, que es lo honesto:
--   select nombre, pension_slug, autorizacion_en
--     from public.contactos_respaldo order by creado_en desc limit 1;
--   Esperado: `autorizacion_en` = (vacío).
--
-- E.4 · La llamada nueva guarda la fecha
--
--   select public.registrar_contacto_respaldo(
--     'Prueba Nido', 'prueba@ejemplo.com', 'Comprobación E.4', 'residencia-makia', true);
--   select autorizacion_en, now() - autorizacion_en as hace
--     from public.contactos_respaldo order by creado_en desc limit 1;
--   Esperado: una fecha de hace menos de un minuto.
--
-- E.5 · Autorizar en falso se rechaza
--
--   select public.registrar_contacto_respaldo(
--     'Prueba Nido', 'prueba@ejemplo.com', null, null, false);
--   Esperado: ERROR 22023 «Sin autorización no se puede guardar el contacto.»
--
-- E.6 · `anon` sigue sin poder leer la tabla (esto es lo que impide que los
--       contactos de los estudiantes queden al aire)
--
--   Con la clave anónima:  GET /rest/v1/contactos_respaldo?select=*
--   Esperado: `401` `42501`. Nunca una fila.
--
--   -- Limpieza de las pruebas E.3 y E.4 (es la única escritura que queda):
--   -- delete from public.contactos_respaldo where contacto = 'prueba@ejemplo.com';
--
-- E.7 · Estado de la constancia en la tabla
--
--   select count(*) as total,
--          count(*) filter (where autorizacion_en is not null) as con_constancia,
--          count(*) filter (where autorizacion_en is null)     as sin_constancia
--     from public.contactos_respaldo;
--
--   Esperado hoy: total 0. Después de desplegar la tarea #8, `sin_constancia`
--   debe dejar de crecer.
--
-- ============================================================================
-- 7) Reversión · solo si hay que deshacer DESPUÉS del commit
-- ============================================================================
--
--   No hace falta si la guarda del §5 abortó: en ese caso la transacción se
--   deshizo entera y no hay nada que revertir. Esto es para el caso contrario:
--   la 19 entró bien y más tarde aparece un motivo para volver atrás.
--
--   ⚠ Antes de ejecutarla, saca las constancias que ya existan. Al quitar la
--   columna se pierden, y son la prueba de autorización de personas reales:
--
--     select id, creado_en, autorizacion_en
--       from public.contactos_respaldo
--      where autorizacion_en is not null;
--
--   Y después:
--
--   begin;
--
--     alter table public.contactos_respaldo
--       drop column if exists autorizacion_en;
--
--     drop function if exists public.registrar_contacto_respaldo(text, text, text, text, boolean);
--
--     create or replace function public.registrar_contacto_respaldo(
--       p_nombre       text,
--       p_contacto     text,
--       p_mensaje      text default null,
--       p_pension_slug text default null
--     )
--     returns void
--     language plpgsql
--     security definer
--     set search_path = public
--     as $reversion$
--     declare
--       v_nombre   text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
--       v_contacto text := btrim(regexp_replace(coalesce(p_contacto, ''), '\s+', ' ', 'g'));
--       v_mensaje  text := nullif(btrim(coalesce(p_mensaje, '')), '');
--       v_slug     text := nullif(btrim(coalesce(p_pension_slug, '')), '');
--     begin
--       if char_length(v_nombre) < 2 or char_length(v_nombre) > 80 then
--         raise exception 'El nombre debe tener entre 2 y 80 caracteres.' using errcode = '22023';
--       end if;
--       if char_length(v_contacto) < 5 or char_length(v_contacto) > 120 then
--         raise exception 'El contacto debe tener entre 5 y 120 caracteres.' using errcode = '22023';
--       end if;
--       if v_mensaje is not null and char_length(v_mensaje) > 1200 then
--         raise exception 'El mensaje no puede pasar de 1200 caracteres.' using errcode = '22023';
--       end if;
--       if v_slug is not null and v_slug !~ '^[a-z0-9-]{1,80}$' then
--         raise exception 'El identificador del anuncio no tiene un formato válido.' using errcode = '22023';
--       end if;
--
--       insert into public.contactos_respaldo (nombre, contacto, mensaje, pension_slug)
--       values (v_nombre, v_contacto, v_mensaje, v_slug);
--     end;
--     $reversion$;
--
--     revoke all on function public.registrar_contacto_respaldo(text, text, text, text) from public;
--     revoke all on function public.registrar_contacto_respaldo(text, text, text, text) from anon, authenticated;
--     grant execute on function public.registrar_contacto_respaldo(text, text, text, text) to anon, authenticated;
--
--   commit;
--
--   El cuerpo es el de `oleada-12` línea por línea, no una reconstrucción de
--   memoria. Si se revierte, el formulario desplegado hoy vuelve a guardar y el
--   código de la tarea #8 empezaría a fallar con PGRST202, que es justo el
--   comportamiento que ya sabe mostrar.
--
-- ============================================================================
-- 8) Nota para quien administra · decisión abierta, NO ejecutar
-- ============================================================================
--
--   La columna guarda la FECHA, no la VERSIÓN del texto aceptado. Cuando el
--   aviso de privacidad tenga versiones numeradas (`v1`, `v2`…), la prueba
--   completa será «esta persona aceptó la v1 el 3 de noviembre». Hoy el aviso no
--   tiene número, así que no hay nada que guardar y añadirlo sería una columna
--   vacía. Se resuelve con otra oleada aditiva cuando el texto se numere.
--
--   Y no se guarda el contenido del mensaje en ningún registro: la fila ya lo
--   tiene, y duplicarlo en un log multiplica los datos personales sin motivo.
