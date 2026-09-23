# Oleada 5 — Dirección pública legible de cada anuncio (M-07)

**Tarea:** #26 · **Autor:** Arquitecto Datos/Backend
**Fecha:** 20 de septiembre de 2026
**Hallazgo cerrado:** M-07 (el último 🔴 del informe maestro) — «espacio de IDs incompatible: semilla (slug) vs base (UUID)»
**Artefactos:** [`supabase/oleada-5.sql`](../supabase/oleada-5.sql) · [`supabase/pruebas/oleada-5.sql`](../supabase/pruebas/oleada-5.sql) · [`lib/identificador.ts`](../lib/identificador.ts) · [`pruebas/identificador.prueba.ts`](../pruebas/identificador.prueba.ts)
**Cambios en la capa de datos:** `lib/datos.ts`, `lib/supabase/mapeo.ts`, `lib/datos.semilla.ts`, `types/index.ts`
**Migración aplicada al proyecto real:** `oleada_5_slug_publico` (`20260921030547`), registrada en el historial del proyecto (`supabase_migrations.schema_migrations`).

> Esta tarea **no** tocó componentes ni rutas: los enlaces, las canónicas, el `sitemap` y el middleware son la tarea #27, que queda desbloqueada. Al final de este documento está el traspaso exacto con los nombres de columna y de función para que no haya que reinventarlos.

---

## 1. Qué estaba mal

La semilla de demostración y la base de datos vivían en dos espacios de identificadores incompatibles:

| | Antes |
|---|---|
| Anuncio real («Residencia Makia») | `/pensiones/f555e5b3-6629-402a-ae37-32c366c3f022` |
| Ficha de ejemplo | `/pensiones/pension-costa-verde` |

Consecuencias medidas:

1. **El enlace de un anuncio real no dice nada.** Imposible de leer, dictar por teléfono o recordar — y este mercado se mueve por WhatsApp, donde el enlace *es* el producto.
2. **Pedir una ficha por el identificador del otro espacio fallaba.** La consulta iba contra la columna `id` (uuid) con un valor de texto: PostgreSQL no devuelve «cero filas», devuelve un **error de tipo**. Medido en el navegador sobre el build anterior: `/pensiones/residencia-makia` → 200 con el cuerpo «no encontrada», aunque ese anuncio existía y su ficha se servía perfectamente por UUID.
3. Ese error activaba además el respaldo a la semilla, así que la capa de datos podía mezclar datos ficticios con reales en la misma pantalla.

---

## 2. Las tres propiedades de la dirección, y cómo se garantizan

La decisión (slug en la URL + UUID como clave primaria) estaba tomada en el informe y no se reabrió. Lo que había que conseguir es que la dirección fuera **única, estable y resumible** — y cada propiedad se apoya en una barrera de la base, no en una buena intención del código:

| Propiedad | Cómo se garantiza | Por qué ahí |
|---|---|---|
| **Única y no nula** | índice único `pensiones_slug_uk` + `not null` | Una dirección que se repita o que falte no puede resolver nada. Lo impide la base, no la aplicación |
| **Estable** | disparador declarado **`before insert`** (nunca se dispara en un `update`) + `slug` **fuera** de las columnas que `authenticated` puede escribir | Una URL ya compartida por WhatsApp no puede morir porque el dueño corrija el título. No hay **ningún** camino que regenere el slug de un anuncio existente |
| **Resumible** | `slugificar()`: acentos a su letra base, minúsculas, solo `a-z0-9` y guiones | `Pensión Costa Verde` → `pension-costa-verde`: exactamente el formato que ya usaba la semilla, así que las direcciones de la demo no cambian ni una letra |

**El mecanismo de unicidad no es un `unique` a secas.** Si dos anfitriones publican «Casa Sol», el segundo recibe `casa-sol-2` en lugar de un error de índice único a mitad de su publicación. La comprobación de duplicados se hace con `security definer` para que vea **todas** las filas y no solo las que la RLS deja ver al que publica: si no, dos personas podrían generar la misma dirección.

### Una decisión que conviene conocer

Un título sin letras ni cifras útiles (`¡¡¡¡`) cae a `pension`, porque el formato no admite otra cosa. Y los indicadores ordinales (`2º`) se sustituyen por un guion en lugar de convertirse en `o`: `2-piso`, no `2o-piso`. Es una elección estética, no un fallo — la dirección sigue siendo legible y no arrastra caracteres raros a una URL.

---

## 3. Un anuncio se pide de dos formas, y solo una función decide

```
lib/identificador.ts     ← decide la COLUMNA (id | slug). Sin dependencias.
      ↓
lib/datos.ts             ← resolverPension(): única fuente de verdad
      ↓
obtenerPensionPorId()    ← compatibilidad: null solo si NO EXISTE
```

`lib/identificador.ts` **no importa nada** a propósito: lo usa la capa de datos en el servidor y lo usará el `middleware.ts` en el borde, y arrastrar `supabase-js` al edge solo para comparar una cadena sería un desperdicio.

### «No existe» y «no se pudo comprobar» ya no son lo mismo

Es la parte que más cuidado tiene, y la que cambia el comportamiento de forma visible:

| Situación | Antes | Ahora |
|---|---|---|
| El anuncio no existe | Respaldo a la semilla; si no está ahí, `null` | `{ estado: "no-existe" }` → `null` → **404** |
| La base no responde | Respaldo a la semilla → **ficha ficticia servida como real** | `{ estado: "error" }` → **no se declara inexistente** |

Un corte momentáneo de Supabase ya no puede retirar un anuncio del catálogo: la capa de datos dice que **no pudo comprobar** y el error sube a la frontera (`app/error.tsx`) en lugar de disfrazarse de «no encontrada».

*Consecuencia honesta que conviene tener presente:* si la base no responde durante una compilación, el build falla en lugar de publicar páginas de la semilla. Es deliberado —es preferible un despliegue que se detiene a uno que publica datos ficticios como si fueran reales—, pero es un comportamiento nuevo.

La semilla de demostración **sigue funcionando igual**: con la demo encendida, un identificador que no está en la base se busca también en la semilla (por slug **o** por id), así que las seis fichas de ejemplo siguen respondiendo por su dirección legible.

---

## 4. Verificación ejecutada

### 4.1 Base de datos — 15/15 en verde (`supabase/pruebas/oleada-5.sql`)

```
 1. Título → dirección (acentos, mayúsculas, símbolos)   ok  pension-jose-nandu-mamatoco-2-piso
1b. No deja guiones dobles ni en los extremos            ok  casa-sol
 2. slug es NOT NULL                                     ok
 3. Índice único sobre slug                              ok  pensiones_slug_uk
 4. Restricción de formato                               ok  ^[a-z0-9]+(-[a-z0-9]+)*$
 5. Las publicaciones existentes ya tienen dirección     ok  0 sin dirección
 6. La publicación por RPC genera dirección sola         ok
 7. La dirección se deriva del título                    ok  prueba-qa-oleada-5-pension-nandu
 8. Editar el título NO cambia la dirección              ok  antes = después     ← AC 3
 9. Denegado: el anfitrión escribe el slug               ok  42501
10. Tras el intento, la dirección no cambió              ok
11. Dos títulos iguales → direcciones distintas          ok  colision · colision-2
12. Rechaza una dirección duplicada                      ok  23505
13. anon lee el catálogo con direcciones                 ok
14. Las publicaciones retiradas siguen ocultas           ok  0 filas
15. Limpieza sin residuos                                ok  0
```

### 4.2 La consulta real, contra la API pública del proyecto (no supuesta)

Ejecutado con la clave anónima, que es exactamente lo que hace la capa de datos en producción:

```
GET /rest/v1/pensiones?select=id,slug,titulo,activa&slug=eq.residencia-makia
 → [{"id":"f555e5b3-6629-402a-ae37-32c366c3f022","slug":"residencia-makia","titulo":"Residencia Makia","activa":true}]

GET /rest/v1/pensiones?select=id,slug,titulo,activa&id=eq.f555e5b3-6629-402a-ae37-32c366c3f022
 → [{"id":"f555e5b3-6629-402a-ae37-32c366c3f022","slug":"residencia-makia", ...}]        ← el UUID sigue resolviendo

GET /rest/v1/pensiones?select=id&slug=eq.no-existe-abc
 → []                                                                                     ← «no existe», sin ambigüedad
```

### 4.3 Lógica de decisión — 6 suites unitarias en el runner del equipo

`npm run probar` → **71/71 pruebas, 0 fallos** (mis 6 suites son las 9 a 14). Se prueba el módulo real, no una réplica: que un UUID se resuelva por `id`, que una dirección lo haga por `slug`, que una dirección dictada por teléfono en mayúsculas (`Residencia-Makia`) llegue al mismo anuncio, y que un valor imposible (`<script>…`, con acentos, con espacios) se descarte **sin gastar una consulta**.

### 4.4 Tipos

`npx tsc --noEmit` limpio en todo el proyecto.

### 4.5 Lo que **no** se pudo comprobar, y por qué

**No ejecuté `npm run build` ni levanté el servidor.** Al ir a hacerlo detecté que **otro agente está compilando en ese momento** (`.next` modificado 12 segundos antes, cuatro procesos de Node activos y `BUILD_ID` recién escrito). Compilar mientras otro proceso usa `.next` es la causa conocida de la corrupción de caché que ya costó una sesión al equipo, así que me detuve.

Por tanto la comprobación **en el navegador** de `/pensiones/residencia-makia` queda pendiente y le corresponde a la verificación de la tarea #27. Todo lo que esa prueba demuestra por debajo —columna, valor, restricción, generación, inmutabilidad y consulta real— está medido arriba.

---

## 5. Traspaso a la tarea #27 (la mitad visible)

Nombres exactos para no reinventar nada:

| Qué | Nombre | Dónde |
|---|---|---|
| Columna pública | `pensiones.slug` | base de datos |
| Campo del contrato | `Pension.slug` (obligatorio) | `types/index.ts` |
| Decidir la columna | `columnaDeIdentificador(valor): "id" \| "slug"` | `lib/identificador.ts` |
| Normalizar lo que llega de la URL | `normalizarIdentificador(valor)` | `lib/identificador.ts` |
| Descartar lo imposible sin consultar | `identificadorPlausible(valor)` | `lib/identificador.ts` |
| Validar antes de enlazar | `FORMATO_SLUG` / `FORMATO_UUID` | `lib/identificador.ts` |
| Resolver un anuncio | `resolverPension(identificador)` → `{estado: "ok" \| "no-existe" \| "error"}` | `lib/datos.ts` |

Los cuatro puntos que quedan por cambiar (ninguno está en mi alcance):

1. **Enlaces y canónicas**: donde hoy se usa `pension.id` para construir una URL (`CardPension`, `DetallePension`, `alternates.canonical` en `app/pensiones/[id]/page.tsx`), usar **`pension.slug`**. El `id` sigue siendo correcto para identificar en la medición y para las claves de React.
2. **`generateStaticParams`**: devolver `pension.slug` para que la página prerenderizada sea la dirección pública. El UUID seguirá funcionando (resolución bajo demanda).
3. **`sitemap.xml`**: anunciar `pension.slug`, y comprobar que cada URL responde 200 (eso ya lo hace el script de #24).
4. **`middleware.ts`** — el punto que hay que mirar con cuidado: hoy decide el 404 de las fichas consultando `id=eq.<valor>`. Con una dirección legible esa consulta **no** da «cero filas», da un error de tipo, y el middleware lo interpreta como «no se pudo comprobar» (deja pasar la petición). Consecuencia actual: un enlace a una dirección inexistente responde **200 con el cuerpo «no encontrada»** (soft 404) en lugar de 404. Se arregla usando `columnaDeIdentificador(id)` para elegir el filtro (`id=eq.` o `slug=eq.`) en `existePensionPublica()`. Mientras la demo esté encendida no se nota; **al apagarla (M-08) sí**.

Referencias exactas en `middleware.ts` (leídas del archivo, no de memoria):

| Línea | Qué hay hoy | Qué hace falta |
|---|---|---|
| `middleware.ts:61` | `?select=id&id=eq.${id}&activa=eq.true&limit=1` | usar la columna que devuelve `columnaDeIdentificador(id)` |
| `middleware.ts:49` | `const DEMO_HABILITADA = process.env.NEXT_PUBLIC_MOSTRAR_DEMO === "1";` | `lib/sitio.ts` añade `\|\| NODE_ENV !== "production"`: son **dos definiciones de lo mismo**, conviene unificarlas al tocar el archivo |
| `middleware.ts:92` | `if (!UUID.test(id) && DEMO_HABILITADA) return null;` con una regex `UUID` local | puede importar `FORMATO_UUID` de `lib/identificador.ts`, que es el mismo patrón y no arrastra dependencias (seguro en el borde) |

Ninguna de las tres es un fallo visible hoy —mientras la demo esté encendida, todo pasa—, pero la primera sí lo será al apagarla (M-08).

---

## 6. Nota de coordinación (no es un fallo de nadie)

En `supabase/` han quedado **dos archivos con la misma migración**: `oleada-5.sql` (el que escribí y apliqué) y `oleada-5-slug-arquitecto.sql`, que es una copia de mi migración creada al resolver la colisión de nombres con la migración de autorización del contacto (tarea #30, renombrada a `oleada-6.sql`). El segundo es redundante: **no lo borré** porque no es un artefacto mío y prefiero que decida quien lo creó. Aplicarlo no haría daño (es idempotente), pero sí dejaría una segunda entrada en el historial de migraciones.

**Estado de git:** mis archivos no están comprometidos, y no lo hice a propósito. El árbol contiene cambios **en curso de otro agente** en `types/index.ts`, `lib/supabase/mapeo.ts`, `app/actions/pensiones.ts` y `components/` (tarea #30, autorización del contacto), así que un commit de esos archivos arrastraría trabajo a medias. El commit de este hito corresponde a quien cierre la oleada.
