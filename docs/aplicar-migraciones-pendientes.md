# Migraciones de la base: estado, comprobación y lo que queda

> Actualizado el **2026-10-12**. El usuario aplicó en el editor SQL `oleada-11`,
> `oleada-12`, `oleada-13` y `oleada-15`, y las cuatro están **verificadas** contra
> el proyecto Supabase `ayznnqkacpdvvufclhon` con la clave anónima del sitio.
> **`oleada-14` queda descartada**: no hay retirada permanente que aplicar.
> **No queda ninguna migración pendiente de aplicar.**
> Esta hoja sigue existiendo porque las migraciones **no se pueden aplicar desde
> esta cuenta** (ver §5). Las aplica el propietario, como se ha hecho siempre.

---

## 1. Estado, en una tabla

| # | Archivo | Tarea | Qué hace | Estado |
|---|---|---|---|---|
| 1 | `supabase/oleada-11-aplicar-seguridad-e-integridad.sql` | #55 | Cierra la superficie de escritura: `revoke update` + `grant update` por columna, función de precio, disparador, recuento de límites y `crear_pension_con_habitaciones`. 0 `update`, 0 `delete`. | **aplicada** (declarado por el usuario; no observable al público) |
| 2 | `supabase/oleada-12-contactos-respaldo.sql` | #59 | Crea `public.contactos_respaldo` y `public.registrar_contacto_respaldo()`. | **aplicada — medida** |
| 3 | `supabase/oleada-13-fecha-verificacion.sql` | #61 | Añade `pensiones.verificado_en`, ajusta el `grant select` a 19 columnas y sella la fecha con `sellar_fecha_verificacion()`. No rellena ninguna fecha a propósito. | **aplicada — medida** |
| 4 | `supabase/oleada-14-retirar-anuncio-de-prueba.sql` | #58 | `update … set activa = false where slug = 'residencia-makia'`. | **descartada** — la tarea #58 fue **cancelada** por el usuario; la demostración es intencional |
| 5 | `supabase/oleada-15-contacto-anfitrion-privado.sql` | #76, #77, #78 | Crea `public.contacto_anfitrion` (una fila por anfitrión) con RLS de **dos lectores**: el propio anfitrión y el rol maestro. `anon` queda sin ningún `grant`. **No toca `pensiones`**: las únicas menciones a esa tabla están dentro de comentarios. | **aplicada — medida** |

Tamaños y sellos de los archivos, medidos:

```
oleada-11-aplicar-seguridad-e-integridad.sql      30855 bytes  sha 73F1861D606C
oleada-12-contactos-respaldo.sql                  10081 bytes  sha 5EE8593F8835
oleada-13-fecha-verificacion.sql                  18789 bytes  sha 68C180C156B7
oleada-14-retirar-anuncio-de-prueba.sql           10475 bytes  sha CE02E953E244  (descartada)
oleada-15-contacto-anfitrion-privado.sql          29332 bytes  sha 7C0C44B0ECAC  (aplicada · 521 líneas)
```

Antes de esta pasada, las sondas daban: `contactos_respaldo` → `404 PGRST205`
(la tabla no existía) y `select …, verificado_en` → `400 42703` (la columna no
existía). Las dos han cambiado de respuesta, que es la prueba de que entraron.

## 2. El orden importaba: migraciones antes del despliegue

Medido, no supuesto: **la rama proyecta `verificado_en` (`lib/supabase/mapeo.ts:103`)
y `main` no.** Con la columna ausente, esa consulta fallaba con `HTTP 400`,
`code 42703`, y `lib/catalogo-respaldo.ts:63` devolvía lista vacía — portada sin un
solo enlace a fichas y con «Todavía no hay pensiones publicadas» teniendo un anuncio
dentro.

Con `oleada-13` ya aplicada, ese riesgo está cerrado: la proyección completa de la
aplicación responde `200`.

## 3. Comprobación con la clave anónima (solo lectura)

```bash
U="https://ayznnqkacpdvvufclhon.supabase.co/rest/v1"
K="<NEXT_PUBLIC_SUPABASE_ANON_KEY de .env.local>"
CAB=(-H "apikey: $K" -H "Authorization: Bearer $K")
```

### 3.1 · oleada-11 — no se puede comprobar desde aquí
Los `grant`, `revoke` y las funciones no son observables al público. Se da por
aplicada si el editor SQL devolvió éxito. Su síntoma de fallo sería un error de
permisos al guardar desde el panel.

### 3.2 · oleada-12 — la tabla existe y la escritura va por la función
```bash
curl -s -o /dev/null -w "%{http_code}\n" "${CAB[@]}" "$U/contactos_respaldo?select=id&limit=1"
```
**Ojo con esta sonda, que la primera versión de esta hoja tenía mal planteada:**
`oleada-12` hace `revoke all on table public.contactos_respaldo from anon,
authenticated` (`:85`) y expone la escritura **solo** por
`public.registrar_contacto_respaldo(p_nombre, p_contacto, p_mensaje, p_pension_slug)`,
con `grant execute … to anon, authenticated` (`:145`).

- Antes: `404` `PGRST205` — «Could not find the table». La tabla no existía.
- **Ahora: `401` con `42501 permission denied for table contactos_respaldo`.**

Ese `42501` **no es un fallo: es el diseño**. PostgREST solo responde «permiso
denegado» sobre una tabla que existe, así que la transición de `404` a `42501` es
justo la prueba de que `oleada-12` entró. No hay que «arreglar» ese permiso.

### 3.3 · oleada-13 — la columna existe y los permisos de columna están completos
```bash
curl -s "${CAB[@]}" "$U/pensiones?select=id,slug,verificado_en&limit=3"
```
Ahora: `200`. La fecha viene `null`, que es lo esperado: la migración no rellena
ninguna a propósito.

**La comprobación que de verdad importa** es la proyección completa de la
aplicación, porque `oleada-13` hace `revoke select` y re-otorga columna por columna
(`:211` y `:213`). Si el `grant` se dejara una columna fuera, aparecería un `42501`
solo al pedir el catálogo. Medido con las 19 columnas de
`lib/supabase/mapeo.ts:89-111` y las 7 de `:113-121`: **`200` en las dos**. Los
permisos están completos.

### 3.4 · La consulta que el usuario pidió vigilar
Si alguna vez aparece `42501` o `42703` sobre `pensiones`, es esta:
```bash
curl -s "${CAB[@]}" "$U/pensiones?select=id,slug,anfitrion_id,titulo,descripcion,precio_mensual,direccion,barrio,distancia_a_pie_minutos,servicios,normas,calificacion,verificado,verificado_en,imagenes,activa,creada_en,latitud,longitud&activa=eq.true"
```
Hoy: `200`, con el anuncio de demostración dentro.

### 3.5 · oleada-15 — cómo saber si entró, sin abrir el panel

Es la misma sonda de §3.2, y por el mismo motivo. `oleada-15` hace
`revoke all on table public.contacto_anfitrion from public` (`:180`) y
`from anon, authenticated` (`:181`), y después concede
`select, insert, update, delete … to authenticated` (`:185`).
**`anon` no aparece en ningún `grant`, a propósito.**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "${CAB[@]}" "$U/contacto_anfitrion?select=anfitrion_id&limit=1"
```

| Respuesta | Significa |
|---|---|
| `404` `PGRST205` «Could not find the table» | **la migración no ha entrado** — era el estado antes de aplicarla |
| `401` `42501 permission denied for table contacto_anfitrion` | **entró** — es el diseño, el mismo `42501` que en §3.2, y **no hay que «arreglarlo»** |

Que un anónimo reciba «permiso denegado» es exactamente el objetivo de la
oleada: PostgREST solo responde eso sobre una tabla **que existe**, así que la
transición de `404` a `42501` es la prueba. El número del anfitrión no se filtra
ni por error, ni por descuido de una consulta, ni por un `select *`.

**Medido tras aplicarla** (la sonda devolvió `401 42501`, no `404`), y la
comprobación de punta a punta `npm run verificar:contacto-privado` pasó a decir
**`CERRADO`**: el número no es alcanzable sin sesión y no aparece en ninguna de
las tres páginas públicas que mira —portada, ficha y `sitemap.xml`—. Ese cambio
de palabra era el criterio de aceptación, y se cumplió.

Queda una mitad **sin ejercitar**, y no es un fallo de la migración sino de la
prueba: la comprobación funcional de RLS del final del propio archivo (C.10) va
comentada a propósito porque necesita dos sesiones reales —que un anfitrión no
vea el número de otro—. Hasta que se ejecute, la garantía de los dos lectores
está argumentada por las políticas, no observada.

La segunda superficie donde el maestro ve el número es `/maestro/<id>/editar`
(tarea #79). Medida sin sesión, responde lo mismo que respondía antes del cambio
y no contiene ni el número ni el botón: la ruta exige perfil maestro y, sin
sesión, sirve la pantalla de inicio de sesión. Lo que sí se puede comprobar sin
credenciales es que la ruta no pide el campo editable y que la acción del maestro
no lee ese dato del formulario; eso lo fija
`pruebas/contacto-maestro-solo-lectura.prueba.ts`.

## 4. La demostración

`residencia-makia` | uuid `f555e5b3-6629-402a-ae37-32c366c3f022` | título
«Residencia 101 (Pension de Prueba)» | `activa = true` | `verificado = false` |
`verificado_en = null` | `precio_mensual = 600000` | dos habitaciones, las dos
`disponible`, a 600000.

**Es el único anuncio público.** Ocultarla deja el catálogo en cero, y por eso el
estado sin inventario no es un caso de borde. No se retira: el usuario la oculta y
la reactiva con su rol de maestro cuando quiere. No hay nada que revertir aquí.

## 5. Por qué no las aplico desde aquí

El proyecto tiene un guion (`scripts/mcp-sql.mjs`) que aplica SQL por el MCP. La
llamada existe y está bien parametrizada, pero el MCP responde:

```
errorCode: "-32004"   reason: "site_owner_denied"
code: "ownership_forbidden"   「当前账号无权限操作该站点」
```

Es una denegación de **propiedad del sitio**, no de red, así que no se arregla
reintentando. Y en el repositorio no hay credencial de escritura: `.env.local` solo
trae variables `NEXT_PUBLIC_*`, y la clave anónima no puede aplicar DDL. La vía que
funciona es el editor SQL del panel.

## 6. Aviso: el formulario de respaldo no puede guardar

Hallazgo de la verificación posterior, **ajeno a estas migraciones** y ya asignado
como tarea #63: `app/actions/contacto.ts:66` escribe **directo en la tabla** con el
cliente anónimo (`utils/supabase/server.ts:21`), pero `oleada-12` cerró esa puerta
(`revoke all`, `:85`) y dejó la escritura solo por la función. El síntoma es el
mismo `42501` de §3.2 — pero en una **escritura**, donde sí es un defecto.
