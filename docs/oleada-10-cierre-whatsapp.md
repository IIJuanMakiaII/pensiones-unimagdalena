# Oleada 10 — Cerrar la lectura pública del teléfono del propietario (tarea #47)

**Estado: NO APLICADA.** El archivo está escrito, la comprobación está ejecutada y la
exposición está **reproducida en vivo** contra la base real. Lo único que falta es que el
fundador ejecute el SQL, porque desde el entorno del equipo no se puede tocar la base: la
única credencial disponible es la clave pública y no hay herramienta de Postgres sobre este
proyecto.

Archivos:

| Archivo | Qué es |
|---|---|
| `supabase/oleada-10-cerrar-whatsapp.sql` | La migración mínima, con su efecto explicado dentro |
| `scripts/verificar-exposicion-propietario.mjs` | Comprobación de solo lectura, sirve antes y después |
| `package.json` | `npm run verificar:exposicion-propietario` (una línea añadida) |

---

## 1. Qué está pasando hoy (medido, no supuesto)

`npm run verificar:exposicion-propietario` contra `ayznnqkacpdvvufclhon.supabase.co`, con la
misma clave pública que viaja al navegador:

```
OK     catálogo público      HTTP 200 · anuncios activos leídos: 1
OK     ficha por dirección   HTTP 200 · «residencia-makia» resuelta: 1
FALLA  whatsapp  (teléfono del propietario)                 HTTP 200 · abierto
        └─ filas con un valor guardado: 0 (el valor no se imprime)
FALLA  autorizacion_contacto_en  (fecha en que autorizó publicarlo) HTTP 200 · abierto
        └─ filas con un valor guardado: 0 (el valor no se imprime)
FALLA  comodín «select=*»      HTTP 200 · abierto
```

Lectura honesta de eso: **no se ha filtrado nada** —hay 0 filas con número guardado— pero
cualquiera puede pedir la columna. No es una fuga: es una puerta abierta. La única
mitigación que existe hoy es de la aplicación (la consulta del sitio no pide esa columna,
`lib/supabase/mapeo.ts`), y una mitigación de la aplicación no cierra una API: quien consulte
la API directamente no pasa por la aplicación.

## 2. El SQL exacto a pegar

Copiar tal cual en Supabase → SQL Editor → Run. Son cuatro sentencias; el archivo completo
(`supabase/oleada-10-cerrar-whatsapp.sql`) trae además el porqué de cada decisión.

```sql
-- 1) Lectura: el teléfono y la autorización salen del alcance de la API.
revoke select on public.pensiones from anon, authenticated;

grant select (
  id, slug, anfitrion_id, titulo, descripcion, precio_mensual, direccion, barrio,
  distancia_a_pie_minutos, servicios, normas, calificacion, verificado, imagenes,
  activa, creada_en, latitud, longitud
) on public.pensiones to anon, authenticated;

-- 2) Escritura: y dejan de poder escribirse.
revoke update on public.pensiones from anon, authenticated;

grant update (
  activa, titulo, descripcion, direccion, barrio, distancia_a_pie_minutos,
  servicios, normas, imagenes
) on public.pensiones to authenticated;
```

Fuera de las dos listas, a propósito: `whatsapp` y `autorizacion_contacto_en`.

**Por qué hay que revocar la tabla y no la columna.** En PostgreSQL, revocar el permiso de
una *columna* no retira el de la *tabla*. Con el `grant` de tabla que Supabase aplica por
defecto, un `revoke select (whatsapp)` habría quedado **sin efecto**: habría parecido cerrado
sin estarlo, y una comprobación ingenua habría dicho «cerrado». Es el mismo patrón que ya
usan las oleadas 2, 3 y 6.

**Las 18 columnas son exactamente las que lee la aplicación.** Las 20 de la tabla son esas 18
más las dos que se retiran, así que no queda ninguna fuera por descuido. La comprobación lee
esa lista del propio `lib/supabase/mapeo.ts` en vez de copiarla: si mañana se añade una
columna al mapeo y no a la migración, se nota.

## 3. Efecto

1. `whatsapp` y `autorizacion_contacto_en` dejan de ser legibles por `anon` y por
   `authenticated`. **Los datos no se borran**: siguen en la tabla y siguen a la vista del
   panel de Supabase y del rol de servicio.
2. Cualquier consulta con comodín sobre `pensiones` pasa a fallar con `42501`. Comprobado
   antes de escribirlo: **ninguna consulta de la aplicación usa comodín** (las cuatro
   lecturas del catálogo pasan por `COLUMNAS_PENSION` / `COLUMNAS_HABITACION`, y
   `pruebas/proyeccion-datos.prueba.ts` lo vigila; las del panel piden `id` o
   `id, pension_id`).
3. El catálogo y la ficha no cambian: las 18 columnas concedidas incluyen las dos que usan
   las políticas de RLS (`activa`, `anfitrion_id`) y las que se filtran y se ordenan.
4. El propietario con sesión sigue igual: lee las mismas 18 y escribe las mismas 9 que ya
   podía. La columna retirada no la usa ninguna pantalla desde el cambio de modelo del
   2026-10-02.

## 4. Orden de ejecución respecto a las oleadas 7, 8 y 9

| Oleada | Relación con la 10 |
|---|---|
| **7** (borrado y reserva de la dirección) | Sin relación. Cualquier orden. |
| **8** (índices) | Sin relación. Cualquier orden. |
| **9** (perfil maestro) | **Sin solape.** La migración vigente `supabase/oleada-9.sql` no reemite los grants de columna. El borrador descartado `oleada-9-descartada.sql` sí repetía estas sentencias en sus secciones 7 y 8. |

**Recomendado: aplicar esta primero.** Cierra una exposición real sin exigir ninguna decisión
de producto. (Estado a 2026-10-09: esta migración y la vigente `supabase/oleada-9.sql` ya están
aplicadas en el proyecto de producción.)

## 5. Cómo comprobarlo (el mismo comando antes y después)

```bash
npm run verificar:exposicion-propietario
```

- **Antes de aplicar** → dice `EXPOSICIÓN ABIERTA` y reproduce el 200. Es lo que se ejecutó
  hoy para escribir esta nota.
- **Después de aplicar** → dice `CERRADO`.
- Código de salida: `0` solo cuando el teléfono está cerrado **y** el catálogo y la ficha
  responden. Cualquier otra cosa es `1`.

Se probaron a propósito los dos caminos de fallo, para que el veredicto no pueda dar un
cierre falso:

| Escenario forzado | Qué dijo | Salida |
|---|---|---|
| URL inexistente | `NO SE PUDO COMPROBAR` | 1 |
| Clave inválida (401 en todo) | `CERRADO, PERO CON COMPROBACIONES CAÍDAS` | 1 |

Es decir: una respuesta que no sea 200 ni 401/403 **nunca** se cuenta como cierre. «No lo sé»
no es «está cerrado».

## 6. Las filas de evidencia que hay que pegar de vuelta

Dentro del SQL Editor, después de aplicar. Estas son las que valen, porque miran los
privilegios **efectivos** (incluida cualquier concesión heredada de `PUBLIC`):

```sql
select has_column_privilege('anon','public.pensiones','whatsapp','SELECT')                as anon_whatsapp,     -- esperado: f
       has_column_privilege('anon','public.pensiones','autorizacion_contacto_en','SELECT') as anon_autorizacion, -- esperado: f
       has_column_privilege('anon','public.pensiones','titulo','SELECT')                 as anon_titulo,       -- esperado: t
       has_table_privilege ('anon','public.pensiones','SELECT')                           as anon_tabla;        -- esperado: f

select has_column_privilege('authenticated','public.pensiones','slug','SELECT')         as aut_slug,         -- esperado: t
       has_column_privilege('authenticated','public.pensiones','activa','UPDATE')       as aut_activa,       -- esperado: t
       has_column_privilege('authenticated','public.pensiones','whatsapp','UPDATE')     as aut_whatsapp_upd; -- esperado: f

select has_column_privilege('authenticated','public.pensiones','verificado','UPDATE')     as verificado,  -- f
       has_column_privilege('authenticated','public.pensiones','calificacion','UPDATE')   as calificacion,-- f
       has_column_privilege('authenticated','public.pensiones','precio_mensual','UPDATE') as precio,      -- f
       has_column_privilege('authenticated','public.pensiones','anfitrion_id','UPDATE')   as anfitrion,   -- f
       has_column_privilege('authenticated','public.pensiones','slug','UPDATE')           as slug;        -- f

select count(*) as publicaciones, count(whatsapp) as con_numero from public.pensiones;
```

Si la primera consulta devolviera `t` en `anon_whatsapp` **después** de aplicar el archivo, la
causa sería una concesión a `PUBLIC` (que se hereda y que un `revoke … from anon` no retira).
Se cierra con una línea más: `revoke select on public.pensiones from public;`. **No se incluye
en la migración** porque en un proyecto Supabase estándar esa concesión no existe, y añadir
una sentencia que no se puede probar desde aquí «por si acaso» es justo lo que no hay que
hacer.

## 7. Qué no se pudo comprobar, y por qué

- **La rama «cerrado» no se ha ejercitado contra la base real.** Solo se puede ver después de
  aplicar la migración. Lo que sí está probado: los otros dos veredictos y que ninguno de
  ellos declara un cierre limpio. Si la respuesta real fuera un código inesperado, el guion
  imprime la respuesta de la API para que se explique sola.
- **La gestión del propietario «de verdad»** (leer y editar sus anuncios con una sesión)
  necesita las credenciales de una cuenta. Se comprueba la mitad demostrable sin sesión —que
  las columnas que lee el panel siguen legibles— y la otra mitad se mide con las consultas
  `has_column_privilege` de arriba.
- **No se ha borrado ningún número.** La migración no toca datos. Si además se quieren
  eliminar los valores existentes, es una sentencia aparte y deliberada:
  `update public.pensiones set whatsapp = null where whatsapp is not null;`
