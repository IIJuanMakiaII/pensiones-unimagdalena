# Oleada 1 — Estado de implementación (parcial)

> **Fecha:** 2026-09-17
> **Alcance de esta entrega:** hallazgos **M-09, M-10, M-11, M-12, M-13 y M-14**
> (los seis que resuelven el circuito «anfitrión publica → estudiante filtra → reserva»).
> **Pendiente de la Oleada 1:** M-07, M-08, M-15, M-16 y M-19 (ver §6).
> Referencia de origen: [INFORME-MAESTRO.md](INFORME-MAESTRO.md) §3.

---

## 1. Qué se resolvió

| ID | Hallazgo | Severidad | Estado |
|---|---|---|---|
| **M-09** | El formulario no crea habitaciones → publicación invisible a los filtros | 🔴 | ✅ Implementado |
| **M-14** | Política UPDATE de `habitaciones` sin `WITH CHECK` | 🟠 | ✅ Implementado |
| **M-10** | Precio de la tarjeta ≠ precio del mensaje de WhatsApp con filtros activos | 🔴 | ✅ Implementado |
| **M-11** | CTA de reserva anidado dentro del `<label>` de la habitación | 🔴 | ✅ Implementado |
| **M-12** | Botones del carrusel dentro del `<Link>` de la tarjeta | 🟠 | ✅ Implementado |
| **M-13** | Integridad solo en el formulario; la base no imponía restricciones | 🟠 | ✅ Implementado |
| **M-15** | Sin ciclo de publicación: no se podía marcar una habitación como ocupada | 🟠 | ✅ Disponibilidad implementada (editar/borrar, pendiente) |

**Por qué estos seis primero:** hasta ahora un anfitrión publicaba una pensión sin
habitaciones. La pensión aparecía en el catálogo con filtros vacíos, pero
desaparecía en cuanto el estudiante filtraba por género, alimentación o precio
—justo las tres decisiones que toma antes de escribir por WhatsApp—. El circuito
comercial completo estaba roto en el paso más importante.

---

## 2. Base de datos — `supabase/oleada-1.sql`

Se aplicó como migración `oleada_1_habitaciones` sobre el proyecto `ayznnqkacpdvvufclhon`.

### 2.1 Candados de integridad (M-13)

Hasta ahora la única validación vivía en el formulario, así que cualquier cuenta
autenticada podía escribir directo contra la API y saltársela.

| Restricción | Regla |
|---|---|
| `pensiones_titulo_longitud` | título entre 6 y 120 caracteres |
| `pensiones_descripcion_longitud` | descripción ≤ 2000 caracteres |
| `pensiones_precio_rango` | precio entre 0 y 20.000.000 COP |
| `pensiones_imagenes_limite` | máximo 8 fotos por anuncio |
| `habitaciones_precio_rango` | precio de habitación entre 0 y 20.000.000 COP |

Las restricciones `habitaciones_genero_check` y `habitaciones_tipo_check` ya
existían en `esquema.sql` y siguen activas (se comprobaron en la prueba de §5).

### 2.2 Política UPDATE de habitaciones (M-14)

La política `habitaciones: editar las propias` tenía `using` pero **no** `with
check`: un anfitrión podía mover su habitación al anuncio de otro cambiando
`pension_id`. Se recreó con la misma condición en ambas cláusulas.

### 2.3 Precio derivado de la habitación más barata disponible

`sincronizar_precio_pension()` (SECURITY DEFINER, ejecutada por el trigger
`al_cambiar_habitacion` en INSERT/UPDATE/DELETE de `habitaciones`) mantiene
`pensiones.precio_mensual` igual al mínimo de las habitaciones **disponibles**.
Si no hay ninguna disponible, se conserva el precio declarado por el anfitrión.
Antes esa denormalización se desincronizaba en silencio.

### 2.4 RPC transaccional `crear_pension_con_habitaciones(p_pension, p_habitaciones)`

- **SECURITY INVOKER**: se ejecuta con los permisos del llamante, así que RLS
  sigue aplicando (no es una puerta trasera).
- `grant execute` solo a `authenticated`; revocado de `public` y `anon`.
- Exige sesión (`auth.uid()`), al menos 1 habitación y como máximo 20.
- Inserta la pensión y todas sus habitaciones en **una sola transacción**: si
  algo falla, nunca queda un anuncio a medias.

---

## 3. Código de la aplicación

| Archivo | Cambio |
|---|---|
| `components/EditorHabitaciones.tsx` | **Nuevo.** Editor de habitaciones: tipo, género, precio, alimentación y disponibilidad, con alta y baja de filas (máx. 20) y formato COP en vivo. |
| `components/FormularioPension.tsx` | Se integró el editor. **Se eliminó el campo de precio a nivel de pensión** (ya lo deriva la base). Se añadió un resumen en vivo: *«Tu anuncio aparecerá en el catálogo desde $X /mes»*. |
| `app/actions/pensiones.ts` | Valida cada habitación (tipo, género y precio) enumerando `Habitación N: …`, y llama a la RPC en lugar del `insert` suelto. |
| `types/index.ts` | Nuevo `EntradaHabitacion`; `EntradaPension` ya no lleva `precioMensual` y pasa a llevar `habitaciones`. |
| `components/CardPension.tsx` | Precio y CTA salen de la **misma** habitación; el `<Link>` dejó de envolver el carrusel. |
| `components/Carrusel.tsx` | Nuevo prop `href`: el enlace al detalle vive dentro de cada foto, no alrededor del carrusel. |
| `components/DetallePension.tsx` | El botón «Reservar» salió del `<label>`; además sincroniza la barra fija del móvil con la habitación reservada. |

### 3.1 M-10 en detalle (coherencia de precio)

Antes: la tarjeta mostraba la habitación más barata en absoluto, mientras el
mensaje de WhatsApp hablaba de la más barata **que cumplía los filtros**. Con
«solo mujeres» activo, la tarjeta podía decir $400.000 y el chat ofrecer una de
$650.000 — el estudiante sentía que el precio era falso.

Ahora `precioMostrado = destacada.precio_mensual_cop`, es decir el mismo objeto
que alimenta `enlaceWhatsApp(pension, destacada)`. La etiqueta además dice de qué
habitación se trata: `DESDE · INDIVIDUAL`.

---

## 4. Pruebas automáticas ejecutadas

```bash
npx tsc --noEmit                          # sin errores de tipos
npm run build                             # 11 rutas, sin errores de tipos ni lint
node scripts/prueba-humo.mjs              # 9/9 rutas responden (incluye 307 correcto en /publicar)
node scripts/verificar-seo.mjs            # 22/22 comprobaciones de datos estructurados y SEO
node scripts/verificar-estructura.mjs     # sin contenido interactivo anidado
```

`scripts/verificar-estructura.mjs` es **nuevo**: comprueba sobre el HTML real que
ningún `<a>` contiene un `<button>` y que ningún `<label>` contiene un enlace o un
botón. Es la prueba de regresión de M-11 y M-12.

---

## 5. Verificación funcional de la RPC

Se ejecutó `supabase/pruebas/oleada-1.sql` contra la base real, simulando las
claims del JWT de un anfitrión (`request.jwt.claims`) para que la prueba
ejercitara la lógica de verdad y no se detuviera en «Sesión requerida». La prueba
crea datos, los comprueba y **los borra en la misma ejecución**.

| Paso | Resultado | Detalle |
|---|---|---|
| 1. Crea pensión + habitaciones | ✅ | 3 habitaciones creadas en una sola operación |
| 2. Precio = habitación más barata **disponible** | ✅ | `precio = 480000` (la de $300.000 está ocupada, así que se ignora) |
| 3. Bloquea pensión sin habitaciones | ✅ | «Publica al menos una habitación: los estudiantes filtran por tipo, género y alimentación» |
| 4. Bloquea precio fuera de rango | ✅ | `violates check constraint "habitaciones_precio_rango"` |
| 5. Bloquea género inválido | ✅ | `violates check constraint "habitaciones_genero_check"` |
| 6. Limpieza | ✅ | `residuos = 0` |

---

## 6. Lo que queda en la Oleada 1

| ID | Hallazgo | Sev. | Nota |
|---|---|---|---|
| **M-07** | Semilla (slug) vs base (UUID) en el espacio de IDs | 🔴 | La solución acordada es **slug en la URL + UUID como PK**. Cambia la URL pública de las fichas ya publicadas, por eso se hace como paso propio y anunciado. |
| **M-08** | Catálogo demo servido en producción | 🔴 | Requiere `PERMITIR_CATALOGO_DEMO=false` y un error visible en lugar de datos ficticios. Se combina con M-07. |
| **M-15** | Sin ciclo de publicación (editar / retirar / borrar) | 🟠 | **Parcialmente resuelto:** ya se puede marcar disponibilidad y retirar/republicar (§7). Falta editar lo publicado (título, precio, fotos) y el borrado definitivo. |
| **M-16** | Sin git, sin CI y sin pruebas unitarias | 🟠 | Recomendado. `lib/filtros.ts` es puro y se puede cubrir con Vitest sin mocks. |
| **M-19** | Sin `robots.txt`, sin `sitemap.xml`, sin Search Console ni analítica | 🟠 | 2 h. Crítico al desplegar, no antes. |

### Aviso operativo

La publicación que ya existe en el proyecto (**«Residencia Makia»**, ficha
`/pensiones/f555e5b3-6629-402a-ae37-32c366c3f022`) **no tiene habitaciones**: se
creó con el formulario anterior. Sigue visible en el catálogo, pero desaparecerá
al filtrar por género, alimentación o precio. Para corregirlo hay que republicarla
con el formulario nuevo (o cargarle habitaciones por SQL). No se tocó: son datos
del usuario.

---

## 7. Gestión de disponibilidad (M-15, parcial)

Un anfitrión ya puede marcar sus habitaciones como **ocupadas o libres** después de
publicar, y **retirar o republicar** el anuncio. Antes solo existía la casilla
«Disponible ahora» al crear la publicación: quien alquilaba una habitación no tenía
forma de sacarla del catálogo y seguía recibiendo mensajes de estudiantes por algo
que ya no tenía.

### 7.1 Qué se añadió

| Archivo | Cambio |
|---|---|
| `app/actions/pensiones.ts` | `cambiarDisponibilidadHabitacion` y `cambiarEstadoPublicacion`: identidad desde `getUser()`, escritura filtrada por RLS y **comprobación de la fila afectada** — nunca un éxito que no ocurrió. |
| `components/PanelPublicacion.tsx` | Nuevo panel: chip Libre/Ocupada, botones «Marcar ocupada»/«Marcar libre» y «Retirar publicación»/«Volver a publicar». |
| `app/publicar/page.tsx` | «Mis publicaciones» usa ese panel. |
| `components/CardPension.tsx` | Tres estados: sin habitaciones publicadas, con libres y **todas ocupadas** (sin precio y con «Consultar por WhatsApp»). |
| `components/DetallePension.tsx` | Distingue «no publicó habitaciones» de «las tiene todas ocupadas». |
| `lib/pension.ts` | `resumenHabitaciones` ya no confunde ambos casos. |

### 7.2 Pruebas ejecutadas

`scripts/verificar-disponibilidad.mjs` (**nuevo**) crea una publicación temporal en
la base real, la usa y la borra en la misma ejecución. **23 comprobaciones, 22 en verde:**

| Comprobación | Resultado |
|---|---|
| Precio derivado de la habitación libre (ignora la ocupada) | ✅ `precio=480000` |
| La ficha ofrece reservar la habitación libre | ✅ |
| **Otro anfitrión NO puede modificarla** | ✅ 0 filas |
| **Un anónimo NO puede modificarla** | ✅ 0 filas |
| El dueño SÍ puede modificarla | ✅ 1 fila |
| La ficha deja de ofrecer reservar una vez ocupada | ✅ |
| La ficha las lista como «Ocupadas por ahora» | ✅ |
| La tarjeta avisa «Sin habitaciones libres ahora» | ✅ 1 aparición |
| Ninguna tarjeta ofrece reservar una habitación ocupada | ✅ 0 apariciones |
| Retirar la publicación la oculta al público | ✅ deja de servirse su contenido |
| Limpieza sin residuos | ✅ `residuos=0` |

La matriz de autorización se ejecuta con `set_config('role', …)` más claims JWT
simuladas, así que la RLS se evalúa de verdad (no como superusuario): es lo que
convierte «otro anfitrión no puede» en una prueba y no en una suposición.

No regresión, tras un `npm run build` limpio: `verificar-seo.mjs` completo,
`prueba-humo.mjs`, `verificar-estructura.mjs` y `verificar-contraste.mjs` (16/16 WCAG AA).

### 7.3 Dos defectos abiertos

1. **✅ Los datos estructurados declaraban un precio no reservable — corregido (tarea #13).**
   Con todas las habitaciones ocupadas, la ficha publicaba `"priceRange": "480000 COP"`
   porque `precioDesde()` devolvía `precioMensual` (el valor que el trigger conserva). Ahora
   la regla vive en `precioReservable()` y el JSON-LD solo declara precio cuando hay algo
   reservable.
2. **✅ Soft 404 en la ficha — corregido (tarea #15), y mi diagnóstico era falso.**
   `/pensiones/<id>` respondía **HTTP 200** aunque la publicación no existiera o estuviera
   retirada (renderizaba el estado «no encontrada»), mientras que una ruta inexistente sí
   devolvía 404.
   **Lo que afirmé aquí estaba mal:** atribuí el 200 a la frontera de streaming de
   `app/pensiones/[id]/loading.tsx` («la cabecera ya se envió cuando la página resuelve
   `notFound()`»). Se refutó con un experimento: apartando `loading.tsx` y recompilando,
   **seguía devolviendo 200**. La causa real es que Next materializa el HTML del estado
   «no encontrada» con código 200 para las rutas desconocidas que genera bajo demanda.
   La comprobación se movió a `middleware.ts` (solo para visitantes sin sesión, con
   `fail-open` si Supabase no responde) y ahora un id inexistente y una publicación
   retirada responden 404. El slug de la semilla sigue devolviendo 200 mientras la demo
   esté encendida (pendiente M-08).
   Lección de método: **una hipótesis consistente no es una causa medida.** El arnés de
   verificación ya no acepta el texto «no encontrada» como indicador de nada: viaja en el
   payload RSC de todas las páginas, incluidas la home y una ficha real.

### 7.4 Nota de método (falsa alarma evitada)

Las fichas que Next renderiza bajo demanda quedan como HTML en
`.next/server/app/pensiones/`. Tras la verificación, esa carpeta acumuló 11 fichas
(1 real y 10 de prueba) y `verificar-seo.mjs` —que recorre esa carpeta— falló 7
comprobaciones por leer una ficha fantasma. Con un `npm run build` limpio vuelve
todo a verde. Verificado, por tanto, que no hubo regresión; el aviso queda anotado
en la cabecera del script.
