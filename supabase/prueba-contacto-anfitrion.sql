-- =====================================================================
--  DATO DE PRUEBA — no es una migración, no forma parte de ninguna oleada
-- =====================================================================
--
--  QUÉ HACE
--  --------
--  Escribe un número de WhatsApp **de prueba** en `public.contacto_anfitrion`
--  para el propietario del único anuncio registrado hoy, de modo que la tarjeta
--  «WhatsApp privado del anfitrión» y el botón «Escribir al anfitrión» tengan
--  algo que mostrar. La tabla está vacía, así que ese camino no se ha recorrido
--  nunca con un número dentro.
--
--  POR QUÉ ESTE ARCHIVO EXISTE
--  ---------------------------
--  No se puede aplicar desde la cuenta del equipo: la clave anónima del sitio
--  no tiene ningún `grant` sobre esta tabla —es el diseño de `oleada-15`, y la
--  API responde `401 42501` antes de evaluar siquiera las políticas—, y el MCP
--  responde `site_owner_denied` porque la cuenta no es propietaria del sitio.
--  Lo aplica el propietario en el editor SQL del panel, como siempre.
--
--  EL NÚMERO ELEGIDO, Y POR QUÉ
--  ----------------------------
--  `3000000000` — un `3` seguido de nueve ceros.
--
--    · Cumple el patrón que exige la tabla y el código, `^(3[0-9]{9}|60[0-9]{8})$`,
--      así que la restricción `contacto_anfitrion_whatsapp_formato` lo acepta.
--    · Es imposible confundirlo con el número de una persona: nadie tiene nueve
--      ceros. Es el punto entero de elegirlo así. Un número «creíble» de prueba
--      —`3001234567`, que además es el marcador del formulario— podría pertenecer
--      a alguien real, y entonces una prueba se convierte en una llamada.
--    · `https://wa.me/573000000000` se construye bien pero no lleva a ningún
--      sitio: sirve para comprobar que el enlace se arma, sin molestar a nadie.
--
--  CÓMO SE APLICA
--  --------------
--  Pegar todo esto en el editor SQL del panel de Supabase y ejecutar. Es
--  idempotente: si se ejecuta dos veces, la segunda actualiza en vez de duplicar
--  (la clave primaria es `anfitrion_id`, una fila por persona y no por anuncio).
--
--  Lo único que hay que saber antes: `f101e4d0-5312-4d96-8d2c-c67e03f9cc1d` es
--  el `anfitrion_id` del anuncio `f555e5b3-6629-402a-ae37-32c366c3f022`
--  («Residencia 101 (Pension de Prueba)», slug `residencia-makia`), medido contra
--  la base del proyecto `ayznnqkacpdvvufclhon` el 2026-10-12. Si algún día se
--  publica otro anuncio, **este identificador es el que hay que cambiar**, no el
--  número.
--
--  Las fechas no se escriben aquí a propósito: `creado_en` y `actualizado_en` las
--  sella el disparador `antes_de_tocar_contacto`. Lo que se envíe se ignora.

begin;

insert into public.contacto_anfitrion (anfitrion_id, whatsapp)
values ('f101e4d0-5312-4d96-8d2c-c67e03f9cc1d', '3000000000')
on conflict (anfitrion_id)
do update set whatsapp = excluded.whatsapp;

commit;

-- =====================================================================
--  COMPROBACIÓN (solo lectura) — ejecutar aparte, después del commit
-- =====================================================================
--
--  Debe devolver **una** fila con el número 3000000000. Si devuelve 0 filas, el
--  insert no entró; si devuelve un número distinto, había ya un dato previo y lo
--  acaba de sustituir (y conviene saber por qué estaba ahí).
--
--  select anfitrion_id, whatsapp, creado_en, actualizado_en
--  from public.contacto_anfitrion;
--
--  Y la prueba que importa, la de que sigue siendo privado — desde una terminal
--  con la clave anónima del sitio, debe seguir respondiendo `401 42501`:
--
--  curl -s -o /dev/null -w "%{http_code}\n" \
--    -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
--    -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
--    "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/contacto_anfitrion?select=whatsapp&limit=1"
--
--  Si esa consulta devolviera el número, algo se habría roto de verdad.

-- =====================================================================
--  REVERSIÓN — el dato de prueba se retira, y con él el botón
-- =====================================================================
--
--  begin;
--  delete from public.contacto_anfitrion
--   where anfitrion_id = 'f101e4d0-5312-4d96-8d2c-c67e03f9cc1d'
--     and whatsapp = '3000000000';
--  commit;
--
--  Se borra por la pareja identificador + número, y no solo por el número, para
--  no llevarse por delante un número real que se hubiera escrito entre tanto:
--  si alguien ya dejó el suyo, esto no lo toca y borra cero filas.
