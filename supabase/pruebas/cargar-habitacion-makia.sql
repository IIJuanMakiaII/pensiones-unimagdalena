-- Carga la habitación que le faltaba a la publicación real «Residencia Makia».
--
-- Datos MÍNIMOS y conservadores, derivados de lo que el anuncio ya declara:
--   · precio  → el `precio_mensual` que la publicación ya tenía (no se inventa)
--   · tipo    → individual (lo más habitual y lo menos restrictivo)
--   · género  → mixto (no excluye a nadie; el anfitrión lo confirma)
--   · alimentación → no incluida (no se promete nada que no esté pactado)
--   · disponible → sí (es el estado actual: el anuncio se está ofreciendo)
--
-- Guardas: solo actúa si la publicación existe y NO tiene ya habitaciones, así
-- que ejecutarlo dos veces no duplica nada.
do $qa$
declare
  v_pension uuid;
  v_precio integer;
  v_existentes integer;
begin
  select id, precio_mensual into v_pension, v_precio
  from public.pensiones where titulo ilike '%Makia%' limit 1;

  if v_pension is null then
    raise exception 'No se encontro la publicacion «Residencia Makia»';
  end if;

  select count(*) into v_existentes from public.habitaciones where pension_id = v_pension;

  if v_existentes > 0 then
    raise exception 'La publicacion ya tiene % habitaciones: no se toca nada', v_existentes;
  end if;

  insert into public.habitaciones
    (pension_id, tipo, genero, precio_mensual_cop, alimentacion_incluida, disponible)
  values
    (v_pension, 'individual', 'mixto', v_precio, false, true);
end $qa$;

select 'QARESULT|' || p.titulo
  || '|precio=' || p.precio_mensual
  || '|habitaciones=' || (select count(*) from public.habitaciones h where h.pension_id = p.id)
  || '|libres=' || (select count(*) from public.habitaciones h where h.pension_id = p.id and h.disponible)
  || '|tipos=' || (select string_agg(h.tipo || '/' || h.genero || '/' || h.precio_mensual_cop, ', ')
                   from public.habitaciones h where h.pension_id = p.id)
  as r
from public.pensiones p where p.titulo ilike '%Makia%';
