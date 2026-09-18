-- Estado de la publicación real antes de cargarle habitaciones.
select json_build_object(
  'id', p.id,
  'titulo', p.titulo,
  'barrio', p.barrio,
  'precio_mensual', p.precio_mensual,
  'distancia_a_pie_minutos', p.distancia_a_pie_minutos,
  'servicios', p.servicios,
  'normas', p.normas,
  'imagenes', cardinality(p.imagenes),
  'verificado', p.verificado,
  'activa', p.activa,
  'habitaciones', (select count(*) from public.habitaciones h where h.pension_id = p.id)
) as ficha
from public.pensiones p
where p.titulo ilike '%Makia%';
