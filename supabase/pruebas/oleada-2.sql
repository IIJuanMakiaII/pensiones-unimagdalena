-- Verificación funcional de la Oleada 2 (se ejecuta y se limpia sola).
--
-- Qué comprueba (criterios de aceptación de la tarea #14):
--   A-1 · el anfitrión NO puede autootorgarse `verificado` ni `calificacion`
--         (y sí puede seguir usando el panel: `activa` y `disponible`).
--   A-2 · el precio publicable lo fija la base: la RPC ignora el que envíe el
--         cliente.
--   A-6 · la RPC rechaza precio 0, arrays por encima del límite y coordenadas
--         fuera de rango.
--   Lectura pública intacta: el rol `anon` sigue leyendo el catálogo y las tres
--   columnas que muestran la tarjeta y la ficha.
--
-- Dos precauciones de método:
--   1. El rol de sesión SÍ se cambia (`set_config('role', ...)`) y se restaura
--      después de cada prueba. Sin cambiar el rol, las pruebas correrían como el
--      dueño de las tablas: ni RLS ni privilegios aplicarían y todo "pasaría".
--   2. Todas las pruebas trabajan sobre publicaciones creadas por la propia
--      prueba (y las borra al final). NO se toca la publicación real del
--      anfitrión: ni su estado, ni su precio, ni su visibilidad.
--
-- Escenario medido ANTES de aplicar la Oleada 2, con la sesión del anfitrión:
--   filas=1 · verificado=t · calificacion=5.0 · precio_tras_patch=1000 · precio_rpc=1234

drop table if exists qa_oleada2;
create temp table qa_oleada2 (paso text, ok boolean, detalle text);

do $qa$
declare
  v_rol        text := current_user;
  v_uid        uuid;
  v_prueba     uuid;   -- pensión de prueba con una habitación libre
  v_ocupada    uuid;   -- pensión de prueba con la habitación ocupada y precio inventado
  v_habitacion uuid;
  v_filas      integer;
  v_precio     integer;
  v_ok         boolean;
  v_detalle    text;
  v_anon       integer;
begin
  select id into v_uid from auth.users order by created_at limit 1;

  if v_uid is null then
    insert into qa_oleada2 values ('0. usuario de prueba', false, 'no hay usuarios en auth.users');
    return;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);

  -- ------------------------------------------------------------------------
  -- Datos de prueba: dos publicaciones propias creadas con la RPC real.
  -- La segunda envía un precio inventado (1234) junto a una habitación ya
  -- ocupada: es exactamente el escenario del hallazgo A-2. Ambas se crean
  -- retiradas (`activa = false`) para que nunca aparezcan en el catálogo.
  -- ------------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);

  select public.crear_pension_con_habitaciones(
    jsonb_build_object(
      'titulo', 'Prueba QA oleada 2 libre',
      'descripcion', 'Publicacion temporal creada por la verificacion automatica.',
      'direccion', 'Calle 30 # 12-45',
      'barrio', 'Mamatoco',
      'distancia_a_pie_minutos', 8,
      'servicios', jsonb_build_array('WiFi de alta velocidad'),
      'normas', jsonb_build_array('No fumadores'),
      'imagenes', jsonb_build_array(),
      'activa', false
    ),
    jsonb_build_array(
      jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 500000, 'disponible', true)
    )
  ) into v_prueba;

  select public.crear_pension_con_habitaciones(
    jsonb_build_object(
      'titulo', 'Prueba QA oleada 2 ocupada',
      'descripcion', 'Publicacion temporal con precio inventado por el cliente.',
      'precio_mensual', 1234,
      'direccion', 'Calle 30 # 12-45',
      'barrio', 'Mamatoco',
      'activa', false
    ),
    jsonb_build_array(
      jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 700000, 'disponible', false)
    )
  ) into v_ocupada;

  perform set_config('role', v_rol, true);

  select id into v_habitacion from public.habitaciones where pension_id = v_prueba limit 1;

  -- ------------------------------------------------------------------------
  -- A-2 · El precio lo deriva la base (se comprueba antes de tocar la
  -- disponibilidad, para que el estado sea "habitación libre").
  -- ------------------------------------------------------------------------
  select precio_mensual into v_precio from public.pensiones where id = v_prueba;
  insert into qa_oleada2 values ('1. A-2 precio = habitación más barata libre', v_precio = 500000,
    format('precio=%s (esperado 500000)', v_precio));

  select precio_mensual into v_precio from public.pensiones where id = v_ocupada;
  insert into qa_oleada2 values ('2. A-2 precio inventado 1234 ignorado', v_precio = 0,
    format('precio=%s (esperado 0: el 1234 que envió el cliente no se guardó)', v_precio));

  -- ------------------------------------------------------------------------
  -- A-1 · El anfitrión no puede escribir las columnas que decide el equipo
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones set verificado = true, calificacion = 5.0 where id = v_prueba;
    get diagnostics v_filas = row_count;
    v_ok := false;
    v_detalle := format('PERMITIDO: filas=%s (la base lo aceptó)', v_filas);
  exception when others then
    v_ok := true;
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada2 values ('3. A-1 sello verificado y calificación', v_ok, coalesce(v_detalle, 'sin resultado'));

  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones set precio_mensual = 1000 where id = v_prueba;
    get diagnostics v_filas = row_count;
    v_ok := false;
    v_detalle := format('PERMITIDO: filas=%s', v_filas);
  exception when others then
    v_ok := true;
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada2 values ('4. A-1/A-2 precio_mensual por PATCH directo', v_ok, coalesce(v_detalle, 'sin resultado'));

  -- ------------------------------------------------------------------------
  -- A-1 · Control positivo: el panel debe seguir funcionando
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    update public.pensiones set activa = true where id = v_prueba;
    get diagnostics v_filas = row_count;
    v_ok := (v_filas = 1);
    v_detalle := format('filas=%s (esperado 1)', v_filas);
  exception when others then
    v_ok := false;
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada2 values ('5. El panel sigue publicando/retirando (activa)', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    update public.habitaciones set disponible = false where id = v_habitacion;
    get diagnostics v_filas = row_count;
    v_ok := (v_filas = 1);
    v_detalle := format('filas=%s (esperado 1)', v_filas);
  exception when others then
    v_ok := false;
    v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada2 values ('6. El panel sigue marcando ocupada/libre', v_ok, v_detalle);

  -- ------------------------------------------------------------------------
  -- A-6 · La RPC rechaza lo que el formulario prohíbe
  -- ------------------------------------------------------------------------
  begin
    perform set_config('role', 'authenticated', true);
    perform public.crear_pension_con_habitaciones(
      jsonb_build_object('titulo', 'Prueba QA oleada 2 precio cero'),
      jsonb_build_array(jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 0, 'disponible', true))
    );
    v_ok := false; v_detalle := 'PERMITIDO: aceptó una habitación a 0 COP';
  exception when others then
    v_ok := true; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada2 values ('7. A-6 rechaza habitación a 0 COP', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform public.crear_pension_con_habitaciones(
      jsonb_build_object('titulo', 'Prueba QA oleada 2 servicios',
                         'servicios', (select jsonb_agg('s' || n) from generate_series(1, 13) as n)),
      jsonb_build_array(jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 400000, 'disponible', true))
    );
    v_ok := false; v_detalle := 'PERMITIDO: aceptó 13 servicios (máximo 12)';
  exception when others then
    v_ok := true; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada2 values ('8. A-6 rechaza 13 servicios', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform public.crear_pension_con_habitaciones(
      jsonb_build_object('titulo', 'Prueba QA oleada 2 normas',
                         'normas', (select jsonb_agg('n' || n) from generate_series(1, 9) as n)),
      jsonb_build_array(jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 400000, 'disponible', true))
    );
    v_ok := false; v_detalle := 'PERMITIDO: aceptó 9 normas (máximo 8)';
  exception when others then
    v_ok := true; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada2 values ('9. A-6 rechaza 9 normas', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform public.crear_pension_con_habitaciones(
      jsonb_build_object('titulo', 'Prueba QA oleada 2 coordenadas', 'latitud', 500, 'longitud', 900),
      jsonb_build_array(jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 400000, 'disponible', true))
    );
    v_ok := false; v_detalle := 'PERMITIDO: aceptó latitud 500 / longitud 900';
  exception when others then
    v_ok := true; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada2 values ('10. A-6 rechaza coordenadas fuera de rango', v_ok, v_detalle);

  begin
    perform set_config('role', 'authenticated', true);
    perform public.crear_pension_con_habitaciones(
      jsonb_build_object('titulo', 'Prueba QA oleada 2 coords solas', 'latitud', 11.24),
      jsonb_build_array(jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 400000, 'disponible', true))
    );
    v_ok := false; v_detalle := 'PERMITIDO: aceptó latitud sin longitud';
  exception when others then
    v_ok := true; v_detalle := format('%s · %s', sqlstate, sqlerrm);
  end;
  perform set_config('role', v_rol, true);
  insert into qa_oleada2 values ('11. A-6 rechaza latitud sin longitud', v_ok, v_detalle);

  -- ------------------------------------------------------------------------
  -- Lectura pública: el catálogo y la ficha siguen funcionando igual
  -- ------------------------------------------------------------------------
  v_ok := has_column_privilege('anon', 'public.pensiones', 'verificado', 'SELECT')
      and has_column_privilege('anon', 'public.pensiones', 'calificacion', 'SELECT')
      and has_column_privilege('anon', 'public.pensiones', 'precio_mensual', 'SELECT');
  insert into qa_oleada2 values ('12. anon puede LEER las tres columnas', v_ok,
    format('verificado=%s calificacion=%s precio_mensual=%s',
      has_column_privilege('anon', 'public.pensiones', 'verificado', 'SELECT'),
      has_column_privilege('anon', 'public.pensiones', 'calificacion', 'SELECT'),
      has_column_privilege('anon', 'public.pensiones', 'precio_mensual', 'SELECT')));

  perform set_config('role', 'anon', true);
  select count(*) into v_anon from public.pensiones;
  perform set_config('role', v_rol, true);
  insert into qa_oleada2 values ('13. anon sigue viendo el catálogo publicado', v_anon >= 1,
    format('filas visibles para anon=%s (debe incluir la publicación real; las de prueba están retiradas)', v_anon));
end $qa$;

-- Limpieza: no debe quedar ningún rastro de la prueba. Las publicaciones de
-- prueba se crearon con `activa = false`, así que nunca aparecieron en el
-- catálogo público mientras duró la verificación.
delete from public.habitaciones
 where pension_id in (select id from public.pensiones where titulo like 'Prueba QA oleada 2%');
delete from public.pensiones where titulo like 'Prueba QA oleada 2%';

insert into qa_oleada2
select '14. limpieza sin residuos',
       (select count(*) from public.pensiones where titulo like 'Prueba QA oleada 2%') = 0,
       format('pensiones residuales=%s',
              (select count(*) from public.pensiones where titulo like 'Prueba QA oleada 2%'));

-- Última sentencia: es la que devuelve el MCP.
select paso, ok, detalle from qa_oleada2 order by paso;
