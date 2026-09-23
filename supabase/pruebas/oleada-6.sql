-- ============================================================================
-- Pruebas de aceptación de oleada-6.sql (tarea #30)
--
-- Comprueban que la autorización del contacto no depende del formulario: se
-- ejecutan como el rol `authenticated` con las claims del anfitrión dueño, que es
-- exactamente lo que hace un `PATCH` directo contra la API saltándose la interfaz.
--
-- Devuelve una tabla con el resultado de cada comprobación (más útil que los
-- avisos, que algunos clientes no muestran). Todo va dentro de una transacción que
-- termina en `rollback`: no modifica ningún dato.
-- ============================================================================

begin;

create temp table resultados_prueba (orden int, comprobacion text, resultado text) on commit drop;

-- Sin esta concesión, el propio DO falla al anotar el resultado: al simular los
-- roles `authenticated`/`anon`, esos roles no son dueños de la tabla temporal.
-- (Es el mismo tropiezo que dejó documentado la verificación de la tarea #20.)
grant insert, select on resultados_prueba to authenticated, anon;

do $$
declare
  v_uid uuid;
  v_pension uuid;
begin
  select anfitrion_id, id into v_uid, v_pension from public.pensiones limit 1;

  if v_pension is null then
    insert into resultados_prueba values (0, 'Hay una publicación para probar', 'FALLO: no hay datos');
    return;
  end if;

  -- Se actúa como el anfitrión dueño: rol authenticated + sus claims.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 1) Número SIN autorización → la base lo rechaza (23514)
  begin
    update public.pensiones set whatsapp = '3001234567' where id = v_pension;
    insert into resultados_prueba values
      (1, 'Número sin autorización → rechazado', 'FALLO: se publicó sin autorizar');
  exception
    when check_violation then
      insert into resultados_prueba values
        (1, 'Número sin autorización → rechazado', 'OK · 23514 (check_violation)');
  end;

  -- 2) Número CON autorización → se guarda y queda la fecha
  update public.pensiones
     set whatsapp = '3001234567', autorizacion_contacto_en = now()
   where id = v_pension;

  insert into resultados_prueba values (
    2,
    'Con autorización → se guarda y queda la fecha',
    case when (select autorizacion_contacto_en is not null and whatsapp = '3001234567'
                 from public.pensiones where id = v_pension)
         then 'OK · número + fecha registrados'
         else 'FALLO: no se registró' end
  );

  -- 3) Quitar el número lo despublica (la autorización permanece)
  update public.pensiones set whatsapp = null where id = v_pension;

  insert into resultados_prueba values (
    3,
    'Quitar el número → deja de publicarse',
    case when (select whatsapp is null from public.pensiones where id = v_pension)
         then 'OK · whatsapp NULL'
         else 'FALLO: sigue publicado' end
  );

  -- 4) Lo prohibido sigue prohibido para el anfitrión (42501)
  declare
    columna text;
    sentencia text;
  begin
    foreach columna in array array['verificado', 'calificacion', 'precio_mensual', 'anfitrion_id']
    loop
      sentencia := format('update public.pensiones set %I = %s where id = %L',
        columna,
        case columna when 'verificado' then 'true'
                     when 'calificacion' then '5.0'
                     when 'precio_mensual' then '1'
                     else format('%L::uuid', gen_random_uuid()::text) end,
        v_pension);
      begin
        execute sentencia;
        insert into resultados_prueba values
          (4, format('Escribir "%s" sigue prohibido', columna), 'FALLO: se pudo escribir');
      exception
        when insufficient_privilege then
          insert into resultados_prueba values
            (4, format('Escribir "%s" sigue prohibido', columna), 'OK · 42501 (sin privilegio)');
      end;
    end loop;
  end;

  -- 5) Un anónimo no puede publicar un número ni autorizando
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

  begin
    update public.pensiones
       set whatsapp = '3001234567', autorizacion_contacto_en = now()
     where id = v_pension;

    insert into resultados_prueba values (
      5,
      'Un anónimo no puede publicar un número',
      case when (select whatsapp from public.pensiones where id = v_pension) is null
           then 'OK · 0 filas afectadas'
           else 'FALLO: un anónimo publicó un número' end
    );
  exception
    when insufficient_privilege then
      insert into resultados_prueba values
        (5, 'Un anónimo no puede publicar un número', 'OK · 42501 (sin privilegio)');
  end;

  -- 6) Control positivo: el anfitrión SÍ puede escribir la autorización
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

  update public.pensiones set autorizacion_contacto_en = now() where id = v_pension;

  insert into resultados_prueba values (
    6,
    'Control positivo: el anfitrión escribe su autorización',
    case when (select autorizacion_contacto_en is not null from public.pensiones where id = v_pension)
         then 'OK · 1 fila' else 'FALLO: no escribió' end
  );
end $$;

select orden, comprobacion, resultado from resultados_prueba order by orden, comprobacion;

rollback;
