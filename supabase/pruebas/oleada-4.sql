-- Verificación funcional de la Oleada 4 (se ejecuta y se limpia sola).
--
-- Qué comprueba (criterios de aceptación de la tarea #21):
--   1. `pensiones.whatsapp` existe, es opcional (NULL) y su restricción rechaza
--      cualquier valor que no sean exactamente 10 dígitos: 9, 11, con letras y
--      con prefijo/espacios.
--   2. Un anfitrión puede FIJAR y CAMBIAR el número de su publicación, tanto al
--      publicar (INSERT) como al editar (UPDATE).
--   3. Otro anfitrión no puede escribir el número en mi publicación (RLS).
--   4. Las publicaciones que ya existían quedan con NULL sin romperse, la lectura
--      pública sigue funcionando y lo prohibido sigue prohibido.
--
-- Precauciones de método (las mismas que en oleada-2.sql y oleada-3.sql):
--   · El rol de sesión SÍ se cambia y se restaura tras cada prueba.
--   · La publicación de prueba se crea retirada (`activa = false`): nunca
--     aparece en el catálogo público.
--   · No se toca la publicación real del anfitrión: solo se LEE su valor.
--
-- Antes de aplicar la Oleada 4, el intento de escribir `whatsapp` devolvía:
--   42703 column "whatsapp" does not exist

drop table if exists qa_oleada4;
create temp table qa_oleada4 (paso text, ok boolean, detalle text);

do $qa$
declare
  v_rol      text := current_user;
  v_uid      uuid;
  v_otro     uuid := gen_random_uuid();   -- "otro anfitrión": sin crear cuentas
  v_pension  uuid;
  v_filas    integer;
  v_valor    text;
  v_ok       boolean;
  v_detalle  text;
  v_anon     text;
  v_previos  integer;
  v_columnas text;
begin
  select id into v_uid from auth.users order by created_at limit 1;

  if v_uid is null then
    insert into qa_oleada4 values ('0. usuario de prueba', false, 'no hay usuarios en auth.users');
    return;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);

  -- ------------------------------------------------------------------------
  -- 1) La columna, su tipo y su restricción
  -- ------------------------------------------------------------------------
  select count(*) into v_previos
    from information_schema.columns
   where table_schema = 'public' and table_name = 'pensiones' and column_name = 'whatsapp';

  select is_nullable, data_type into v_valor, v_detalle
    from information_schema.columns
   where table_schema = 'public' and table_name = 'pensiones' and column_name = 'whatsapp';

  insert into qa_oleada4 values ('1. Columna whatsapp: existe, es TEXT y opcional',
    v_previos = 1 and v_valor = 'YES' and v_detalle = 'text',
    format('existe=%s nullable=%s tipo=%s', v_previos = 1, v_valor, v_detalle));

  select pg_get_constraintdef(oid) into v_valor
    from pg_constraint
   where conrelid = 'public.pensiones'::regclass and conname = 'pensiones_whatsapp_formato';

  insert into qa_oleada4 values ('2. Restricción de formato de 10 dígitos',
    v_valor = 'CHECK (((whatsapp IS NULL) OR (whatsapp ~ ''^[0-9]{10}$''::text)))',
    format('definición=%s', coalesce(v_valor, 'NO EXISTE')));

  -- Las publicaciones que ya existían: ninguna tiene número (no se inventó nada).
  select count(*) into v_previos from public.pensiones where whatsapp is not null;
  insert into qa_oleada4 values ('3. Las publicaciones existentes quedan con NULL',
    v_previos = 0,
    format('publicaciones con número antes de las pruebas=%s (esperado 0)', v_previos));

  -- ------------------------------------------------------------------------
  -- 4) FIJAR el número al PUBLICAR (INSERT real, no un indicador del catálogo)
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    insert into public.pensiones (anfitrion_id, titulo, descripcion, direccion, barrio, activa, whatsapp)
    values (v_uid, 'Prueba QA oleada 4', 'Publicacion temporal creada por la verificacion automatica.',
            'Calle 22 # 3-45', 'Mamatoco', false, '3001234567')
    returning id into v_pension;
    v_ok := v_pension is not null;
    v_detalle := format('publicacion creada=%s', v_pension is not null);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada4 values ('4. Fijar el número al publicar (INSERT)', v_ok, v_detalle);

  -- ------------------------------------------------------------------------
  -- 5) CAMBIAR el número desde el editor (UPDATE)
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones set whatsapp = '3119876543' where id = v_pension;
    get diagnostics v_filas = row_count;
    v_ok := (v_filas = 1);
    v_detalle := format('filas=%s (esperado 1)', v_filas);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada4 values ('5. Cambiar el número desde el editor (UPDATE)', v_ok, v_detalle);

  select whatsapp into v_valor from public.pensiones where id = v_pension;
  insert into qa_oleada4 values ('6. El valor guardado es exactamente el que se envió',
    v_valor = '3119876543', format('valor=%s', coalesce(v_valor, 'NULL')));

  -- ------------------------------------------------------------------------
  -- 6) Formatos inválidos: 9, 11, letras y prefijo con espacios
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones set whatsapp = '300123456' where id = v_pension;   -- 9 dígitos
    get diagnostics v_filas = row_count;
    v_ok := false; v_detalle := format('PERMITIDO: filas=%s (aceptó 9 dígitos)', v_filas);
  exception when others then
    v_ok := (sqlstate = '23514');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada4 values ('7. Rechaza 9 dígitos (23514)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones set whatsapp = '30012345678' where id = v_pension;  -- 11 dígitos
    get diagnostics v_filas = row_count;
    v_ok := false; v_detalle := format('PERMITIDO: filas=%s (aceptó 11 dígitos)', v_filas);
  exception when others then
    v_ok := (sqlstate = '23514');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada4 values ('8. Rechaza 11 dígitos (23514)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones set whatsapp = '30O1234567' where id = v_pension;   -- con letra O
    get diagnostics v_filas = row_count;
    v_ok := false; v_detalle := format('PERMITIDO: filas=%s (aceptó letras)', v_filas);
  exception when others then
    v_ok := (sqlstate = '23514');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada4 values ('9. Rechaza letras (23514)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones set whatsapp = '+57 300 123 4567' where id = v_pension;
    get diagnostics v_filas = row_count;
    v_ok := false; v_detalle := format('PERMITIDO: filas=%s (aceptó formato con prefijo y espacios)', v_filas);
  exception when others then
    v_ok := (sqlstate = '23514');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada4 values ('10. Rechaza «+57 300 123 4567» (se normaliza en la interfaz)', v_ok, v_detalle);

  -- El valor válido sigue intacto después de los cuatro intentos rechazados.
  select whatsapp into v_valor from public.pensiones where id = v_pension;
  insert into qa_oleada4 values ('11. Los intentos rechazados no alteraron el valor',
    v_valor = '3119876543', format('valor=%s (esperado 3119876543)', coalesce(v_valor, 'NULL')));

  -- ------------------------------------------------------------------------
  -- 7) Otro anfitrión no puede escribir el número en mi publicación
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_otro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_otro::text, true);
    update public.pensiones set whatsapp = '3000000000' where id = v_pension;
    get diagnostics v_filas = row_count;
    v_ok := (v_filas = 0);
    v_detalle := format('filas=%s (esperado 0: la RLS lo bloquea)', v_filas);
  exception when others then
    v_ok := true; v_detalle := format('bloqueado por RLS · %s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  insert into qa_oleada4 values ('12. Otro anfitrión NO puede escribir mi número', v_ok, v_detalle);

  -- ------------------------------------------------------------------------
  -- 8) Lectura pública y frontera de privilegios
  -- ------------------------------------------------------------------------
  select (select string_agg(a.attname, ', ' order by a.attname)
            from pg_attribute a
           where a.attrelid = 'public.pensiones'::regclass and a.attnum > 0 and not a.attisdropped
             and has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE')) as columnas,
         (select string_agg(a.attname, ', ' order by a.attname)
            from pg_attribute a
           where a.attrelid = 'public.pensiones'::regclass and a.attnum > 0 and not a.attisdropped
             and has_column_privilege('authenticated', a.attrelid, a.attnum, 'INSERT'))    as columnas_ins
    into v_columnas, v_detalle;

  insert into qa_oleada4 values ('13. Lista de columnas editables: la esperada, con whatsapp',
    v_columnas = 'activa, barrio, descripcion, direccion, distancia_a_pie_minutos, imagenes, normas, servicios, titulo, whatsapp'
    and v_detalle like '%whatsapp%',
    format('UPDATE=[%s] · INSERT incluye whatsapp=%s', v_columnas, v_detalle like '%whatsapp%'));

  select count(*) into v_previos
    from pg_attribute a
   where a.attrelid = 'public.pensiones'::regclass and a.attnum > 0 and not a.attisdropped
     and a.attname in ('verificado', 'calificacion', 'precio_mensual', 'anfitrion_id')
     and has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE');
  insert into qa_oleada4 values ('14. Lo prohibido sigue prohibido (A-1 y A-2 intactos)',
    v_previos = 0 and not has_table_privilege('authenticated', 'public.pensiones', 'UPDATE'),
    format('columnas sensibles editables=%s · UPDATE de tabla=%s',
           v_previos, has_table_privilege('authenticated', 'public.pensiones', 'UPDATE')));

  -- anon debe poder LEERLO: la ficha y el catálogo se sirven de forma anónima y
  -- con caché, y necesitan el número para construir el enlace de contacto.
  --
  -- Las claims JWT se limpian a propósito en las dos pruebas siguientes: un
  -- visitante anónimo real llega SIN `sub`. Si se dejara el del anfitrión, la
  -- prueba sería vacua — `auth.uid()` devolvería al dueño y la política de
  -- lectura pública ni se evaluaría. (Es la misma trampa que hace pasar una
  -- matriz de autorización sin probar nada, en la dirección contraria.)
  begin
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    select count(*) into v_previos from public.pensiones;
    select whatsapp into v_valor from public.pensiones where activa limit 1;
    v_ok := (v_previos >= 1);
    v_detalle := format('filas visibles para anon=%s · lectura de la columna whatsapp=%s (sin error)',
                        v_previos, coalesce(v_valor, 'NULL'));
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada4 values ('15. anon lee el catálogo y la columna whatsapp sin error', v_ok, v_detalle);

  -- La publicación de prueba está retirada: para un anónimo NO debe existir.
  begin
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    select count(*) into v_previos from public.pensiones where id = v_pension;
    v_ok := (v_previos = 0);
    v_detalle := format('filas visibles=%s (esperado 0)', v_previos);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada4 values ('16. La publicación retirada sigue oculta para anon', v_ok, v_detalle);

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
end $qa$;

-- Limpieza: ningún rastro de la prueba.
delete from public.habitaciones
 where pension_id in (select id from public.pensiones where titulo like 'Prueba QA oleada 4%');
delete from public.pensiones where titulo like 'Prueba QA oleada 4%';

insert into qa_oleada4
select '17. limpieza sin residuos',
       (select count(*) from public.pensiones where titulo like 'Prueba QA oleada 4%') = 0
       and (select count(*) from public.pensiones where whatsapp is not null) = 0,
       format('residuos=%s · publicaciones con número=%s (esperado 0 y 0: el número real lo pondrá el anfitrión desde el editor)',
              (select count(*) from public.pensiones where titulo like 'Prueba QA oleada 4%'),
              (select count(*) from public.pensiones where whatsapp is not null));

select paso, ok, detalle from qa_oleada4 order by paso;
