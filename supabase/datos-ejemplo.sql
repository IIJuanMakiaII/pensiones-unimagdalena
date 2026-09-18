-- ============================================================================
-- Datos de ejemplo: las 6 pensiones del catálogo demo, ahora en Supabase.
-- Ejecutar DESPUÉS de esquema.sql y de crear tu primera cuenta de anfitrión
-- (desde /registro). Toma automáticamente el primer anfitrión registrado.
--
-- Es idempotente: si ya existen publicaciones con estos títulos, no duplica.
-- ============================================================================

do $$
declare
  v_anfitrion uuid;
  v_pension uuid;
  v_insertadas integer := 0;
begin
  select id into v_anfitrion
  from public.usuarios
  where rol = 'anfitrion'
  order by creado_en
  limit 1;

  if v_anfitrion is null then
    raise exception 'No hay usuarios anfitriones. Regístrate primero en /registro y vuelve a ejecutar este script.';
  end if;

  -- --------------------------- Pensión Costa Verde ---------------------------
  if not exists (select 1 from public.pensiones where titulo = 'Pensión Costa Verde') then
    insert into public.pensiones (
      anfitrion_id, titulo, descripcion, precio_mensual, direccion, barrio,
      distancia_a_pie_minutos, servicios, normas, imagenes, calificacion, verificado
    ) values (
      v_anfitrion,
      'Pensión Costa Verde',
      'Habitaciones amobladas en Mamatoco, a 7 minutos a pie del campus. WiFi de alta velocidad, aire acondicionado y lavandería; agua y energía incluidas. Ambiente de estudio y sin fumadores.',
      550000,
      'Barrio Mamatoco, Santa Marta',
      'Mamatoco',
      7,
      array['WiFi de alta velocidad', 'Aire acondicionado', 'Lavandería', 'Agua y energía incluidas'],
      array['No fumadores', 'Silencio después de las 10 p. m.', 'Visitas hasta las 8 p. m.'],
      array[
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=900&q=80'
      ],
      4.7, true
    ) returning id into v_pension;
    insert into public.habitaciones (pension_id, tipo, genero, precio_mensual_cop, alimentacion_incluida, disponible) values
      (v_pension, 'individual', 'femenino', 950000, true, true),
      (v_pension, 'individual', 'mixto', 850000, true, true),
      (v_pension, 'compartida', 'femenino', 550000, false, true);
    v_insertadas := v_insertadas + 1;
  end if;

  -- -------------------------- Residencia El Pando --------------------------
  if not exists (select 1 from public.pensiones where titulo = 'Residencia El Pando') then
    insert into public.pensiones (
      anfitrion_id, titulo, descripcion, precio_mensual, direccion, barrio,
      distancia_a_pie_minutos, servicios, normas, imagenes, calificacion, verificado
    ) values (
      v_anfitrion,
      'Residencia El Pando',
      'La opción más cercana al campus: 4 minutos a pie. Cocina compartida con horario, lavandería y servicios incluidos. Habitaciones individuales, compartidas y matrimoniales.',
      480000,
      'Barrio El Pando, Santa Marta',
      'El Pando',
      4,
      array['WiFi', 'Cocina compartida', 'Lavandería', 'Agua y energía incluidas'],
      array['No fumadores', 'Cocina compartida con horario'],
      array[
        'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80'
      ],
      4.5, true
    ) returning id into v_pension;
    insert into public.habitaciones (pension_id, tipo, genero, precio_mensual_cop, alimentacion_incluida, disponible) values
      (v_pension, 'individual', 'masculino', 900000, false, true),
      (v_pension, 'compartida', 'mixto', 480000, false, true),
      (v_pension, 'matrimonial', 'mixto', 1200000, true, true);
    v_insertadas := v_insertadas + 1;
  end if;

  -- --------------------------- Hogar Santa Marta ---------------------------
  if not exists (select 1 from public.pensiones where titulo = 'Hogar Santa Marta') then
    insert into public.pensiones (
      anfitrion_id, titulo, descripcion, precio_mensual, direccion, barrio,
      distancia_a_pie_minutos, servicios, normas, imagenes, calificacion, verificado
    ) values (
      v_anfitrion,
      'Hogar Santa Marta',
      'Alojamiento femenino en Zaragoza, a 10 minutos del campus. Entrada libre 24 horas, lavandería y servicios incluidos. Opción económica en habitación compartida.',
      450000,
      'Barrio Zaragoza, Santa Marta',
      'Zaragoza',
      10,
      array['WiFi', 'Lavandería', 'Agua y energía incluidas'],
      array['No fumadores', 'Entrada libre 24 h'],
      array[
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=900&q=80'
      ],
      4.2, false
    ) returning id into v_pension;
    insert into public.habitaciones (pension_id, tipo, genero, precio_mensual_cop, alimentacion_incluida, disponible) values
      (v_pension, 'individual', 'femenino', 700000, false, true),
      (v_pension, 'compartida', 'femenino', 450000, false, true);
    v_insertadas := v_insertadas + 1;
  end if;

  -- ---------------------------- Pensión La Marina ---------------------------
  if not exists (select 1 from public.pensiones where titulo = 'Pensión La Marina') then
    insert into public.pensiones (
      anfitrion_id, titulo, descripcion, precio_mensual, direccion, barrio,
      distancia_a_pie_minutos, servicios, normas, imagenes, calificacion, verificado
    ) values (
      v_anfitrion,
      'Pensión La Marina',
      'En Gaira, a 12 minutos a pie del campus, con tres comidas al día y horario fijo. Aire acondicionado, WiFi de alta velocidad y lavandería. Servicios y alimentación incluidos.',
      1050000,
      'Barrio Gaira, Santa Marta',
      'Gaira',
      12,
      array['WiFi de alta velocidad', 'Aire acondicionado', '3 comidas al día', 'Lavandería', 'Agua y energía incluidas'],
      array['No fumadores', 'Horario de comidas fijo', 'Visitas los fines de semana'],
      array[
        'https://images.unsplash.com/photo-1571508601891-ca5e7a713859?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'
      ],
      4.8, true
    ) returning id into v_pension;
    insert into public.habitaciones (pension_id, tipo, genero, precio_mensual_cop, alimentacion_incluida, disponible) values
      (v_pension, 'individual', 'femenino', 1100000, true, true),
      (v_pension, 'individual', 'masculino', 1050000, true, true),
      (v_pension, 'matrimonial', 'mixto', 1350000, true, false);
    v_insertadas := v_insertadas + 1;
  end if;

  -- --------------------- Casa Estudiantil San Fernando ---------------------
  if not exists (select 1 from public.pensiones where titulo = 'Casa Estudiantil San Fernando') then
    insert into public.pensiones (
      anfitrion_id, titulo, descripcion, precio_mensual, direccion, barrio,
      distancia_a_pie_minutos, servicios, normas, imagenes, calificacion, verificado
    ) values (
      v_anfitrion,
      'Casa Estudiantil San Fernando',
      'Casa de estudiantes en San Fernando, a 8 minutos caminando. Habitaciones para hombres con servicios incluidos y zonas comunes para estudiar.',
      500000,
      'Barrio San Fernando, Santa Marta',
      'San Fernando',
      8,
      array['WiFi', 'Agua y energía incluidas'],
      array['No fumadores', 'Respetar zonas comunes'],
      array[
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=900&q=80'
      ],
      4.0, false
    ) returning id into v_pension;
    insert into public.habitaciones (pension_id, tipo, genero, precio_mensual_cop, alimentacion_incluida, disponible) values
      (v_pension, 'compartida', 'masculino', 500000, false, true),
      (v_pension, 'individual', 'masculino', 780000, false, true);
    v_insertadas := v_insertadas + 1;
  end if;

  -- ------------------------ Residencias Los Troncos ------------------------
  if not exists (select 1 from public.pensiones where titulo = 'Residencias Los Troncos') then
    insert into public.pensiones (
      anfitrion_id, titulo, descripcion, precio_mensual, direccion, barrio,
      distancia_a_pie_minutos, servicios, normas, imagenes, calificacion, verificado
    ) values (
      v_anfitrion,
      'Residencias Los Troncos',
      'Residencia en Los Troncos, a 15 minutos a pie y bien conectada por transporte. Cocina compartida, lavandería y WiFi de alta velocidad; silencio después de las 11 p. m.',
      520000,
      'Barrio Los Troncos, Santa Marta',
      'Los Troncos',
      15,
      array['WiFi de alta velocidad', 'Lavandería', 'Cocina compartida', 'Agua y energía incluidas'],
      array['No fumadores', 'Silencio después de las 11 p. m.'],
      array[
        'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=80'
      ],
      4.6, true
    ) returning id into v_pension;
    insert into public.habitaciones (pension_id, tipo, genero, precio_mensual_cop, alimentacion_incluida, disponible) values
      (v_pension, 'individual', 'mixto', 820000, true, true),
      (v_pension, 'compartida', 'femenino', 520000, false, true),
      (v_pension, 'individual', 'femenino', 880000, false, false);
    v_insertadas := v_insertadas + 1;
  end if;

  raise notice 'Pensiones insertadas: % (anfitrión %)', v_insertadas, v_anfitrion;
end $$;

-- Verificación
select
  (select count(*) from public.pensiones)  as pensiones,
  (select count(*) from public.habitaciones) as habitaciones;
