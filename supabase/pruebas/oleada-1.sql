-- Verificación funcional de la Oleada 1 (se ejecuta y se limpia sola).
drop table if exists qa_oleada1;
create temp table qa_oleada1 (paso text, ok boolean, detalle text);

do $qa$
declare
  v_id uuid;
  v_precio integer;
  v_num integer;
  v_uid uuid;
begin
  -- La función exige sesión (auth.uid()). Se simulan las claims del JWT para que
  -- la prueba ejercite la lógica real y no se quede en el "Sesión requerida".
  select id into v_uid from auth.users order by created_at limit 1;

  if v_uid is null then
    insert into qa_oleada1 values ('0. usuario de prueba', false, 'no hay usuarios en auth.users');
    return;
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_uid::text, 'role', 'authenticated')::text,
    true
  );

  -- 1-2) Creación completa y precio derivado de la habitación disponible más barata.
  begin
    v_id := public.crear_pension_con_habitaciones(
      jsonb_build_object(
        'titulo', 'Prueba QA oleada 1',
        'descripcion', 'Verificacion automatica de la funcion transaccional.',
        'direccion', 'Calle 30 # 12-45',
        'barrio', 'Mamatoco',
        'distancia_a_pie_minutos', 8,
        'servicios', jsonb_build_array('WiFi de alta velocidad'),
        'normas', jsonb_build_array('No fumadores'),
        'imagenes', jsonb_build_array(),
        'activa', true
      ),
      jsonb_build_array(
        jsonb_build_object('tipo', 'compartida', 'genero', 'femenino', 'precio_mensual_cop', 650000, 'alimentacion_incluida', true, 'disponible', true),
        jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 480000, 'alimentacion_incluida', false, 'disponible', true),
        jsonb_build_object('tipo', 'individual', 'genero', 'masculino', 'precio_mensual_cop', 300000, 'alimentacion_incluida', false, 'disponible', false)
      )
    );

    select precio_mensual into v_precio from public.pensiones where id = v_id;
    select count(*) into v_num from public.habitaciones where pension_id = v_id;

    insert into qa_oleada1 values ('1. crea pension + habitaciones', v_num = 3, format('habitaciones=%s (esperado 3)', v_num));
    insert into qa_oleada1 values ('2. precio = mas barata DISPONIBLE', v_precio = 480000, format('precio=%s (esperado 480000; 300000 esta ocupada)', v_precio));
  exception when others then
    insert into qa_oleada1 values ('1-2. creacion', false, sqlerrm);
  end;

  -- 3) Candado: una pensión no puede quedar sin habitaciones.
  begin
    perform public.crear_pension_con_habitaciones(
      jsonb_build_object('titulo', 'Sin habitaciones'), '[]'::jsonb
    );
    insert into qa_oleada1 values ('3. bloquea pension sin habitaciones', false, 'permitio publicar sin habitaciones');
  exception when others then
    insert into qa_oleada1 values ('3. bloquea pension sin habitaciones', true, sqlerrm);
  end;

  -- 4) Candado: precio fuera del rango permitido.
  begin
    perform public.crear_pension_con_habitaciones(
      jsonb_build_object('titulo', 'Precio fuera de rango'),
      jsonb_build_array(jsonb_build_object('tipo', 'individual', 'genero', 'mixto', 'precio_mensual_cop', 99000000, 'disponible', true))
    );
    insert into qa_oleada1 values ('4. bloquea precio fuera de rango', false, 'acepto 99000000');
  exception when others then
    insert into qa_oleada1 values ('4. bloquea precio fuera de rango', true, sqlerrm);
  end;

  -- 5) Candado: género fuera del catálogo.
  begin
    perform public.crear_pension_con_habitaciones(
      jsonb_build_object('titulo', 'Genero invalido'),
      jsonb_build_array(jsonb_build_object('tipo', 'individual', 'genero', 'otro', 'precio_mensual_cop', 400000, 'disponible', true))
    );
    insert into qa_oleada1 values ('5. bloquea genero invalido', false, 'acepto el genero "otro"');
  exception when others then
    insert into qa_oleada1 values ('5. bloquea genero invalido', true, sqlerrm);
  end;
end $qa$;

-- Limpieza: no debe quedar ningún rastro de la prueba.
delete from public.habitaciones
where pension_id in (select id from public.pensiones where titulo = 'Prueba QA oleada 1');
delete from public.pensiones where titulo = 'Prueba QA oleada 1';

insert into qa_oleada1
select '6. limpieza sin residuos',
       (select count(*) from public.pensiones where titulo like 'Prueba QA%') = 0,
       format('residuos=%s', (select count(*) from public.pensiones where titulo like 'Prueba QA%'));

-- Última sentencia: es la que devuelve el MCP.
select paso, ok, detalle from qa_oleada1 order by paso;
