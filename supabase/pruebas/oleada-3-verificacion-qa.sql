-- Verificación QA (tarea #20) del camino de escritura del editor de publicaciones.
--
-- Comprueba sobre la base real, cambiando de rol y con las claims del JWT:
--   1. El dueño SÍ actualiza los campos editables (control positivo).
--   2. Otro anfitrión NO puede (0 filas) y un anónimo tampoco.
--   3. `verificado`, `calificacion`, `precio_mensual` y `anfitrion_id` siguen PROHIBIDOS (42501).
--   4. La reconciliación de habitaciones conserva el estado de las que no se tocan.
--   5. Los límites de la base rechazan valores fuera de rango.
-- No toca ningún dato real: crea una publicación temporal y la borra al final.

create temp table if not exists qa_editor (paso text, ok boolean, detalle text);
truncate qa_editor;
-- La tabla temporal la crea el rol de administración, pero el script cambia de
-- rol a mitad (authenticated / anon) para probar la autorización. Sin este
-- permiso, los INSERT del propio registro fallan y el bloque se revierte.
grant all on table qa_editor to authenticated, anon;

do $qa$
declare
  v_dueno uuid;
  v_ajeno uuid := '22222222-2222-4222-8222-222222222222';
  v_pension uuid;
  v_filas integer;
  v_h4 uuid;          -- habitación que NO se toca
  v_h5 uuid;          -- habitación que se ocupa
  v_libres integer;
  v_ocupadas integer;
begin
  select id into v_dueno from auth.users order by created_at limit 1;
  if v_dueno is null then
    insert into qa_editor values ('0. usuario', false, 'no hay usuarios');
    return;
  end if;

  /* ---- Preparación: publicación temporal con 2 habitaciones libres ---- */
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_dueno::text, 'role', 'authenticated')::text, true);

  delete from public.habitaciones where pension_id in
    (select id from public.pensiones where titulo = 'Prueba QA editor');
  delete from public.pensiones where titulo = 'Prueba QA editor';

  v_pension := public.crear_pension_con_habitaciones(
    jsonb_build_object(
      'titulo', 'Prueba QA editor',
      'descripcion', 'Publicacion temporal de verificacion QA del editor de publicaciones.',
      'direccion', 'Calle 30 # 12-45', 'barrio', 'Mamatoco',
      'distancia_a_pie_minutos', 7,
      'servicios', jsonb_build_array('WiFi de alta velocidad'),
      'normas', jsonb_build_array('No fumadores'),
      'imagenes', jsonb_build_array(),
      'activa', true
    ),
    jsonb_build_array(
      jsonb_build_object('tipo','individual','genero','mixto','precio_mensual_cop',500000,'alimentacion_incluida',false,'disponible',true),
      jsonb_build_object('tipo','compartida','genero','femenino','precio_mensual_cop',350000,'alimentacion_incluida',true,'disponible',true)
    )
  );
  insert into qa_editor values ('0. publicacion temporal creada', v_pension is not null, v_pension::text);

  select id into v_h4 from public.habitaciones where pension_id = v_pension order by precio_mensual_cop desc limit 1;
  select id into v_h5 from public.habitaciones where pension_id = v_pension order by precio_mensual_cop asc limit 1;

  /* ---- 1. El dueño edita los campos del editor (control positivo) ---- */
  perform set_config('role', 'authenticated', true);
  begin
    update public.pensiones set
      titulo = 'Prueba QA editor (editado)',
      descripcion = 'Descripcion editada por el dueno para la verificacion.',
      direccion = 'Carrera 5 # 10-20',
      barrio = 'Centro',
      distancia_a_pie_minutos = 12,
      /* `servicios`, `normas` e `imagenes` son text[], no jsonb: la RPC de
         creación recibe jsonb y castea dentro, pero un UPDATE directo no. */
      servicios = array['WiFi de alta velocidad', 'Agua caliente'],
      normas = array['No fumadores'],
      imagenes = array['https://ejemplo.test/foto.jpg'],
      whatsapp = '3109876543'
    where id = v_pension;
    get diagnostics v_filas = row_count;
    insert into qa_editor values ('1. el dueno edita 9 campos editables', v_filas = 1, 'filas=' || v_filas);
  exception when others then
    insert into qa_editor values ('1. el dueno edita 9 campos editables', false, sqlerrm);
  end;

  /* ---- 2. Otro anfitrión NO puede editar esa publicación ---- */
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_ajeno::text, 'role', 'authenticated')::text, true);
  begin
    update public.pensiones set titulo = 'Secuestrado' where id = v_pension;
    get diagnostics v_filas = row_count;
    insert into qa_editor values ('2. otro anfitrion NO puede editar', v_filas = 0, 'filas=' || v_filas);
  exception when others then
    insert into qa_editor values ('2. otro anfitrion NO puede editar', true, 'denegado: ' || sqlerrm);
  end;

  /* ---- 3. Un anónimo tampoco ---- */
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  perform set_config('role', 'anon', true);
  begin
    update public.pensiones set titulo = 'Anonimo' where id = v_pension;
    get diagnostics v_filas = row_count;
    insert into qa_editor values ('3. un anonimo NO puede editar', v_filas = 0, 'filas=' || v_filas);
  exception when others then
    insert into qa_editor values ('3. un anonimo NO puede editar', true, 'denegado: ' || sqlerrm);
  end;

  /* ---- 4. Lo prohibido sigue prohibido (con el dueño de vuelta) ---- */
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_dueno::text, 'role', 'authenticated')::text, true);

  begin
    update public.pensiones set verificado = true where id = v_pension;
    insert into qa_editor values ('4a. sigue prohibido: verificado', false, 'SE PERMITIO');
  exception when others then
    insert into qa_editor values ('4a. sigue prohibido: verificado', true, sqlerrm);
  end;

  begin
    update public.pensiones set calificacion = 5.0 where id = v_pension;
    insert into qa_editor values ('4b. sigue prohibido: calificacion', false, 'SE PERMITIO');
  exception when others then
    insert into qa_editor values ('4b. sigue prohibido: calificacion', true, sqlerrm);
  end;

  begin
    update public.pensiones set precio_mensual = 1000 where id = v_pension;
    insert into qa_editor values ('4c. sigue prohibido: precio_mensual', false, 'SE PERMITIO');
  exception when others then
    insert into qa_editor values ('4c. sigue prohibido: precio_mensual', true, sqlerrm);
  end;

  begin
    update public.pensiones set anfitrion_id = v_ajeno where id = v_pension;
    insert into qa_editor values ('4d. sigue prohibido: anfitrion_id (transferir)', false, 'SE PERMITIO');
  exception when others then
    insert into qa_editor values ('4d. sigue prohibido: anfitrion_id (transferir)', true, sqlerrm);
  end;

  /* ---- 5. Reconciliación de habitaciones ---- */
  perform set_config('role', 'authenticated', true);
  begin
    -- Se ocupa una y se añade otra; la tercera (v_h4) no se toca.
    update public.habitaciones set disponible = false where id = v_h5;
    insert into public.habitaciones (pension_id, tipo, genero, precio_mensual_cop, alimentacion_incluida, disponible)
    values (v_pension, 'matrimonial', 'mixto', 700000, false, true);

    select count(*) filter (where disponible), count(*) filter (where not disponible)
      into v_libres, v_ocupadas
    from public.habitaciones where pension_id = v_pension;

    insert into qa_editor values ('5a. anadir y ocupar habitaciones', v_libres = 2 and v_ocupadas = 1,
      format('libres=%s ocupadas=%s', v_libres, v_ocupadas));

    insert into qa_editor values ('5b. la habitacion no tocada conserva su estado',
      (select disponible from public.habitaciones where id = v_h4),
      'v_h4.disponible=' || (select disponible::text from public.habitaciones where id = v_h4));

    -- Quitar una habitación (lo que hace el editor al borrar una fila).
    delete from public.habitaciones where id = v_h5;
    insert into qa_editor values ('5c. quitar una habitacion',
      (select count(*) from public.habitaciones where pension_id = v_pension) = 2,
      'restantes=' || (select count(*) from public.habitaciones where pension_id = v_pension));

    insert into qa_editor values ('5d. el precio de la pension se deriva de las libres',
      (select precio_mensual from public.pensiones where id = v_pension) = 500000,
      'precio=' || (select precio_mensual from public.pensiones where id = v_pension));
  exception when others then
    insert into qa_editor values ('5. reconciliacion de habitaciones', false, sqlerrm);
  end;

  /* ---- 6. Límites de la base ---- */
  begin
    update public.pensiones set descripcion = repeat('x', 2001) where id = v_pension;
    insert into qa_editor values ('6a. rechaza descripcion de 2001 caracteres', false, 'SE PERMITIO');
  exception when others then
    insert into qa_editor values ('6a. rechaza descripcion de 2001 caracteres', true, sqlerrm);
  end;

  begin
    update public.pensiones set imagenes = array['a','b','c','d','e','f','g','h','i'] where id = v_pension;
    insert into qa_editor values ('6b. rechaza 9 fotos', false, 'SE PERMITIO');
  exception when others then
    insert into qa_editor values ('6b. rechaza 9 fotos', true, sqlerrm);
  end;

  begin
    update public.pensiones set whatsapp = '310987654' where id = v_pension;
    insert into qa_editor values ('6c. rechaza whatsapp de 9 digitos', false, 'SE PERMITIO');
  exception when others then
    insert into qa_editor values ('6c. rechaza whatsapp de 9 digitos', true, sqlerrm);
  end;

  begin
    update public.pensiones set whatsapp = '+57 310 987 6543' where id = v_pension;
    insert into qa_editor values ('6d. rechaza whatsapp sin normalizar', false, 'SE PERMITIO');
  exception when others then
    insert into qa_editor values ('6d. rechaza whatsapp sin normalizar', true, sqlerrm);
  end;

  /* ---- Limpieza ---- */
  delete from public.habitaciones where pension_id = v_pension;
  delete from public.pensiones where id = v_pension;
exception when others then
  insert into qa_editor values ('ERROR GENERAL', false, sqlerrm);
end $qa$;

insert into qa_editor
select '7. limpieza sin residuos',
       (select count(*) from public.pensiones where titulo like 'Prueba QA%') = 0,
       'residuos=' || (select count(*) from public.pensiones where titulo like 'Prueba QA%');

insert into qa_editor
select '8. el dato real sigue intacto',
       (select count(*) from public.pensiones where titulo ilike '%Makia%') = 1,
       'Makia: activa=' || (select activa::text from public.pensiones where titulo ilike '%Makia%')
       || ' whatsapp=' || coalesce((select whatsapp from public.pensiones where titulo ilike '%Makia%'), 'null')
       || ' habitaciones=' || (select count(*) from public.habitaciones h
                               join public.pensiones p on p.id = h.pension_id
                               where p.titulo ilike '%Makia%');

select 'QARESULT|' || string_agg(paso || ' => ' || case when ok then 'OK' else 'FALLO' end || ' (' || left(detalle, 60) || ')', ' || ' order by paso) as r
from qa_editor;
