-- Verificación funcional de la Oleada 3 (se ejecuta y se limpia sola).
--
-- Qué comprueba (criterios de aceptación de la tarea #18):
--   1. Un anfitrión PUEDE actualizar los campos editables de su publicación.
--   2. `verificado`, `calificacion` y `precio_mensual` siguen DENEGADOS (42501),
--      igual que `anfitrion_id`, `latitud` y `longitud`.
--   3. El editor podrá añadir, editar y quitar habitaciones; `pension_id` no se
--      puede reasignar.
--   4. Otro anfitrión no puede editar mi publicación (RLS intacta).
--   5. La lectura pública y el panel de disponibilidad siguen funcionando.
--   6. El precio se sigue derivando de las habitaciones al editarlas.
--
-- Precauciones de método (las mismas que en oleada-2.sql):
--   · El rol de sesión SÍ se cambia y se restaura tras cada prueba. Sin eso las
--     pruebas correrían como el dueño de las tablas y todo "pasaría".
--   · Hay controles positivos: un "denegado" solo significa algo si el mismo rol
--     puede hacer lo legítimo.
--   · La publicación de prueba se crea retirada (`activa = false`) y no se
--     activa en ningún momento, así que nunca aparece en el catálogo público.
--   · No se toca la publicación real del anfitrión.
--
-- Antes de aplicar la Oleada 3, el intento de editar el título devolvía:
--   42501 permission denied for table pensiones

drop table if exists qa_oleada3;
create temp table qa_oleada3 (paso text, ok boolean, detalle text);

do $qa$
declare
  v_rol      text := current_user;
  v_uid      uuid;
  v_otro     uuid := gen_random_uuid();   -- "otro anfitrión": sin crear cuentas
  v_pension  uuid;
  v_hab      uuid;
  v_hab2     uuid;
  v_filas    integer;
  v_precio   integer;
  v_ok       boolean;
  v_detalle  text;
  v_anon     integer;
  v_columnas text;
begin
  select id into v_uid from auth.users order by created_at limit 1;

  if v_uid is null then
    insert into qa_oleada3 values ('0. usuario de prueba', false, 'no hay usuarios en auth.users');
    return;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);

  -- ------------------------------------------------------------------------
  -- 0) La creación sigue operativa (y da los datos de prueba del resto).
  -- ------------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  begin
    select public.crear_pension_con_habitaciones(
      jsonb_build_object(
        'titulo', 'Prueba QA oleada 3',
        'descripcion', 'Publicacion temporal creada por la verificacion automatica.',
        'direccion', 'Carrera 21 # 30-12',
        'barrio', 'El Pando',
        'distancia_a_pie_minutos', 12,
        'servicios', jsonb_build_array('WiFi de alta velocidad'),
        'normas', jsonb_build_array('No fumadores'),
        'imagenes', jsonb_build_array(),
        'activa', false
      ),
      jsonb_build_array(
        jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 500000, 'disponible', true)
      )
    ) into v_pension;
    v_ok := v_pension is not null; v_detalle := format('pension creada=%s', v_pension is not null);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada3 values ('1. La creación por RPC sigue operativa', v_ok, v_detalle);

  select id into v_hab from public.habitaciones where pension_id = v_pension order by creada_en limit 1;

  -- ------------------------------------------------------------------------
  -- 2) La concesión de columnas es EXACTAMENTE la prevista
  -- ------------------------------------------------------------------------
  select (select string_agg(a.attname, ', ' order by a.attname)
            from pg_attribute a
           where a.attrelid = 'public.pensiones'::regclass and a.attnum > 0 and not a.attisdropped
             and has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE')) as pensiones,
         (select string_agg(a.attname, ', ' order by a.attname)
            from pg_attribute a
           where a.attrelid = 'public.habitaciones'::regclass and a.attnum > 0 and not a.attisdropped
             and has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE')) as habitaciones
    into v_columnas, v_detalle;

  insert into qa_oleada3 values (
    '2. Columnas de UPDATE concedidas (exactas)',
    v_columnas = 'activa, barrio, descripcion, direccion, distancia_a_pie_minutos, imagenes, normas, servicios, titulo'
    and v_detalle = 'alimentacion_incluida, disponible, genero, precio_mensual_cop, tipo',
    format('pensiones=[%s] habitaciones=[%s]', v_columnas, v_detalle)
  );

  -- ------------------------------------------------------------------------
  -- 3) El anfitrión PUEDE editar los campos del editor
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones
       set titulo = 'Prueba QA oleada 3 (editado)',
           descripcion = 'Descripcion editada por el anfitrion desde el editor.',
           direccion = 'Carrera 21 # 30-99',
           barrio = 'Mamatoco',
           distancia_a_pie_minutos = 7,
           servicios = array['WiFi de alta velocidad', 'Agua caliente'],
           normas = array['No fumadores', 'Visitas hasta las 10 p.m.'],
           imagenes = array['https://images.unsplash.com/photo-1.jpg']
     where id = v_pension;
    get diagnostics v_filas = row_count;
    v_ok := (v_filas = 1);
    v_detalle := format('filas=%s (esperado 1)', v_filas);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada3 values ('3. Editar título, descripción, dirección, barrio, distancia, servicios, normas e imágenes', v_ok, v_detalle);

  -- ------------------------------------------------------------------------
  -- 4) Lo que sigue prohibido, sigue prohibido
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones set verificado = true, calificacion = 5.0 where id = v_pension;
    get diagnostics v_filas = row_count;
    v_ok := false; v_detalle := format('PERMITIDO: filas=%s', v_filas);
  exception when others then
    v_ok := true; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada3 values ('4. Sigue denegado: verificado y calificacion', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones set precio_mensual = 1000 where id = v_pension;
    get diagnostics v_filas = row_count;
    v_ok := false; v_detalle := format('PERMITIDO: filas=%s', v_filas);
  exception when others then
    v_ok := true; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada3 values ('5. Sigue denegado: precio_mensual', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones set anfitrion_id = v_otro where id = v_pension;
    get diagnostics v_filas = row_count;
    v_ok := false; v_detalle := format('PERMITIDO: filas=%s (transferencia de propiedad)', v_filas);
  exception when others then
    v_ok := true; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada3 values ('6. Sigue denegado: anfitrion_id (transferir la publicación)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones set latitud = 11.24, longitud = -74.19 where id = v_pension;
    get diagnostics v_filas = row_count;
    v_ok := false; v_detalle := format('PERMITIDO: filas=%s', v_filas);
  exception when others then
    v_ok := true; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada3 values ('7. Sigue denegado: coordenadas (privilegio de más)', v_ok, v_detalle);

  -- ------------------------------------------------------------------------
  -- 5) Habitaciones: añadir, editar, quitar
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    insert into public.habitaciones (pension_id, tipo, genero, precio_mensual_cop, alimentacion_incluida, disponible)
    values (v_pension, 'compartida', 'femenino', 300000, true, false)
    returning id into v_hab2;
    v_ok := v_hab2 is not null;
    v_detalle := format('habitacion añadida=%s', v_hab2 is not null);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada3 values ('8. Añadir una habitación a mi publicación', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    update public.habitaciones
       set tipo = 'matrimonial', genero = 'mixto', precio_mensual_cop = 450000, alimentacion_incluida = true
     where id = v_hab;
    get diagnostics v_filas = row_count;
    v_ok := (v_filas = 1);
    v_detalle := format('filas=%s (esperado 1)', v_filas);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada3 values ('9. Editar tipo, género, precio y alimentación de una habitación', v_ok, v_detalle);

  -- El precio del anuncio debe seguir derivándose de la habitación más barata libre.
  select precio_mensual into v_precio from public.pensiones where id = v_pension;
  insert into qa_oleada3 values ('10. El precio se sigue derivando al editar la habitación', v_precio = 450000,
    format('precio=%s (esperado 450000 y no el valor anterior 500000)', v_precio));

  begin
    perform set_config('role', 'authenticated', true);
    -- Se intenta reasignar a la MISMA publicación a propósito: así el único
    -- motivo posible de rechazo es el privilegio de columna, y no la RLS ni la
    -- clave foránea. Si el intento más benigno ya se rechaza, reasignar a la
    -- publicación de otro anfitrión queda descartado por completo.
    update public.habitaciones set pension_id = v_pension where id = v_hab;
    get diagnostics v_filas = row_count;
    v_ok := false; v_detalle := format('PERMITIDO: filas=%s (habitación reasignada)', v_filas);
  exception when others then
    v_ok := true; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada3 values ('11. Denegado: reasignar pension_id de una habitación', v_ok, v_detalle);

  -- ------------------------------------------------------------------------
  -- 6) Otro anfitrión no puede editar mi publicación (RLS)
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_otro::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_otro::text, true);
    update public.pensiones set titulo = 'Secuestrada' where id = v_pension;
    get diagnostics v_filas = row_count;
    v_ok := (v_filas = 0);
    v_detalle := format('filas=%s (esperado 0: la RLS lo bloquea)', v_filas);
  exception when others then
    v_ok := true; v_detalle := format('bloqueado por RLS · %s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  insert into qa_oleada3 values ('12. Otro anfitrión NO puede editar mi publicación', v_ok, v_detalle);

  -- ------------------------------------------------------------------------
  -- 7) El panel de disponibilidad sigue operativo
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones set activa = false where id = v_pension;   -- idempotente: ya está retirada
    get diagnostics v_filas = row_count;
    v_ok := (v_filas = 1);
    v_detalle := format('filas=%s (esperado 1)', v_filas);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada3 values ('13. El panel sigue retirando/publicando (activa)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    update public.habitaciones set disponible = true where id = v_hab;  -- idempotente: ya está libre
    get diagnostics v_filas = row_count;
    v_ok := (v_filas = 1);
    v_detalle := format('filas=%s (esperado 1)', v_filas);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada3 values ('14. El panel sigue marcando ocupada/libre (disponible)', v_ok, v_detalle);

  -- ------------------------------------------------------------------------
  -- 8) Quitar una habitación y lectura pública
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    delete from public.habitaciones where id = v_hab2;
    get diagnostics v_filas = row_count;
    v_ok := (v_filas = 1);
    v_detalle := format('filas=%s (esperado 1)', v_filas);
  exception when others then
    v_ok := false; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada3 values ('15. Quitar una habitación de mi publicación', v_ok, v_detalle);

  perform set_config('role', 'anon', true);
  select count(*) into v_anon from public.pensiones;
  perform set_config('role', v_rol, true);
  insert into qa_oleada3 values ('16. anon sigue leyendo el catálogo', v_anon >= 1,
    format('filas visibles para anon=%s (incluye la publicación real; la de prueba está retirada)', v_anon));
end $qa$;

-- Limpieza: ningún rastro de la prueba.
delete from public.habitaciones
 where pension_id in (select id from public.pensiones where titulo like 'Prueba QA oleada 3%');
delete from public.pensiones where titulo like 'Prueba QA oleada 3%';

insert into qa_oleada3
select '17. limpieza sin residuos',
       (select count(*) from public.pensiones where titulo like 'Prueba QA oleada 3%') = 0,
       format('pensiones residuales=%s',
              (select count(*) from public.pensiones where titulo like 'Prueba QA oleada 3%'));

select paso, ok, detalle from qa_oleada3 order by paso;
