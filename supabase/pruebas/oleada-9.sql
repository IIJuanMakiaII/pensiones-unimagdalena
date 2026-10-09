-- Verificación funcional de la Oleada 9 (se ejecuta y se limpia sola).
--
-- Qué comprueba (criterios de aceptación de la tarea #33, alcance nuevo):
--   1. El maestro LEE una publicación retirada; otro anfitrión no lee la ajena.
--   2. El maestro BORRA la de otro; un anfitrión solo borra la suya.
--   3. `whatsapp` deja de ser legible por el rol anónimo (y deja de poder
--      escribirse).
--   4. El maestro administra campos de contenido y campos administrativos.
--   5. Identidad/relaciones estructurales y datos privados siguen protegidos.
--   6. El rol maestro NO se puede pedir desde el registro.
--
-- Preparación: todos los usuarios y publicaciones son sintéticos. No se usan
-- cuentas ni anuncios existentes; los datos y slugs de prueba se limpian al final.

create temporary table if not exists qa_oleada9 (paso text, ok boolean, detalle text);
truncate table pg_temp.qa_oleada9;

do $qa$
declare
  v_rol_sesion text := current_user;
  v_uid        uuid := gen_random_uuid();
  v_maestro    uuid := gen_random_uuid();
  v_registro   uuid := gen_random_uuid();
  v_estudiante uuid := gen_random_uuid();
  v_pension    uuid;
  v_pension2   uuid;
  v_pension_maestro uuid;
  v_slug_pension text;
  v_habitacion uuid;
  v_habitacion_admin uuid;
  v_titulo_prefijo text;
  v_slug_prefijo text;
  v_rol_previo text;
  v_cuenta     integer;
  v_valor      text;
  v_precio     integer;
  v_nota       numeric;
  v_verificado boolean;
  v_admin_id   uuid;
  v_titulo     text;
  v_filas      integer;
  v_ok         boolean;
  v_detalle    text;
begin
  v_titulo_prefijo := 'Prueba QA oleada 9 ' || substr(v_maestro::text, 1, 8);
  v_slug_prefijo := 'prueba-qa-oleada-9-' || substr(v_maestro::text, 1, 8);

  -- ------------------------------------------------------------------------
  -- Preparación: un maestro sintético y una publicación retirada del anfitrión
  -- ------------------------------------------------------------------------
  begin
    insert into auth.users (
      id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at
    ) values
      (v_uid, 'authenticated', 'authenticated', v_slug_prefijo || '-host@example.invalid',
       jsonb_build_object('nombre', 'QA Host', 'rol', 'anfitrion'), now(), now(), now()),
      (v_maestro, 'authenticated', 'authenticated', v_slug_prefijo || '-maestro@example.invalid',
       jsonb_build_object('nombre', 'QA Maestro', 'rol', 'anfitrion'), now(), now(), now()),
      (v_registro, 'authenticated', 'authenticated', v_slug_prefijo || '-registro@example.invalid',
        jsonb_build_object('nombre', 'QA Registro', 'rol', 'maestro'), now(), now(), now()),
            (v_estudiante, 'authenticated', 'authenticated', v_slug_prefijo || '-estudiante@example.invalid',
        jsonb_build_object('nombre', 'QA Estudiante', 'rol', 'estudiante'), now(), now(), now());

    update public.usuarios set rol = 'maestro' where id = v_maestro;
    v_ok := true; v_detalle := 'dos anfitriones sintéticos, un maestro concedido por SQL y un registro que solicitó maestro';
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  insert into qa_oleada9 values ('1. Preparación: usuario maestro', v_ok, v_detalle);

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    perform set_config('role', 'authenticated', true);
    v_pension := public.crear_pension_con_habitaciones(
      jsonb_build_object(
        'titulo', v_titulo_prefijo || ' Retirada',
        'descripcion', 'Publicacion temporal retirada creada por la verificacion automatica.',
        'direccion', 'Carrera 21 # 30-10',
        'barrio', 'Mamatoco',
        'activa', false
      ),
      jsonb_build_array(
        jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 460000, 'disponible', true)
      )
    );
    v_ok := v_pension is not null;
    v_detalle := format('publicación retirada creada=%s', v_pension is not null);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('2. Preparación: publicación retirada del anfitrión', v_ok, v_detalle);
  select id into v_habitacion from public.habitaciones where pension_id = v_pension limit 1;
  select slug into v_slug_pension from public.pensiones where id = v_pension;

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    v_pension2 := public.crear_pension_con_habitaciones(
      jsonb_build_object(
        'titulo', v_titulo_prefijo || ' Propia',
        'descripcion', 'Publicacion sintetica propia para probar permisos del anfitrion.',
        'direccion', 'Carrera 21 # 30-12',
        'barrio', 'Mamatoco',
        'activa', true
      ),
      jsonb_build_array(
        jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 470000, 'disponible', true)
      )
    );
    v_ok := v_pension2 is not null;
    v_detalle := format('publicacion propia activa creada=%s', v_pension2 is not null);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('2b. Preparación: publicación activa sintética del anfitrión', v_ok, v_detalle);

  select rol into v_rol_previo from public.usuarios where id = v_registro;
  insert into qa_oleada9 values (
    '2c. El trigger de registro rechaza pedir maestro',
    v_rol_previo = 'anfitrion',
    format('rol asignado a quien solicitó maestro=%s (esperado anfitrion)', v_rol_previo)
  );
  begin
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    select count(*) into v_cuenta from public.pensiones where id = v_pension2 and activa;
    v_ok := v_cuenta = 1;
    v_detalle := format('filas activas visibles=%s (esperado 1)', v_cuenta);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('2d. El catálogo público lee la publicación activa sintética', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    v_pension_maestro := public.crear_pension_con_habitaciones(
      jsonb_build_object(
        'titulo', v_titulo_prefijo || ' Creada Maestro',
        'descripcion', 'Publicacion sintetica creada por el maestro mediante la RPC existente.',
        'direccion', 'Carrera 21 # 30-14',
        'barrio', 'Mamatoco',
        'activa', false
      ),
      jsonb_build_array(
        jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 480000, 'disponible', true)
      )
    );
    v_ok := v_pension_maestro is not null;
    v_detalle := format('publicacion creada por RPC=%s', v_pension_maestro);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('2e. El maestro puede crear publicaciones con la RPC existente', v_ok, v_detalle);

  -- ========================================================================
  -- 1) LECTURA: el maestro ve lo retirado; otro anfitrión no ve lo ajeno
  -- ========================================================================
  -- Primero con el rol del maestro BAJADO a anfitrión: no debe ver nada.
  begin
    update public.usuarios set rol = 'anfitrion' where id = v_maestro;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    select count(*) into v_cuenta from public.pensiones where id = v_pension;
    v_ok := (v_cuenta = 0);
    v_detalle := format('filas visibles como anfitrión ajeno=%s (esperado 0)', v_cuenta);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('3. Un anfitrión NO lee la publicación retirada de otro', v_ok, v_detalle);

  -- Ahora con el rol maestro: debe verla.
  begin
    update public.usuarios set rol = 'maestro' where id = v_maestro;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    select count(*) into v_cuenta from public.pensiones where id = v_pension;
    v_ok := (v_cuenta = 1);
    v_detalle := format('filas visibles como maestro=%s (esperado 1)', v_cuenta);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('4. El maestro SÍ lee la publicación retirada', v_ok, v_detalle);

  -- Y las habitaciones de esa publicación también.
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    select count(*) into v_cuenta from public.habitaciones where pension_id = v_pension;
    v_ok := (v_cuenta = 1);
    v_detalle := format('habitaciones visibles para el maestro=%s (esperado 1)', v_cuenta);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('5. El maestro lee también las habitaciones', v_ok, v_detalle);

  -- `es_maestro()` responde bien en los dos casos.
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    v_ok := public.es_maestro();
    v_detalle := format('es_maestro() para el anfitrión=%s (esperado false)', v_ok);
  exception when others then
    v_ok := true; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('6. es_maestro() es falso para un anfitrión', v_ok = false, v_detalle);

  -- ========================================================================
  -- 2) ESCRITURA: disponibilidad, y borrado
  -- ========================================================================
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    update public.habitaciones set disponible = false where pension_id = v_pension;
    get diagnostics v_cuenta = row_count;
    v_ok := (v_cuenta = 1);
    v_detalle := format('habitaciones actualizadas por el maestro=%s (esperado 1)', v_cuenta);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('7. El maestro edita la disponibilidad de una habitación ajena', v_ok, v_detalle);

  -- El precio de pension es derivado: el maestro modifica el precio de su
  -- habitación y el trigger existente sincroniza pensiones.precio_mensual.
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    update public.habitaciones
       set disponible = true, precio_mensual_cop = 525000
     where id = v_habitacion;
    get diagnostics v_cuenta = row_count;
    select precio_mensual into v_precio from public.pensiones where id = v_pension;
    v_ok := v_cuenta = 1 and v_precio = 525000;
    v_detalle := format('habitaciones modificadas=%s · precio derivado=%s (esperado 525000)', v_cuenta, v_precio);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('7b. El maestro cambia precio por la habitación y se sincroniza la pensión', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    v_admin_id := public.maestro_actualizar_campos_pension(v_pension, jsonb_build_object('verificado', true));
    select verificado into v_verificado from public.pensiones where id = v_pension;
    v_ok := v_admin_id = v_pension and v_verificado;
    v_detalle := format('publicacion=%s · verificado=%s (esperado true)', v_admin_id, v_verificado);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('7c. El maestro puede cambiar verificado', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    v_admin_id := public.maestro_actualizar_campos_pension(v_pension, jsonb_build_object('calificacion', 4.8));
    select calificacion into v_nota from public.pensiones where id = v_pension;
    v_ok := v_admin_id = v_pension and v_nota = 4.8;
    v_detalle := format('publicacion=%s · calificacion=%s (esperado 4.8)', v_admin_id, v_nota);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('7d. El maestro puede cambiar calificacion', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    update public.pensiones
       set titulo = v_titulo_prefijo || ' Corregida',
           descripcion = 'Descripcion administrativa corregida.',
           direccion = 'Carrera 22 # 31-20',
           barrio = 'Centro',
           distancia_a_pie_minutos = 15,
           servicios = array['WiFi', 'Lavanderia'],
           normas = array['No fumar'],
           imagenes = array['https://example.invalid/qa-nido.jpg'],
           activa = true
     where id = v_pension;
    get diagnostics v_cuenta = row_count;
    select titulo into v_titulo from public.pensiones where id = v_pension;
    v_ok := v_cuenta = 1 and v_titulo = v_titulo_prefijo || ' Corregida';
    v_detalle := format('filas editadas=%s · titulo=%s', v_cuenta, v_titulo);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('7e. El maestro edita informacion general permitida', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    v_admin_id := public.maestro_actualizar_campos_pension(
      v_pension,
      jsonb_build_object('latitud', 11.23, 'longitud', -74.18)
    );
    v_ok := v_admin_id = v_pension;
    v_detalle := format('publicacion con coordenadas corregidas=%s', v_admin_id);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('7f. El maestro puede corregir coordenadas validas', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    insert into public.habitaciones (pension_id, tipo, genero, precio_mensual_cop, disponible)
    values (v_pension2, 'compartida', 'mixto', 650000, true)
    returning id into v_habitacion_admin;
    v_ok := v_habitacion_admin is not null;
    v_detalle := format('habitacion creada para pension ajena=%s', v_habitacion_admin);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('7g. El maestro puede crear habitaciones en una pension ajena', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    delete from public.habitaciones where id = v_habitacion_admin;
    get diagnostics v_cuenta = row_count;
    v_ok := v_cuenta = 1;
    v_detalle := format('habitaciones ajenas borradas por maestro=%s (esperado 1)', v_cuenta);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('7h. El maestro puede borrar una habitacion ajena', v_ok, v_detalle);

  -- Un anfitrión NO puede borrar lo ajeno (control negativo).
  begin
    update public.usuarios set rol = 'anfitrion' where id = v_maestro;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    perform public.borrar_pension(v_pension);
    v_ok := false; v_detalle := 'PERMITIDO: un anfitrión borró la publicación de otro';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('8. Un anfitrión NO borra la publicación de otro (42501)', v_ok, v_detalle);

  -- El anfitrion no puede editar campos administrativos ni en su propia pension.
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set verificado = true where id = v_pension2;
    v_ok := false; v_detalle := 'PERMITIDO: el anfitrion modifico verificado';
  exception when others then
    v_ok := sqlstate = '42501'; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('8a. El anfitrion NO puede cambiar verificado (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set calificacion = 5.0 where id = v_pension2;
    v_ok := false; v_detalle := 'PERMITIDO: el anfitrion modifico calificacion';
  exception when others then
    v_ok := sqlstate = '42501'; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('8b. El anfitrion NO puede cambiar calificacion (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    v_admin_id := public.maestro_actualizar_campos_pension(v_pension2, jsonb_build_object('calificacion', 5.0));
    v_ok := false; v_detalle := 'PERMITIDO: el anfitrion ejecuto la funcion administrativa';
  exception when others then
    v_ok := sqlstate = '42501'; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('8b2. El anfitrion NO puede invocar la funcion admin (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_estudiante::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_estudiante::text, true);
    update public.pensiones set calificacion = 5.0 where id = v_pension2;
    v_ok := false; v_detalle := 'PERMITIDO: el estudiante modifico calificacion';
  exception when others then
    v_ok := sqlstate = '42501'; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('8b3. El estudiante NO puede cambiar calificacion (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_estudiante::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_estudiante::text, true);
    v_admin_id := public.maestro_actualizar_campos_pension(v_pension2, jsonb_build_object('verificado', true));
    v_ok := false; v_detalle := 'PERMITIDO: el estudiante ejecuto la funcion administrativa';
  exception when others then
    v_ok := sqlstate = '42501'; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('8b4. El estudiante NO puede invocar la funcion admin (42501)', v_ok, v_detalle);

  -- El actor se baja explicitamente a anfitrion: RLS deja cero filas al cambiar
  -- el precio de una habitacion ajena y el precio derivado permanece intacto.
  update public.usuarios set rol = 'anfitrion' where id = v_maestro;
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    update public.habitaciones set precio_mensual_cop = 999000 where id = v_habitacion;
    get diagnostics v_filas = row_count;
    perform set_config('role', v_rol_sesion, true);
    select precio_mensual_cop into v_precio from public.habitaciones where id = v_habitacion;
    v_ok := v_filas = 0 and v_precio = 525000;
    v_detalle := format('filas editadas=%s · precio conservado=%s (esperado 525000)', v_filas, v_precio);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  update public.usuarios set rol = 'maestro' where id = v_maestro;
  insert into qa_oleada9 values ('8c. El anfitrion NO cambia el precio de una pension ajena', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    -- El objetivo es la publicacion del maestro, no una propia: `v_pension`
    -- pertenece al actor (v_uid), asi que editarla seria legitimo. `v_pension_maestro`
    -- la creo v_maestro y sigue viva hasta la limpieza final.
    update public.pensiones set titulo = 'Titulo ajeno modificado' where id = v_pension_maestro;
    get diagnostics v_cuenta = row_count;
    v_ok := v_cuenta = 0;
    v_detalle := format('filas editadas de una pension ajena=%s (esperado 0)', v_cuenta);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('8d. El anfitrion NO modifica una publicacion ajena', v_ok, v_detalle);

  -- El maestro SÍ borra la de otro.
  begin
    update public.usuarios set rol = 'maestro' where id = v_maestro;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    v_valor := public.borrar_pension(v_pension);
    v_ok := v_valor is not null;
    v_detalle := format('dirección devuelta=%s', coalesce(v_valor, 'NULL'));
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('9. El maestro SÍ borra la publicación de otro', v_ok, v_detalle);

  select count(*) into v_cuenta from public.pensiones where id = v_pension;
  insert into qa_oleada9 values ('10. La publicación borrada ya no existe', v_cuenta = 0,
    format('filas con ese id=%s (esperado 0)', v_cuenta));

  select count(*) into v_cuenta from public.habitaciones where pension_id = v_pension;
  insert into qa_oleada9 values ('11. No quedan habitaciones huérfanas', v_cuenta = 0,
    format('habitaciones de esa publicación=%s (esperado 0)', v_cuenta));

  select count(*) into v_cuenta from public.slugs_reservados where slug = v_slug_pension;
  insert into qa_oleada9 values ('11b. El borrado del maestro conserva la reserva de slug de Oleada 7', v_cuenta = 1,
    format('reservas del slug borrado=%s (esperado 1)', v_cuenta));

  -- La publicacion propia sintetica se conserva hasta el final para probar
  -- permisos de anfitrion y lectura publica antes de borrarla.
  select count(*) into v_cuenta from public.pensiones where id = v_pension2 and anfitrion_id = v_uid;
  insert into qa_oleada9 values ('12. La publicación propia sintética existe para las pruebas', v_cuenta = 1,
    format('filas propias de prueba=%s (esperado 1)', v_cuenta));

  -- ========================================================================
  -- 3) EL NÚMERO DEL ANFITRIÓN FUERA DEL ALCANCE PÚBLICO
  -- ========================================================================
  begin
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    select whatsapp into v_valor from public.pensiones where id = v_pension2;
    v_ok := false; v_detalle := 'PERMITIDO: un anónimo leyó el número del anfitrión';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('13. Un anónimo NO puede leer `whatsapp` (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    select whatsapp into v_valor from public.pensiones where id = v_pension2;
    v_ok := false; v_detalle := 'PERMITIDO: authenticated leyó whatsapp';
  exception when others then
    v_ok := sqlstate = '42501'; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('13b. authenticated NO puede leer whatsapp (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    select autorizacion_contacto_en into v_valor from public.pensiones where id = v_pension2;
    v_ok := false; v_detalle := 'PERMITIDO: anon leyó autorizacion_contacto_en';
  exception when others then
    v_ok := sqlstate = '42501'; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('13c. anon NO puede leer autorizacion_contacto_en (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    select autorizacion_contacto_en into v_valor from public.pensiones where id = v_pension2;
    v_ok := false; v_detalle := 'PERMITIDO: authenticated leyó autorizacion_contacto_en';
  exception when others then
    v_ok := sqlstate = '42501'; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('13d. authenticated NO puede leer autorizacion_contacto_en (42501)', v_ok, v_detalle);

  insert into qa_oleada9
  select '14. El privilegio de lectura de `whatsapp` está retirado',
         not has_column_privilege('anon', 'public.pensiones', 'whatsapp', 'SELECT')
         and not has_column_privilege('authenticated', 'public.pensiones', 'whatsapp', 'SELECT')
         and not has_column_privilege('anon', 'public.pensiones', 'autorizacion_contacto_en', 'SELECT')
         and not has_column_privilege('authenticated', 'public.pensiones', 'autorizacion_contacto_en', 'SELECT'),
         format('anon/whatsapp=%s · authenticated/whatsapp=%s · anon/autorizacion=%s · authenticated/autorizacion=%s',
                has_column_privilege('anon', 'public.pensiones', 'whatsapp', 'SELECT'),
                has_column_privilege('authenticated', 'public.pensiones', 'whatsapp', 'SELECT'),
                has_column_privilege('anon', 'public.pensiones', 'autorizacion_contacto_en', 'SELECT'),
                has_column_privilege('authenticated', 'public.pensiones', 'autorizacion_contacto_en', 'SELECT'));

  v_ok := has_column_privilege('authenticated', 'public.pensiones', 'activa', 'UPDATE')
          and has_column_privilege('authenticated', 'public.pensiones', 'barrio', 'UPDATE')
          and has_column_privilege('authenticated', 'public.pensiones', 'descripcion', 'UPDATE')
          and has_column_privilege('authenticated', 'public.pensiones', 'direccion', 'UPDATE')
          and has_column_privilege('authenticated', 'public.pensiones', 'distancia_a_pie_minutos', 'UPDATE')
          and has_column_privilege('authenticated', 'public.pensiones', 'imagenes', 'UPDATE')
          and has_column_privilege('authenticated', 'public.pensiones', 'normas', 'UPDATE')
          and has_column_privilege('authenticated', 'public.pensiones', 'servicios', 'UPDATE')
          and has_column_privilege('authenticated', 'public.pensiones', 'titulo', 'UPDATE');
  insert into qa_oleada9 values (
    '14b. authenticated conserva UPDATE en las nueve columnas de contenido',
    v_ok,
    format('activa=%s · barrio=%s · descripcion=%s · direccion=%s · distancia=%s · imagenes=%s · normas=%s · servicios=%s · titulo=%s',
      has_column_privilege('authenticated', 'public.pensiones', 'activa', 'UPDATE'),
      has_column_privilege('authenticated', 'public.pensiones', 'barrio', 'UPDATE'),
      has_column_privilege('authenticated', 'public.pensiones', 'descripcion', 'UPDATE'),
      has_column_privilege('authenticated', 'public.pensiones', 'direccion', 'UPDATE'),
      has_column_privilege('authenticated', 'public.pensiones', 'distancia_a_pie_minutos', 'UPDATE'),
      has_column_privilege('authenticated', 'public.pensiones', 'imagenes', 'UPDATE'),
      has_column_privilege('authenticated', 'public.pensiones', 'normas', 'UPDATE'),
      has_column_privilege('authenticated', 'public.pensiones', 'servicios', 'UPDATE'),
      has_column_privilege('authenticated', 'public.pensiones', 'titulo', 'UPDATE'))
  );

  -- Y la lectura pública de lo que sí hace falta sigue funcionando.
  begin
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    select count(*) into v_cuenta from public.pensiones where id = v_pension2 and activa;
    v_ok := (v_cuenta = 1);
    v_detalle := format('publicacion activa sintetica visible para un anonimo=%s (esperado 1)', v_cuenta);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('15. El catálogo público sigue leyéndose', v_ok, v_detalle);

  -- ========================================================================
  -- 4) LO QUE YA ESTABA CERRADO SIGUE CERRADO
  -- ========================================================================
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set verificado = true, calificacion = 5.0 where id = v_pension2;
    v_ok := false; v_detalle := 'PERMITIDO: se escribió `verificado`/`calificacion`';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('16. Siguen prohibidas `verificado`/`calificacion` (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set precio_mensual = 1000 where id = v_pension2;
    v_ok := false; v_detalle := 'PERMITIDO: se escribió `precio_mensual`';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('17. Sigue prohibido `precio_mensual` (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set anfitrion_id = v_maestro where id = v_pension2;
    v_ok := false; v_detalle := 'PERMITIDO: se transfirió una publicación a otra cuenta';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('18. Sigue prohibido `anfitrion_id` (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set slug = 'direccion-inventada' where id = v_pension2;
    v_ok := false; v_detalle := 'PERMITIDO: se cambió la dirección de una publicación';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('19. Sigue prohibido `slug` (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set whatsapp = '3001234567' where id = v_pension2;
    v_ok := false; v_detalle := 'PERMITIDO: se escribió un número de WhatsApp';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('20. Ya no se puede escribir `whatsapp` (42501)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.pensiones set autorizacion_contacto_en = now() where id = v_pension2;
    v_ok := false; v_detalle := 'PERMITIDO: se escribió autorizacion_contacto_en';
  exception when others then
    v_ok := sqlstate = '42501'; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('20b. Ya no se puede escribir autorizacion_contacto_en (42501)', v_ok, v_detalle);

  -- El rol no se puede ascender desde la aplicación (ni el maestro puede hacerlo).
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    update public.usuarios set rol = 'maestro' where id = v_uid;
    v_ok := false; v_detalle := 'PERMITIDO: un usuario se ascendió a maestro';
  exception when others then
    v_ok := (sqlstate = '42501');
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('21. Nadie se asciende a maestro por la API (42501)', v_ok, v_detalle);

  -- Y el registro sigue sin admitir el rol nuevo.
  select case when position('maestro' in prosrc) = 0 then false else true end
    into v_ok
    from pg_proc where proname = 'crear_perfil_usuario';
  insert into qa_oleada9 values ('22. El registro no admite pedir el rol maestro',
    v_ok = false, format('la función de alta menciona «maestro»=%s (esperado false)', v_ok));

  -- El `check` del rol sí lo admite (para poder concederlo por SQL).
  select case when pg_get_constraintdef(oid) like '%maestro%' then true else false end
    into v_ok
    from pg_constraint where conname = 'usuarios_rol_check';
  insert into qa_oleada9 values ('23. El rol maestro existe y se puede conceder por SQL',
    v_ok, format('el check del rol admite maestro=%s (esperado true)', v_ok));

  v_ok := not has_column_privilege('authenticated', 'public.pensiones', 'id', 'UPDATE')
          and not has_column_privilege('authenticated', 'public.pensiones', 'slug', 'UPDATE')
          and not has_column_privilege('authenticated', 'public.pensiones', 'anfitrion_id', 'UPDATE')
          and not has_column_privilege('authenticated', 'public.habitaciones', 'id', 'UPDATE')
          and not has_column_privilege('authenticated', 'public.habitaciones', 'pension_id', 'UPDATE')
          and not has_column_privilege('authenticated', 'public.habitaciones', 'creada_en', 'UPDATE');
  insert into qa_oleada9 values ('23b. identidad y relaciones estructurales no tienen UPDATE directo', v_ok,
    format('pensiones[id=%s,slug=%s,anfitrion_id=%s] · habitaciones[id=%s,pension_id=%s,creada_en=%s]',
      has_column_privilege('authenticated', 'public.pensiones', 'id', 'UPDATE'),
      has_column_privilege('authenticated', 'public.pensiones', 'slug', 'UPDATE'),
      has_column_privilege('authenticated', 'public.pensiones', 'anfitrion_id', 'UPDATE'),
      has_column_privilege('authenticated', 'public.habitaciones', 'id', 'UPDATE'),
      has_column_privilege('authenticated', 'public.habitaciones', 'pension_id', 'UPDATE'),
      has_column_privilege('authenticated', 'public.habitaciones', 'creada_en', 'UPDATE')));

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    v_admin_id := public.maestro_actualizar_campos_pension(
      v_pension2,
      jsonb_build_object('id', gen_random_uuid(), 'slug', 'cambio-estructural', 'anfitrion_id', v_uid)
    );
    v_ok := false; v_detalle := 'PERMITIDO: la funcion acepto columnas estructurales';
  exception when others then
    v_ok := sqlstate = '22023'; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('23c. La función admin rechaza id, slug y anfitrion_id', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_maestro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_maestro::text, true);
    v_admin_id := public.maestro_actualizar_campos_pension(
      v_pension2,
      jsonb_build_object('whatsapp', '3001234567', 'autorizacion_contacto_en', now())
    );
    v_ok := false; v_detalle := 'PERMITIDO: la funcion admin acepto campos privados';
  exception when others then
    v_ok := sqlstate = '22023'; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('23d. La función admin rechaza WhatsApp y autorizacion_contacto_en', v_ok, v_detalle);

  -- El anfitrion conserva el borrado de una publicacion propia.
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    v_valor := public.borrar_pension(v_pension2);
    v_ok := v_valor is not null;
    v_detalle := format('slug reservado=%s', coalesce(v_valor, 'NULL'));
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol_sesion, true);
  insert into qa_oleada9 values ('24. El anfitrion SÍ borra su publicacion propia', v_ok, v_detalle);

  -- Limpieza dentro del mismo bloque: usa el prefijo aleatorio de esta ejecución
  -- y elimina exclusivamente sus filas, slugs y cuentas sintéticas.
  perform set_config('role', v_rol_sesion, true);
  delete from public.habitaciones
   where pension_id in (select id from public.pensiones where titulo like v_titulo_prefijo || '%');
  delete from public.pensiones where titulo like v_titulo_prefijo || '%';
  delete from public.slugs_reservados where slug like v_slug_prefijo || '%';
  delete from auth.users where id in (v_uid, v_maestro, v_registro, v_estudiante);

  insert into qa_oleada9
  select '25. limpieza sin residuos',
         (select count(*) from public.pensiones where titulo like v_titulo_prefijo || '%') = 0
         and (select count(*) from public.habitaciones h
               where h.pension_id in (v_pension, v_pension2, v_pension_maestro)) = 0
         and (select count(*) from public.slugs_reservados where slug like v_slug_prefijo || '%') = 0
         and (select count(*) from auth.users where id in (v_uid, v_maestro, v_registro, v_estudiante)) = 0
         and (select count(*) from public.usuarios where id in (v_uid, v_maestro, v_registro, v_estudiante)) = 0,
         format('publicaciones=%s · habitaciones=%s · reservas=%s · usuarios=%s · perfiles=%s',
                (select count(*) from public.pensiones where titulo like v_titulo_prefijo || '%'),
                (select count(*) from public.habitaciones h where h.pension_id in (v_pension, v_pension2, v_pension_maestro)),
                (select count(*) from public.slugs_reservados where slug like v_slug_prefijo || '%'),
                (select count(*) from auth.users where id in (v_uid, v_maestro, v_registro, v_estudiante)),
                (select count(*) from public.usuarios where id in (v_uid, v_maestro, v_registro, v_estudiante)));
end $qa$;

select paso, ok, detalle from qa_oleada9 order by paso;
