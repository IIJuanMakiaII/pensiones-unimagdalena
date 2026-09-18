# Auditoría del modelo de datos y plan de migración a datos reales

**Proyecto:** Pensiones Unimagdalena — marketplace de pensiones y habitaciones (Santa Marta)
**Auditor:** Arquitecto Datos/Backend (tarea #5 del tablero)
**Fecha:** 2026-09-17
**Alcance:** contrato de tipos (`types/index.ts`), capa de acceso a datos (`lib/`), esquema y políticas de Supabase (`supabase/`), flujo de publicación (`app/actions/`, `app/publicar/`, `components/FormularioPension.tsx`).
**Naturaleza:** **auditoría de solo lectura**. No se modificó ni un archivo de código y **no se ejecutó `npm run build` ni `npm start`** (varios agentes comparten la carpeta `.next`; compilaciones simultáneas la corrompen). El SQL de la sección 7 está **propuesto, no ejecutado**.

---

## 1. Resumen ejecutivo

### Veredicto

El modelo de datos está **bien pensado en el contrato de tipos y correctamente aislado en la capa de acceso** (`lib/datos.ts` es el único punto que conoce Supabase, y `lib/supabase/mapeo.ts` traduce snake_case → dominio en un solo lugar). La degradación a modo demo funciona y el sitio no se rompe. Eso es una base sólida.

Pero **el sistema todavía no está preparado para producción con datos reales**, y el motivo no es la falta de funcionalidad: es que **toda la validación y la integridad viven en el formulario, no en la base de datos**, y que **el espacio de identificadores de la demo (slugs) no es compatible con el de la base (UUID)**, lo que produce mezcla silenciosa de datos ficticios con datos reales.

### Los 5 bloqueantes (🔴 arreglar antes de lanzar)

| ID | Hallazgo | Por qué bloquea |
|---|---|---|
| **H-01** | Espacio de IDs incompatible: la semilla usa slugs (`pension-costa-verde`) y la tabla usa `uuid` | Cada URL de semilla provoca un error de Postgres y **cae al catálogo demo**, mezclando pensiones ficticias con reales en la misma navegación |
| **H-02** | La política UPDATE de `habitaciones` no tiene `WITH CHECK` | Un anfitrión puede mover su habitación al anuncio de **otro** anfitrión y alterar su "precio desde" |
| **H-03** | La BD no impone ninguna restricción de integridad (solo el formulario valida) | Cualquier cuenta autenticada puede escribir directo contra la API REST sin pasar por el formulario |
| **H-04** | No hay estado de publicación ni moderación (`activa` es `true` por defecto) | Cualquier cuenta publica al instante, mientras la interfaz presume de "verificada por el equipo" |
| **H-05** | El catálogo demo se sirve también en producción y **enmascara fallos** | Si Supabase cae, el estudiante ve 6 pensiones ficticias con un botón de WhatsApp real: intentaría reservar un alojamiento inexistente |

### Los 2 agujeros funcionales (🔴 el flujo "anfitrión publica" no cierra)

- **H-06:** el formulario inserta la pensión pero **nunca crea habitaciones**. En todo el código hay **un único `insert`** (`app/actions/pensiones.ts:104`) y **cero escrituras** sobre `habitaciones`. Resultado: con el filtro de género o de alimentación activo, la pensión recién publicada **desaparece del catálogo** (`lib/filtros.ts:82-85`) y su tarjeta dice "Sin habitaciones publicadas todavía" (`lib/pension.ts:53`).
- **H-12:** `precioMensual` (pensión) y `habitaciones.precio_mensual_cop` conviven sin dueño claro. Verifiqué las 6 filas de `supabase/datos-ejemplo.sql` y en **las 6** `precio_mensual` coincide exactamente con el mínimo de habitaciones disponibles — es decir, hoy es una **denormalización redundante que nadie mantiene** y que puede desincronizarse en silencio.

### Lo que está bien y **no hay que tocar**

- ✅ **Contrato de tipos tipado y respetado**: `Pension` y `Habitacion` (`types/index.ts:24-63`) reflejan fielmente el esquema; la traducción snake_case ↔ camelCase está en un único archivo (`lib/supabase/mapeo.ts`).
- ✅ **Aislamiento de la persistencia**: ninguna regla de negocio vive en SQL; `lib/pension.ts` centraliza `precioDesde`, disponibilidad y alimentación, y funciona igual con demo o con Supabase.
- ✅ **Identidad desde la sesión, nunca del formulario** (`app/actions/pensiones.ts:44-51`): no se puede publicar a nombre de otro anfitrión.
- ✅ **Cliente anónimo sin cookies para lecturas públicas** (`utils/supabase/publico.ts`): decisión correcta y poco habitual — es lo que permite mantener ISR sin romper RLS.
- ✅ **Trigger de perfil con `security definer` y `search_path` fijado** (`supabase/esquema.sql:73-99`): patrón seguro.
- ✅ **RLS activo en las tres tablas** y política de lectura pública limitada a activas.
- ✅ **Migración TS↔SQL coherente**: los 6 precios y las 16 habitaciones de `lib/datos.semilla.ts` y `supabase/datos-ejemplo.sql` coinciden hoy (lo verifiqué uno a uno). Hay que **automatizar** esa comprobación, no dejarla a la suerte.

### Cómo leer el plan

La sección 6 propone **4 fases** con pasos verificables; la sección 7 contiene el **DDL completo listo para revisar**, diseñado explícitamente para **no romper el contrato de tipos ni la interfaz**: `precioMensual` sigue existiendo y significando lo mismo, `activa` conserva su semántica, y ningún cambio obliga a tocar `components/` ni `app/page.tsx`.

---

## 2. Método y límites de la verificación

**Qué hice:** lectura completa de los 13 archivos indicados en la tarea, más `lib/filtros.ts`, `lib/formato.ts`, `next.config.mjs`, `middleware.ts`, `app/page.tsx`, `package.json` y `scripts/`. Búsquedas dirigidas con `grep` sobre todo el código fuente (excluyendo `node_modules`) para confirmar ausencias: puntos de escritura en la base, uso del campo `rol`, uso de tipos declarados y referencias a coordenadas.

**Qué NO pude hacer, y lo digo explícitamente:**

| Verificación | Estado | Motivo |
|---|---|---|
| Comportamiento real de PostgREST ante un filtro no-UUID | ⚠️ Deducción, no ejecución | No hay proyecto Supabase configurado (`.env.local` sin credenciales) y el entorno bloquea la salida de red |
| Planes de ejecución reales de Postgres (`EXPLAIN`) | ⚠️ No ejecutado | Requiere una base con datos |
| Retención de respaldos del plan de Supabase | ⚠️ No consultado | Dato dependiente del plan contratado; incluyo el procedimiento, no una cifra |
| Todo lo demás (estructura, tipos, políticas, consultas, flujos) | ✅ Verificado leyendo el archivo y su línea exacta | — |

Donde digo "error 22P02" me refiero al comportamiento documentado de PostgREST al aplicar un filtro de texto sobre una columna `uuid` (rechaza la consulta en lugar de devolver cero filas). **Debe confirmarse en el primer despliegue con credenciales reales**; el paso 3 de la Fase 1 (§6) cubre exactamente esa comprobación.

---

## 3. Inventario verificado del estado actual

### 3.1 Modelo de datos en la base (`supabase/esquema.sql`)

| Tabla | Columnas relevantes | Restricciones actuales | Estado |
|---|---|---|---|
| `usuarios` | `id` (PK = `auth.users.id`), `email`, `nombre`, `rol`, `creado_en` | FK a `auth.users` **on delete cascade**, `rol` con CHECK, `email` unique | ⚠️ Parcial |
| `pensiones` | `id` uuid, `anfitrion_id`, `titulo`, `descripcion`, `precio_mensual`, `direccion`, `barrio`, `distancia_a_pie_minutos`, `servicios[]`, `normas[]`, `imagenes[]`, `calificacion`, `verificado`, `latitud`, `longitud`, `activa`, `creada_en` | CHECKs de rango en `precio_mensual`, `distancia_a_pie_minutos` y `calificacion`; 2 índices | ⚠️ Parcial |
| `habitaciones` | `id`, `pension_id`, `tipo`, `genero`, `precio_mensual_cop`, `alimentacion_incluida`, `disponible`, `creada_en` | CHECKs de enumeración; 1 índice | ⚠️ Parcial |

### 3.2 Flujo de datos real (verificado)

```
Supabase (Postgres + RLS)
        │  PostgREST
        ▼
lib/datos.ts          ← ÚNICO punto de acceso. 2 consultas + JOIN en memoria (combinar)
        │
        ├── (cookies)  utils/supabase/server.ts    → panel del anfitrión
        └── (anónimo)  utils/supabase/publico.ts   → catálogo/detalle (ISR, revalidate 60)
        ▼
lib/supabase/mapeo.ts ← traducción fila SQL → dominio (mapeo.ts:56-79)
        ▼
lib/pension.ts        ← reglas de negocio puras
        ▼
app/page.tsx → components/CatalogoInteractivo.tsx (filtra en el cliente)
app/pensiones/[id]/page.tsx
```

**Escrituras existentes en todo el proyecto:** exactamente **una** — `supabase.from("pensiones").insert(...)` en `app/actions/pensiones.ts:104`. No hay ningún `update`, `delete` ni `rpc` en el código de la aplicación.

### 3.3 Trazabilidad del contrato de tipos

| Campo de dominio (`types/index.ts`) | Columna SQL | Mapeo | Observación |
|---|---|---|---|
| `precioMensual` | `precio_mensual` | `mapeo.ts:64` | Denormalización sin dueño (H-12) |
| `imagenes` (la 1.ª es la principal) | `imagenes text[]` | `mapeo.ts:57,67` | Sin `alt` ni orden explícito (H-10) |
| `latitud`/`longitud` | `latitud`/`longitud` | `mapeo.ts:75-76` | Ninguna ruta las escribe (H-20) |
| `verificado`, `calificacion` | `verificado`, `calificacion` | `mapeo.ts:73-74` | Sin trazabilidad de quién los asignó (H-16) |
| `Usuario` / `rol` | `usuarios.rol` | **sin mapeo** | El tipo y la columna existen; nadie los lee (H-14) |

---

## 4. Hallazgos

**Escala de esfuerzo:** 🟢 S = menos de 2 h · 🟡 M = 2–8 h · 🔴 L = más de 8 h (1–3 días, incluye pruebas).
**Prioridad:** 🔴 Crítica (bloquea el lanzamiento) · 🟠 Alta (necesario para operar) · 🟡 Media (necesario para escalar).

---

### 🔴 H-01 — El espacio de identificadores de la demo es incompatible con el de la base

**Evidencia**

- `lib/datos.semilla.ts:22` — `id: "pension-costa-verde"` (slug de texto). Lo mismo en `:44, :66, :84, :112, :134`.
- `supabase/esquema.sql:24` — `id uuid primary key default gen_random_uuid()`.
- `lib/datos.ts:73` — `.eq("id", id)`, donde `id` viene **directo de la URL** (`app/pensiones/[id]/page.tsx:65`).
- `lib/datos.ts:77-80` — si la consulta falla, **devuelve el registro de la semilla**.

**Impacto**

Con Supabase configurado, pedir cualquier URL de la semilla (`/pensiones/pension-costa-verde`) envía un texto a una columna `uuid`: PostgREST rechaza el filtro (error `22P02`, *invalid input syntax for type uuid*) en lugar de devolver cero filas. El `catch` de `lib/datos.ts:79` lo convierte en "no está en la base, búscalo en la demo" y **sirve la pensión ficticia como si fuera real**, con el mismo aspecto y el mismo botón de WhatsApp que una real. Además, los enlaces que ya circulan por WhatsApp (`app/pensiones/[id]/page.tsx:173-175` usa `pension.id` en el mensaje) son slugs: esos enlaces ya compartidos apuntarían a datos de demostración para siempre.

**Propuesta**

Dar a cada pensión una **URL estable independiente del motor de datos**. Dos piezas, ambas aditivas:

1. Añadir `slug text` único a `pensiones` (§7, migración 0002), generado por trigger desde `titulo + barrio` y con sufijo numérico en caso de colisión.
2. Enrutar por slug (`/pensiones/[slug]`), manteniendo el UUID como PK interna; redirección permanente (308) de la URL antigua a la nueva para no romper los enlaces compartidos.

Como paso intermedio y con coste casi nulo: **desactivar el fallback de la semilla cuando Supabase sí está configurado** (H-05), que es lo que convierte este fallo silencioso en un 404 honesto.

**Esfuerzo:** 🟡 M · **Prioridad:** 🔴 Crítica

---

### 🔴 H-02 — La política UPDATE de `habitaciones` no valida la fila nueva

**Evidencia**

`supabase/esquema.sql:154-161`:

```sql
create policy "habitaciones: editar las propias" on public.habitaciones
  for update using (
    exists (select 1 from public.pensiones p
            where p.id = habitaciones.pension_id and p.anfitrion_id = auth.uid())
  );
```

Comparar con la política equivalente de `pensiones` (`esquema.sql:126-128`), que sí incluye `with check (auth.uid() = anfitrion_id)`.

**Impacto**

En PostgreSQL, la cláusula `USING` de un `UPDATE` evalúa la **fila anterior**; sin `WITH CHECK`, la **fila nueva no se valida nunca**. Un anfitrión autenticado puede ejecutar un `PATCH` directo contra PostgREST y **mover su propia habitación a la pensión de otro anfitrión**. La fila se actualiza (la USING se cumple sobre el estado antiguo) y el anuncio ajeno queda con una habitación inyectada — habitación que además altera su "precio desde" (`lib/pension.ts:34-38` calcula el mínimo de las habitaciones de esa pensión). Es una escritura cruzada entre inquilinos, no un simple error de validación.

**Propuesta**

Añadir `with check (auth.uid() = anfitrion_id)` (una línea) **y** cerrar la vía por diseño con la clave foránea compuesta de H-09: si `habitaciones.anfitrion_id` debe coincidir obligatoriamente con `pensiones.anfitrion_id`, la base hace imposible el escenario aunque una política se escriba mal en el futuro. Ver §7, migración 0004.

**Esfuerzo:** 🟢 S · **Prioridad:** 🔴 Crítica

---

### 🔴 H-03 — La integridad vive en el formulario, no en la base de datos

**Evidencia**

El esquema (`supabase/esquema.sql:23-47`) solo impone: `titulo not null`, `precio_mensual >= 0`, `distancia_a_pie_minutos between 0 and 120`, `calificacion between 0 and 5`. **No hay ninguna restricción de longitud, de cantidad de elementos ni de formato de URL.**

Toda la validación real está en `app/actions/pensiones.ts:17-23, 80-102`: título ≥ 6 caracteres, descripción ≥ 30, dirección ≥ 5, precio > 0 y ≤ 20.000.000, máx. 12 servicios, 8 normas y 8 imágenes.

Pero la política de inserción (`esquema.sql:122-124`) solo exige `auth.uid() = anfitrion_id`. **Cualquier cuenta autenticada puede publicar saltándose el formulario** con un `POST /rest/v1/pensiones` desde la consola del navegador.

**Impacto**

Un anfitrión (o cualquiera que consiga una cuenta, y el registro es abierto) puede insertar títulos de 5.000 caracteres, 400 imágenes, `precio_mensual = 0`, `servicios` con texto arbitrario y HTML/scripts en `descripcion`. El catálogo no escapa el contenido: lo renderiza. Es un problema de **integridad y de seguridad**, y la única barrera es una interfaz — la barrera más fácil de rodear que existe.

**Propuesta**

Trasladar a la base las reglas que ya existen en el formulario, como CHECKs (ver §7, migración 0002): longitud de `titulo`/`descripcion`/`direccion`, `cardinality()` máximo de `servicios`, `normas` e `imagenes`, y una función `url_valida(text)` reutilizable para validar las URLs de imágenes. Regla de arquitectura a adoptar desde ahora: **la base es la última línea de defensa; el formulario es comodidad.**

**Esfuerzo:** 🟡 M · **Prioridad:** 🔴 Crítica

---

### 🔴 H-04 — No existe ciclo de publicación ni moderación

**Evidencia**

- `supabase/esquema.sql:45` — `activa boolean not null default true`.
- `app/actions/pensiones.ts:115` — el servidor inserta con `activa: true` directamente.
- `app/pensiones/[id]/page.tsx:164-168` y `components/SelloVerificado.tsx` — la interfaz muestra "✓ Verificada por el equipo (inspección presencial)".

**Impacto**

Un anuncio aparece en el catálogo **en el mismo instante** en que se envía el formulario, sin revisión humana, sin comprobar que el teléfono es real, sin comprobar que la dirección existe y sin poder pausarlo ni retirarlo desde ninguna interfaz (no hay `update` en el código). El marketplace comunica confianza (cuatro sellos, badge de verificación) que la operación no puede sostener. Además, al no poder pausar, no hay forma de retirar una publicación fraudulenta salvo entrando al panel de Supabase.

**Propuesta**

Separar los dos conceptos que hoy están fundidos en un solo booleano:

| Concepto | Columna | Quién lo controla |
|---|---|---|
| Ciclo editorial | `estado` (`borrador` → `en_revision` → `publicada` / `pausada` / `rechazada`) | Operación / moderación |
| Disponibilidad del anuncio | `activa` (se conserva **con su significado actual**) | Sistema y anfitrión |

La lectura pública pasa a exigir **ambos**: `activa and estado = 'publicada'`.

> **Decisión deliberada para no romper nada:** en la migración inicial el default de `estado` es `'publicada'`, de modo que el comportamiento observable es **idéntico al de hoy** (`lib/datos.ts:48` sigue filtrando `activa = true` y todo sigue apareciendo al instante). Cambiar el default a `'en_revision'` es una migración posterior que **debe ir acompañada de la pantalla de moderación**: si se cambia antes, los anuncios nuevos dejarán de aparecer y parecerá que "se rompió la publicación".

**Esfuerzo:** 🟡 M (esquema) + 🟡 M (pantalla de moderación) · **Prioridad:** 🔴 Crítica

---

### 🔴 H-05 — El catálogo de demostración se sirve en producción y oculta los fallos

**Evidencia**

`lib/datos.ts:42, 52-55, 58-61` — tres salidas distintas hacia `catalogoDemo()`: Supabase no configurado, error de consulta y excepción de red. En los tres casos la aplicación responde con las 6 pensiones ficticias de `lib/datos.semilla.ts`.

La documentación lo presenta como virtud: `docs/integracion-supabase.md:24` — *"Si Supabase falla o no está configurado, la app cae automáticamente al catálogo semilla. El sitio nunca queda vacío ni con error."*

**Impacto**

En un marketplace, una caída de la base de datos debe producir un error visible, no un catálogo convincente de alojamientos que **no existen**. Las tarjetas demo muestran precios, fotos, barrios y un botón "Reservar por WhatsApp" operativo con el número real de la plataforma. Un estudiante foráneo —o su padre— puede escribir para reservar una habitación ficticia. El fallo se convierte en una **pérdida de confianza** y en trabajo de soporte, y lo peor: **nadie del equipo se entera de que la base está caída**, porque la web "funciona".

**Propuesta**

Introducir una bandera explícita, con el valor por defecto en el lado seguro:

```
# .env.local (desarrollo)
PERMITIR_CATALOGO_DEMO=true

# .env.production
PERMITIR_CATALOGO_DEMO=false
```

Con `false`, un fallo de Supabase devuelve lista vacía y el error se propaga a la frontera de error que ya existe (`app/error.tsx`), mostrando "no pudimos cargar el catálogo, reintenta" en lugar de datos falsos. En desarrollo se mantiene la comodidad actual. Complemento: un aviso visible cuando el número de pensiones activas cae a cero (§9, consulta 6).

**Esfuerzo:** 🟢 S · **Prioridad:** 🔴 Crítica

---

### 🟠 H-06 — El flujo de publicación no crea habitaciones: los anuncios nacen incompletos

**Evidencia**

- `components/FormularioPension.tsx` — el formulario recoge título, precio, distancia, dirección, barrio, descripción, servicios, normas e imágenes. **No recoge tipo, género ni alimentación de habitación.**
- `app/actions/pensiones.ts:104-116` — el único `insert` del proyecto escribe en `pensiones`.
- Búsqueda en todo el código: **cero escrituras sobre `habitaciones`**.
- Consecuencia en el motor de filtros (`lib/filtros.ts:81-85`):

```ts
const disponibles = habitacionesDisponibles(p);
if (disponibles.length === 0) {
  if (f.soloConAlimentacion || f.genero !== "todos") return false;   // ← desaparece
  return f.precioMaximoCop === 0 || p.precioMensual <= f.precioMaximoCop;
}
```

y en la presentación (`lib/pension.ts:53`): `"Sin habitaciones publicadas todavía"`.

**Impacto**

Es **el agujero funcional más grave del salto a datos reales**: un anfitrión se registra, publica su pensión con todo el esfuerzo que eso supone, y su anuncio **queda invisible para cualquier estudiante que use los filtros de género o de alimentación** —los dos filtros más usados en alojamiento estudiantil— y se muestra sin precio por habitación. Todo el plan de escalado (pasar de mock a datos reales, que los anfitriones publiquen) produce un catálogo que no responde a los filtros del producto. Las políticas de escritura de `habitaciones` (`esquema.sql:145-170`) son hoy **código muerto**: ningún camino de la aplicación las usa.

**Propuesta**

Convertir la publicación en una operación **atómica** mediante una función RPC `publicar_pension(...)` (§7, migración 0005) que inserte la pensión **y** su primera habitación en una sola transacción, invocada desde el Server Action con `supabase.rpc()`.

Diseño recomendado: el formulario pide una **"habitación principal" obligatoria** (tipo, género, precio, alimentación) y ofrece un botón "añadir otra habitación". Con una sola habitación obligatoria ya se cierra el agujero; el gestor completo de habitaciones es un paso posterior. Si la inserción de la habitación falla, la transacción revierte y **no queda un anuncio huérfano**.

**Esfuerzo:** 🟡 M · **Prioridad:** 🟠 Alta

---

### 🟠 H-07 — Dos consultas sin paginar, `select('*')` y el JOIN en memoria

**Evidencia**

`lib/datos.ts:46-50`:

```ts
await Promise.all([
  supabase.from("pensiones").select("*").eq("activa", true).order("creada_en", { ascending: false }),
  supabase.from("habitaciones").select("*"),          // ← todas las habitaciones del sistema
]);
```

`lib/datos.ts:20-30` — `combinar()` hace `habitaciones.filter(...)` **dentro** de un `map` sobre las pensiones: O(n × m) en JavaScript, en cada revalidación.

`components/CatalogoInteractivo.tsx:73` — `aplicarFiltros(pensiones, filtros, favoritos)` dentro de un `useMemo`: **el filtrado ocurre en el navegador sobre la lista completa**.

`lib/datos.ts:108-110` — el panel del anfitrión usa `.in("pension_id", ids)` con todos sus identificadores: la URL de PostgREST crece sin límite con el número de publicaciones.

**Impacto**

Hoy, con 6 pensiones, es imperceptible. Con 300 pensiones y 900 habitaciones, **cada revalidación de cada visitante** transfiere y transforma todo el catálogo, y el HTML/payload RSC que recibe un móvil en una conexión 3G de Santa Marta incluye las 300 fichas completas —incluidas `descripcion`, `normas` y coordenadas que la tarjeta no usa— para mostrar 6 tarjetas. Es la deuda que convierte "funciona" en "no carga".

**Propuesta**

1. **Una sola consulta con JOIN en la base.** PostgREST resuelve el embedding por clave foránea: `pensiones?select=*,habitaciones(*).select(...)` — se elimina la consulta sin filtro y todo el bucle de `combinar()`.
2. **Columnas explícitas** en lugar de `*`: la tarjeta necesita `id, titulo, barrio, direccion, distancia_a_pie_minutos, precio_mensual, imagenes, servicios, calificacion, verificado, latitud, longitud` — ni `normas` ni `descripcion` larga.
3. **Paginación en el servidor**: `range(0, 23)` + `count: "exact"`, con `page` en los parámetros de URL que ya se usan para los filtros (H-05 del informe de rendimiento ya dejó la infraestructura lista). El filtrado en cliente se conserva solo sobre la página ya recibida.
4. Límite de habitaciones por pensión en el embedding (el detalle completo se carga en la ficha).

**Esfuerzo:** 🔴 L · **Prioridad:** 🟠 Alta

---

### 🟠 H-08 — Los índices no corresponden a las consultas que hace la aplicación

**Evidencia**

Índices existentes (`supabase/esquema.sql:49-50, 68`):

```sql
create index pensiones_anfitrion_idx on pensiones (anfitrion_id);
create index pensiones_catalogo_idx  on pensiones (activa, creada_en desc);
create index habitaciones_pension_idx on habitaciones (pension_id, disponible);
```

Consultas reales que hace la aplicación:

| Consulta | Origen | Índice que la cubre |
|---|---|---|
| `where activa = true order by creada_en desc` | `lib/datos.ts:48` | ✅ `pensiones_catalogo_idx` |
| `order by distancia_a_pie_minutos asc` (orden final del catálogo) | `lib/filtros.ts:119` | ❌ **ninguno** |
| `where verificado = true` | filtro de sellos | ❌ ninguno (índice parcial) |
| `where latitud is null` (rama del mapa; siempre cierta hoy) | `app/pensiones/[id]/page.tsx:245` | ❌ ninguno |
| `where anfitrion_id = X` | `lib/datos.ts:100` | ✅ `pensiones_anfitrion_idx` |
| búsqueda de texto | **no existe** (H-15) | ❌ |

**Impacto**

El orden por defecto que el usuario ve es por distancia a pie, y es justamente el único criterio sin índice: hoy se resuelve con un `Sort` en memoria. A 300–5.000 filas sigue siendo tolerable; a partir de ahí el catálogo se degrada justo en la consulta más frecuente del sitio, la del primer impacto.

**Propuesta**

Índices alineados con las consultas reales (§7, migración 0003), incluidos índices **parciales** — que en este caso son ideales porque la mayoría de las filas son irrelevantes para la consulta pública:

```sql
create index pensiones_catalogo_distancia_idx
  on public.pensiones (distancia_a_pie_minutos, creada_en desc)
  where activa and archivada_en is null;
```

Más: `gin (servicios)` si se filtra por servicio en SQL (H-17) e `gin_trgm_ops` sobre `titulo`/`barrio` cuando exista buscador (H-15). **Regla a adoptar:** ningún índice sin una consulta que lo use; al revés también — ninguna consulta del camino crítico sin índice.

**Esfuerzo:** 🟢 S · **Prioridad:** 🟠 Alta

---

### 🟠 H-09 — RLS apoyada en subconsultas y ausencia de `anfitrion_id` en `habitaciones`

**Evidencia**

Todas las políticas de `habitaciones` (`supabase/esquema.sql:135-170`) resuelven el propietario mediante `exists (select 1 from public.pensiones p where ...)`, repetido **cuatro veces**. Y la tabla `habitaciones` (`:55-66`) **no tiene** `anfitrion_id`: el dueño solo se puede conocer pasando por `pensiones`.

**Impacto**

Dos consecuencias:

1. **Correcto pero frágil y costoso de escribir.** Cualquier política nueva (o futura tabla hija: fotos, reseñas, disponibilidad por fechas) tendrá que repetir la subconsulta, y cada repetición es una oportunidad de olvidar el `with check` — exactamente el fallo de H-02. Además la subconsulta se evalúa por fila, y no hay índice sobre `habitaciones.pension_id` para el patrón de lectura pública (el existente es `(pension_id, disponible)`, que sirve por prefijo).
2. **Integridad no garantizada.** Nada impide que una fila de `habitaciones` apunte a una pensión cuyo `anfitrion_id` es distinto del de la habitación. Es precisamente lo que hace posible el ataque de H-02.

> Matiz honesto: la subconsulta de lectura **no es el cuello de botella** — busca por clave primaria, es una búsqueda de índice. El valor de este hallazgo no es la velocidad, es **la integridad y la mantenibilidad de las políticas**.

**Propuesta**

Denormalizar el propietario y **respaldarlo con una clave foránea compuesta**, que es lo que convierte la regla en ineludible:

```sql
create unique index pensiones_id_anfitrion_uk on public.pensiones (id, anfitrion_id);

alter table public.habitaciones
  add constraint habitaciones_pension_fk
  foreign key (pension_id, anfitrion_id)
  references public.pensiones (id, anfitrion_id) on delete cascade;
```

Con `habitaciones.anfitrion_id not null`, las cuatro políticas se reducen a `auth.uid() = anfitrion_id`, que es **plano, indexable y difícil de escribir mal**. (§7, migración 0004.)

**Esfuerzo:** 🟡 M · **Prioridad:** 🟠 Alta

---

### 🟠 H-10 — Imágenes: URLs externas sin validar y el optimizador abierto a cualquier origen

**Evidencia**

- `supabase/esquema.sql:37` — `imagenes text[] not null default '{}'`: sin límite de cantidad ni validación de contenido.
- `app/actions/pensiones.ts:74-78` — la única validación es `/^https?:\/\/\S+$/i.test(url)`: acepta **cualquier** host, sin comprobar que la respuesta sea una imagen ni su tamaño.
- `next.config.mjs:10-14`:

```js
remotePatterns: [
  { protocol: "https", hostname: "images.unsplash.com" },
  { protocol: "https", hostname: "**.supabase.co" },
  { protocol: "https", hostname: "**" },        // ← cualquier host https
],
```

- `components/FormularioPension.tsx:186-199` — el anfitrión pega URLs a mano.
- `lib/pension.ts:16-18` — la imagen principal es "la primera del arreglo", sin orden explícito; **no existe campo `alt`**, y `app/pensiones/[id]/page.tsx:124` lo improvisa con `Fachada o sala principal de ${titulo}`.

**Impacto**

1. **El optimizador de imágenes del sitio funciona como proxy abierto** para cualquier URL https (comentado de forma explícita en el propio archivo, línea 7). Cualquiera puede usar tu dominio y tu cuota para reescribir imágenes ajenas; con `formats: ["image/avif","image/webp"]` el coste de CPU lo pagas tú. Mitigado parcialmente por `dangerouslyAllowSVG: false` y `contentDispositionType: "attachment"` (bien puesto), pero no cerrado.
2. **Enlaces que se rompen sin aviso.** El anfitrión pega la URL de su foto en Google Drive o de una carpeta compartida: el enlace caduca o no es una imagen directa y la pensión aparece con huecos rotos. La aplicación no puede verificarlo y nadie se entera.
3. **Accesibilidad y SEO.** Sin `alt` real por imagen, se pierde la señal semántica que el trabajo de SEO del equipo está intentando construir.

**Propuesta** (por fases, sin romper el tipo `imagenes: string[]`)

- **Fase 1 — cerrar la puerta abierta:** dejar `remotePatterns` en `**.supabase.co` + `images.unsplash.com` y validar en el servidor que cada URL apunte al dominio de almacenamiento propio. Es un cambio de configuración, no de modelo.
- **Fase 2 — Supabase Storage con RLS por carpeta:** bucket público `fotos-pensiones` con límite de 5 MB, `image/jpeg|png|webp`, subida directa firmada y políticas que solo permiten escribir en `{auth.uid()}/...` (§7, migración 0006). El anfitrión sube desde el móvil en lugar de pegar enlaces, que además mejora la conversión del formulario.
- **Fase 3 — metadatos de imagen:** tabla `pension_imagenes (pension_id, url, alt, orden)`, manteniendo `imagenes text[]` como columna derivada por trigger. Así el contrato de tipos (`Pension.imagenes: string[]`) **no cambia** y `components/Carrusel.tsx` sigue funcionando igual.

**Esfuerzo:** 🟡 M (fases 1–2) + 🟡 M (fase 3) · **Prioridad:** 🟠 Alta

---

### 🟠 H-11 — Operación: sin migraciones versionadas, sin entornos separados y con una semilla no reproducible

**Evidencia**

- Un único archivo manual: `supabase/esquema.sql` (177 líneas) que el operador pega en el SQL Editor (`docs/integracion-supabase.md:45-47`). No hay numeración, historial ni registro de qué versión está aplicada. `package.json` no incluye la CLI de Supabase ni ningún script de migración.
- El valor por defecto de la semilla **no es migrable**: `lib/datos.semilla.ts:18` define `ANFITRION_DEMO = "00000000-0000-0000-0000-000000000001"`, que **no existe en `auth.users`**; insertar esas 6 filas en la base violaría la clave foránea `pensiones.anfitrion_id → usuarios.id` (`esquema.sql:25`).
- `supabase/datos-ejemplo.sql` esquiva el problema asignando todo al primer anfitrión registrado (`:15-19`) e identificando cada pensión **por su título** (`:26, :55, :84, :111, :140, :168`).
- No hay configuración de entorno de ensayo ni programa de respaldos.

**Impacto**

1. **No se sabe qué esquema está en producción.** Tras el tercer cambio "ya aplicado a mano" se pierde la trazabilidad, y aplicar un cambio pasa a ser una operación de riesgo.
2. **La semilla depende del estado del entorno.** Si el anfitrión de pruebas cambia (o se borra, y con la cascada de `esquema.sql:11` se borran sus anuncios) las 6 pensiones de ejemplo quedan huérfanas o desaparecen. Y si alguien corrige una tilde en un título, la siguiente ejecución **duplica** la pensión: la idempotencia por texto es frágil por construcción.
3. **Sin entorno de ensayo, cada prueba se hace contra los datos reales.** El proyecto ya sufrió una corrupción de caché `.next` por concurrencia de procesos; un `drop table` accidental en el único proyecto es el mismo tipo de riesgo, con consecuencias peores.

**Propuesta**

1. **Migraciones versionadas** en `supabase/migrations/` (`0001_esquema_inicial.sql`, `0002_...`), aplicadas con `supabase db push` y verificadas en CI. Para adoptar el esquema actual sin re-ejecutarlo, usar `supabase migration new esquema_inicial` + `supabase migration repair --status applied 0001`.
2. **Semilla con UUID deterministas** y `insert ... on conflict (id) do nothing`, sin depender del título ni del "primer anfitrión". Complemento: crear el anfitrión de demostración mediante la API de administración o un `insert` en `auth.users` controlado, en lugar de improvisarlo.
3. **Dos proyectos**: `staging` y `producción`, enlazados con `supabase link --project-ref`. Todo cambio se prueba primero en `staging`.
4. **Respaldo automático + restauración probada.** Un `pg_dump` diario a almacenamiento externo y, al menos una vez por trimestre, **restaurar el respaldo en `staging` y verificarlo**: un respaldo que nunca se ha restaurado no es un respaldo. Confirma además en *Settings → Database* cuál es la retención que ofrece tu plan, y no la des por supuesta.

**Esfuerzo:** 🟡 M · **Prioridad:** 🟠 Alta

---

### 🟠 H-12 — `precioMensual` es una denormalización sin dueño

**Evidencia**

Conviven dos precios con la misma semántica:

- `pensiones.precio_mensual` (`supabase/esquema.sql:30`) → `Pension.precioMensual` (`types/index.ts:30`, documentado como *"precio de referencia si no hay habitaciones"*).
- `habitaciones.precio_mensual_cop` (`esquema.sql:62`) → `Habitacion.precio_mensual_cop`.

`lib/pension.ts:34-38` **recalcula** el mínimo de las habitaciones disponibles y solo cae a `precioMensual` cuando no hay habitaciones.

Verificación sobre los datos reales del proyecto (`supabase/datos-ejemplo.sql`), comparando `precio_mensual` con el mínimo de habitaciones disponibles:

| Pensión | `precio_mensual` | Mín. habitación disponible | ¿Coincide? |
|---|---|---|---|
| Pensión Costa Verde | 550.000 | 550.000 | ✅ |
| Residencia El Pando | 480.000 | 480.000 | ✅ |
| Hogar Santa Marta | 450.000 | 450.000 | ✅ |
| Pensión La Marina | 1.050.000 | 1.050.000 | ✅ |
| Casa Estudiantil San Fernando | 500.000 | 500.000 | ✅ |
| Residencias Los Troncos | 520.000 | 520.000 | ✅ |

**Las 6 coinciden.** Es decir: hoy la columna es **información duplicada de la que nadie es responsable**. En cuanto un anfitrión añada una habitación más barata (o ponga una en `disponible = false`), `precio_mensual` quedará obsoleto y **nada lo detectará**: la base no tiene forma de saberlo, y la aplicación usa el cálculo, no la columna, así que la incoherencia es invisible hasta que alguien lea la tabla o consulte por SQL.

**Impacto**

Es una bomba de relojería silenciosa. Se manifestará en cuanto se implemente lo primero que necesita ordenar o filtrar **por precio en la base** (que es el camino natural de H-07): la consulta devolverá precios distintos de los que muestra la interfaz, y el bug se atribuirá al frontend.

**Propuesta — dos opciones, con recomendación**

| | Opción A (recomendada ahora) | Opción B (estado objetivo) |
|---|---|---|
| Qué | Mantener `precio_mensual` como **"precio desde" canónico**, sincronizado por **trigger** sobre `habitaciones` (INSERT/UPDATE/DELETE), con respaldo al valor indicado por el anfitrión cuando no hay habitaciones | Eliminar la columna y exponer una vista `pensiones_catalogo` con `min(precio_mensual_cop) filter (where disponible)` |
| Ventaja | No toca ni una línea de TypeScript; `precioMensual` sigue existiendo y significando exactamente lo mismo; permite `ORDER BY` y `WHERE` por precio en SQL | Una sola fuente de verdad, imposible desincronizar |
| Coste | Un trigger que hay que escribir bien (incluido el caso de mover una habitación de pensión) | Cambia la fuente de lectura de `pensiones` a la vista; el mapeo hay que ajustarlo |

Elijo **A** ahora y dejo **B** como evolución documentada, porque el criterio de esta auditoría es no romper el contrato existente y A lo consigue con riesgo casi nulo (§7, migración 0003 incluye el trigger). Sea cual sea la opción, añadir la consulta de detección de deriva del anexo §9 (consulta 1) como comprobación periódica.

**Esfuerzo:** 🟡 M (A) / 🟡 M + tocar mapeo (B) · **Prioridad:** 🟠 Alta

---

### 🟠 H-13 — Sin `actualizado_en`, sin borrado lógico y con cascadas destructivas

**Evidencia**

- `supabase/esquema.sql:11` — `usuarios.id references auth.users(id) on delete cascade`.
- `supabase/esquema.sql:25` — `pensiones.anfitrion_id references public.usuarios(id) on delete cascade`.
- `supabase/esquema.sql:57` — `habitaciones.pension_id references public.pensiones(id) on delete cascade`.
- Ninguna tabla tiene columna de modificación: `creada_en` es lo único temporal (`:15, :46, :65`).

**Impacto**

1. **Borrado en cascada desde la autenticación.** Una baja de cuenta (`delete from auth.users`) provoca el borrado del perfil y, en cadena, **de todos sus anuncios y sus habitaciones**, sin posibilidad de recuperación y sin rastro. En un marketplace lo correcto suele ser conservar el histórico y anonimizar, porque hay otros datos que dependen de él (favoritos de estudiantes, enlaces compartidos, estadísticas).
2. **No hay auditoría temporal.** No se puede responder a "¿cuándo cambió este precio?", "¿cuándo se desactivó este anuncio?", preguntas obligatorias en cualquier disputa entre estudiante y anfitrión.
3. **No hay borrado reversible en la aplicación.** Combinado con H-04 (no existe `update` ni `delete` en el código), la única forma de retirar un anuncio problemático es entrar al panel de Supabase y borrarlo — irreversible.

**Propuesta**

- Añadir `actualizado_en timestamptz not null default now()` con trigger, y `archivada_en timestamptz` para borrado lógico; `lib/datos.ts` filtra por `archivada_en is null` (una condición, aditiva).
- Cambiar la cascada destructiva por conservación: `anfitrion_id` pasa a nullable con `on delete set null`, o `on delete restrict` si se prefiere impedir la baja mientras haya anuncios activos. En ningún caso borrar publicaciones silenciosamente.
- Complemento de valor para la confianza: tabla `eventos_pension` (append-only) que registre creación, cambio de estado, cambio de precio y quién lo hizo. Es la materia prima para resolver disputas.

**Esfuerzo:** 🟡 M · **Prioridad:** 🟠 Alta

---

### 🟡 H-14 — El campo `rol` existe pero no autoriza nada, y el usuario puede cambiarlo

**Evidencia**

- `types/index.ts:13, 20` — `RolUsuario` y `Usuario.rol`.
- `supabase/esquema.sql:14` — `rol text not null default 'anfitrion' check (rol in ('estudiante','anfitrion'))`.
- `components/FormularioRegistro.tsx:39` — el registro envía `data: { nombre, rol: "anfitrion" }`; el trigger (`esquema.sql:85-89`) lo copia.
- Búsqueda de `.rol` en todo el código de la aplicación: **el único uso es escribirlo**. Ninguna consulta, ninguna política y ninguna decisión de negocio lo lee.
- `supabase/esquema.sql:113-115` — política `usuarios: actualizar el propio` sin restricción de columnas.
- `types.Usuario` **no se importa en ningún archivo**: el tipo es decorativo hoy.

**Impacto**

1. **Autorización ausente.** La distinción estudiante/anfitrión no protege nada: cualquier cuenta —incluida una creada por un estudiante— puede publicar anuncios. La política de inserción (`esquema.sql:122-124`) solo mira `auth.uid() = anfitrion_id`, y como al registrarse todos entran como `anfitrion`, el rol no discrimina.
2. **El rol es auto-modificable.** El usuario puede hacer `PATCH /rest/v1/usuarios?id=eq.<su-id>` con `{"rol":"estudiante"}` — o al revés — porque la política lo permite sin restringir columnas. Hoy el impacto es nulo porque nadie lee el campo; en el momento en que una política dependa de `rol`, será una escalada de privilegios.
3. **`email` y `nombre` duplican `auth.users`** (`esquema.sql:12-13`) sin sincronización: un cambio de correo en la autenticación deja la copia desactualizada de forma permanente.

**Propuesta**

- Exigir el rol en la autorización real: política de inserción en `pensiones` que además valide `exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'anfitrion')`.
- Proteger la columna: trigger `before update` que restablezca `rol`, `id` y `creado_en` al valor anterior salvo que el rol de la petición sea `service_role` (§7, migración 0004).
- Sincronizar por trigger `after update of email on auth.users`, o **eliminar la copia** y exponer el correo solo desde la sesión (es lo que la interfaz hace ya: `app/publicar/page.tsx:48` usa `user.email`, no la tabla).
- Decidir explícitamente si el nombre del anfitrión debe ser público en la ficha. Si sí, exponerlo mediante una **vista restringida** (`id, nombre`) y no abriendo la política de `usuarios`, que hoy solo permite leer la fila propia (`esquema.sql:110-111`) — decisión correcta que conviene preservar.

**Esfuerzo:** 🟡 M · **Prioridad:** 🟡 Media-alta

---

### 🟡 H-15 — Sin búsqueda de texto ni ordenamientos alternativos

**Evidencia**

- `lib/datos.ts:48` — única consulta del catálogo: `.order("creada_en", { ascending: false })`.
- `lib/filtros.ts:119` — el orden final que ve el usuario se reordena **en el cliente** por distancia: `.sort((a, b) => a.distancia_a_pie_minutos - b.distancia_a_pie_minutos)`.
- No existe parámetro ni campo de búsqueda en `FiltrosUI` (`lib/filtros.ts:11-19`) ni en los tipos (`types/index.ts:70-78`): `precioMaximoCop`, `genero`, `rangoDistancia`, `soloConAlimentacion`, `soloVerificadas`, `soloFavoritas`. **No hay `q`.**
- No hay extensiones habilitadas en `esquema.sql`: `pg_trgm` no está instalada.

**Impacto**

El caso de uso más frecuente de un estudiante que llega desde Google buscando "pensión cerca de Unimagdalena" es buscar por **barrio** ("Mamatoco", "El Pando", "Gaira") o por nombre. Hoy solo puede mover un slider de precio y marcar casillas. Y no puede ordenar por "más baratas" ni por "mejor puntuadas", que son los dos órdenes que un marketplace inmobiliario necesita. El problema se agrava con H-07: sin búsqueda en el servidor, la única forma de buscar sería filtrar en el navegador sobre las filas ya descargadas, lo que no escala.

**Propuesta**

- `q` en los parámetros de URL (la infraestructura de serialización ya existe en `lib/filtros.ts:123-161`), resuelto con `websearch_to_tsquery` sobre una columna `tsvector` generada, o con `ilike` + índice `pg_trgm` para coincidencias parciales de barrio (más adecuado para nombres propios y errores de escritura).
- `orden` en la URL: `distancia` (por defecto, como hoy), `precio`, `calificacion`, `recientes`. Todos respaldados por índice parcial (§7, migración 0003).
- Instalar `pg_trgm` en el esquema `extensions` de Supabase, que es donde vive por convención.

**Esfuerzo:** 🟡 M · **Prioridad:** 🟡 Media-alta

---

### 🟡 H-16 — `calificacion` y `verificado` sin trazabilidad de quién los asignó

**Evidencia**

- `supabase/esquema.sql:40-41` — `calificacion numeric(2,1) not null default 0 check (calificacion between 0 and 5)` y `verificado boolean not null default false`.
- `types/index.ts:41-48` documenta correctamente que `calificacion` es un *"puntaje INTERNO del equipo, resultante de la inspección presencial"* y que no debe declararse como `aggregateRating` — decisión de integridad excelente, ya aplicada en `app/pensiones/[id]/page.tsx:106-111`.
- **No existe** ninguna tabla, columna ni registro de inspecciones: no se puede saber quién asignó un 4,7, cuándo, con qué criterios, ni por qué una pensión pasó a `verificado = true`.

**Impacto**

El producto vende confianza y no puede demostrarla. Si un estudiante pregunta "¿por qué esta pensión está verificada y esta otra no?", o si un anfitrión reclama su puntuación, no hay respuesta posible: el dato es un número suelto. A escala, y con dinero de por medio, esto es también un riesgo reputacional y legal: se está comunicando una inspección que no está documentada. Además el valor por defecto `0` de la calificación produce fichas con 0,0 estrellas visibles (`components/Estrellas.tsx`), que se leen como "pésima" en lugar de "sin evaluar".

**Propuesta**

- Tabla `inspecciones (id, pension_id, puntaje, criterios jsonb, inspector_id, fecha, evidencia_url)` y derivar `calificacion` y `verificado` de la última inspección mediante vista o trigger. Los campos del contrato de tipos **no cambian**: siguen siendo `number` y `boolean` en `Pension`.
- Distinguir "sin evaluar" de "evaluada con 0": `calificacion` nullable, y la interfaz oculta las estrellas cuando es `null`.
- Guardar la autoría (`inspector_id`) es lo que permite auditar el sello; sin ello, "verificado" no es verificable.

**Esfuerzo:** 🟡 M · **Prioridad:** 🟡 Media-alta

---

### 🟡 H-17 — `servicios text[]` sin catálogo: no se puede filtrar por servicio

**Evidencia**

- `supabase/esquema.sql:35` — `servicios text[] not null default '{}'`: texto libre, sin límite de longitud por elemento ni vocabulario cerrado.
- `components/FormularioPension.tsx:7-16` — el formulario ofrece 8 valores fijos ("WiFi de alta velocidad", "Aire acondicionado", "Lavandería", …), pero **esa lista vive solo en el cliente**.
- `lib/filtros.ts:11-19` — `FiltrosUI` no incluye ningún criterio de servicio, aunque el plan de escalado del proyecto menciona explícitamente "filtros por precio, servicios, ubicación".
- `app/pensiones/[id]/page.tsx:201-222` — los servicios se **muestran** con `key={servicio}`, y `:207` los pinta como lista: si dos valores difieren en un espacio o una tilde ("wifi" y "WiFi"), el catálogo los trata como servicios distintos.

**Impacto**

Sin vocabulario cerrado, los datos degeneran: el mismo servicio escrito de cinco maneras. Y sin normalizar, **no se puede construir el filtro por servicio** (para `text[]` habría que hacer `@>` con el texto exacto, incluidos acentos y espaciado). Es el filtro que más valor tiene en este vertical (WiFi, aire acondicionado, alimentación, lavandería) y hoy está bloqueado por el modelo de datos — no por la interfaz.

**Propuesta**

- Tabla `servicios (id, nombre, icono, orden)` y tabla puente `pension_servicios (pension_id, servicio_id)` con clave primaria compuesta. El formulario deja de ofrecer texto y ofrece el catálogo real, con posibilidad de proponer uno nuevo para revisión.
- Mantener `servicios text[]` como **columna derivada por trigger** desde el puente, de modo que `Pension.servicios: string[]` (`types/index.ts:32`) y todo lo que lo consume (tarjetas, badges, ficha) **sigan funcionando sin cambios**.
- Una vez normalizado, el filtro por servicio es `where exists (select 1 from pension_servicios ...)`, cubierto por el índice de la tabla puente.

**Esfuerzo:** 🟡 M · **Prioridad:** 🟡 Media-alta

---

### 🟡 H-18 — Deriva silenciosa del contrato: tipos escritos a mano, tipos muertos y semilla duplicada

**Evidencia**

- `lib/supabase/mapeo.ts:11-39` — `PensionFila` y `HabitacionFila` están **escritos a mano**, con todos los campos `| null`, en lugar de generarse desde la base. No hay script de generación en `package.json`.
- `lib/supabase/mapeo.ts:64,71,73` — el mapeo convierte null en `0` de forma silenciosa (`Number(fila.precio_mensual ?? 0)`). Si una columna se renombra, el build **sigue pasando** y el precio se convierte en cero sin error.
- Tipos declarados y nunca usados: `EntradaPension` (`types/index.ts:81-91`) y `Filtros` (`types/index.ts:70-76`) — la aplicación usa `FiltrosUI` de `lib/filtros.ts:11-19`. `Usuario` (`types/index.ts:16-22`) tampoco se importa. Lo verifiqué con búsqueda en todo el código fuente.
- Dos fuentes de verdad para los mismos datos de ejemplo: `lib/datos.semilla.ts` (181 líneas) y `supabase/datos-ejemplo.sql` (203 líneas). Hoy coinciden —lo comprobé precio a precio y habitación a habitación— pero nada lo garantiza.

**Impacto**

1. **Un `ALTER TABLE` no rompe la compilación.** El sistema de tipos deja de proteger en la frontera con la base, que es justo donde más importa. Es el tipo de fallo que se descubre en producción con el precio a cero.
2. **Ruido y falsa confianza**: tres tipos declarados que parecen contrato y no se usan; un lector nuevo del código creerá que `Filtros` es la interfaz vigente.
3. **Deriva de los datos de ejemplo**: dos archivos que deben contarse lo mismo, sin comprobación automática.

**Propuesta**

- Script `npm run tipos:bd` → `supabase gen types typescript --linked > types/base-datos.ts`, y tipar `PensionFila` como derivado de ese archivo. Así un cambio de esquema **rompe el build**, que es exactamente lo que queremos.
- Endurecer el mapeo: distinguir "columna ausente" (error) de "valor nulo" (valor por defecto explícito), con una función que falle de forma visible si un campo obligatorio no llega.
- Eliminar `EntradaPension`, `Filtros` y `Usuario`, o darles uso. Recomiendo eliminar los dos primeros (duplican `FiltrosUI` y el `FormData` del Server Action) y conservar `Usuario` solo cuando H-14 lo use de verdad.
- Unificar la semilla: un único JSON y un generador (`scripts/generar-seed.mjs`) que produzca tanto el TS de demo como el SQL de ejemplo. Una comprobación en CI (`scripts/verificar-datos.mjs`, en la línea de los ya existentes `verificar-seo.mjs` y `verificar-contraste.mjs`) que falle si divergen.

**Esfuerzo:** 🟡 M · **Prioridad:** 🟡 Media-alta

---

### 🟡 H-19 — Sin observabilidad: todos los fallos terminan en `console.error`

**Evidencia**

`lib/datos.ts:53, 59, 84, 104, 115` — cinco bloques `catch`/`error` que registran el problema y **continúan** con la degradación. No hay servicio de errores, ni métricas, ni alertas. `app/actions/pensiones.ts:119` aplica el mismo patrón en la escritura.

**Impacto**

Si la clave anónima caduca, si RLS empieza a bloquear una consulta o si una política mal escrita devuelve siempre cero filas, **nadie se enterará**: el sitio seguirá sirviendo el catálogo demo (H-05) o un catálogo vacío, indistinguibles de "no hay pensiones publicadas". Sin métricas tampoco se sabe cuántas pensiones activas hay, ni si el número crece — que es el indicador de negocio del proyecto.

**Propuesta**

- Reporte de errores con captura de contexto (servicio tipo Sentry), aplicado en los cinco puntos de fallo de `lib/datos.ts`.
- Métrica de negocio: `pensiones_activas_total`, con alerta si cae a cero o si el fallback demo se activa en producción.
- Registro estructurado (nivel + operación + duración) en `lib/datos.ts`; hoy una consulta lenta no deja rastro.
- Tabla `vista_eventos` para medir la conversión real (ficha vista → clic a WhatsApp), que es lo que permite decidir con datos y no con intuición.

**Esfuerzo:** 🟢 S (reporte y métrica) · **Prioridad:** 🟡 Media-alta

---

### 🟡 H-20 — `latitud`/`longitud`: sin validación de rango y sin ninguna ruta que las escriba

**Evidencia**

- `supabase/esquema.sql:43-44` — `latitud double precision, longitud double precision`: nulas, sin CHECK, sin restricción de que vayan en pareja.
- `components/FormularioPension.tsx` — el formulario **no pide coordenadas**.
- `app/actions/pensiones.ts:104-116` — el `insert` **no incluye** `latitud` ni `longitud`.
- Búsqueda en todo el código: ninguna escritura de coordenadas en ninguna parte del proyecto.
- `lib/supabase/mapeo.ts:75-76` y `app/pensiones/[id]/page.tsx:94-102, 245-248` — tanto el JSON-LD `geo` como el mapa tratan el caso "sin coordenadas", de modo que la funcionalidad degrada con elegancia al círculo aproximado. Eso está **bien resuelto**; el problema es que **el caso "con coordenadas" es hoy inalcanzable**.

**Impacto**

Dos efectos: (1) la rama "pin exacto" del mapa y el `geo` del JSON-LD son código muerto — nunca se ejecutarán mientras nadie escriba coordenadas; (2) cuando alguien sí las escriba (por carga manual, por SQL, o por una futuro selector de mapa), la base **acepta cualquier valor**, incluidos `latitud = 500` o una latitud de Bogotá para una pensión en Santa Marta, y el JSON-LD declararía a Google una ubicación falsa — el mismo tipo de error de datos estructurados que ya se corrigió en la auditoría anterior.

**Propuesta**

- Añadir CHECKs de rango y de coherencia de pareja (§7, migración 0002): `(latitud is null and longitud is null) or (latitud between -90 and 90 and longitud between -180 and 180)`.
- Y un CHECK de ámbito si se quiere ir más allá: una envolvente del área de Santa Marta (lat 11.10–11.35, lon −74.30 a −74.05), ancha a propósito para no excluir barrios periféricos como Gaira o Los Troncos. Valida de verdad el caso de uso y convierte un dato erróneo en un error de inserción en lugar de un fallo de SEO.
- Dar salida al dato: permitir que el anfitrión marque el punto en el mapa, o derivarlo de la dirección con geocodificación y **guardarlo con confirmación humana** (nunca sin revisar).

**Esfuerzo:** 🟢 S (validación) / 🟡 M (captura de coordenadas) · **Prioridad:** 🟡 Media

---

## 5. Las cuatro decisiones de arquitectura de datos

Estas son las decisiones que el dueño del proyecto pidió explícitamente que evaluara. Para cada una: las opciones, la recomendación y **el porqué**.

### 5.1 `precioMensual` (pensión) vs `habitaciones.precio_mensual_cop` — ¿mantener o unificar?

**Pregunta real detrás de la pregunta:** ¿puede un anuncio existir sin habitaciones?

| Opción | Descripción | Veredicto |
|---|---|---|
| **1. Solo habitaciones** (eliminar `precio_mensual`) | La pensión no tiene precio; el precio siempre sale de una habitación | ❌ **No ahora.** Rompe el flujo actual: el formulario publica sin habitaciones y `lib/pension.ts:36` y `lib/filtros.ts:84` dependen del respaldo. Dejaría anuncios sin ningún precio |
| **2. Solo pensión** (eliminar el precio por habitación) | Un precio por pensión | ❌ **No.** Destruye el filtro por género/alimentación, que es el eje del producto |
| **3. Ambos, sin dueño** (situación actual) | El anfitrión escribe `precio_mensual`; el sistema calcula el mínimo de habitaciones | ❌ **Insostenible.** Es la bomba de H-12: hoy coinciden por casualidad, nada lo garantiza |
| **4. Ambos, con jerarquía explícita y sincronización** ✅ | `precio_mensual` = **"precio desde"** del anuncio, mantenido por trigger desde `habitaciones`; si no hay habitaciones, es el precio de referencia que indica el anfitrión | ✅ **Recomendada** |
| **5. Solo habitaciones + vista** | Igual que 4 pero sin columna: el "precio desde" se calcula en una vista | ✅ **Estado objetivo**, cuando se necesite ordenar por precio en SQL sin mantener un trigger |

**Recomendación: opción 4 ahora, opción 5 como evolución.** El razonamiento: la opción 4 **no cambia ni una línea de TypeScript** — `Pension.precioMensual` sigue existiendo, sigue siendo un `number`, y sigue significando "precio desde". El trigger garantiza la coherencia que hoy es accidental. La opción 5 es más limpia en teoría, pero obliga a cambiar la fuente de lectura del catálogo (de `pensiones` a la vista) y por tanto el mapeo: es un cambio estructural que no aporta valor hasta que exista una necesidad real de escalar las consultas por precio.

**Y lo que NO hay que hacer:** derivar `precio_mensual` del **mínimo absoluto** de habitaciones en lugar del mínimo de las **disponibles**. `lib/pension.ts:35-37` usa solo las disponibles, y es correcto: si la habitación de 450.000 está ocupada, el precio que debe anunciarse es el de la siguiente disponible. El trigger replica exactamente esa regla.

### 5.2 Identidad pública: ¿UUID o slug en la URL?

| Opción | Ventaja | Problema |
|---|---|---|
| UUID en la URL (hoy) | Sin colisiones, sin lógica extra | URL ilegible, no aporta SEO, y **el espacio de IDs de la demo no puede ser UUID** (H-01) |
| Slug en la URL ✅ | Legible, indexable, compartible, y **desacopla la URL del motor de datos**: la demo y la base pueden coexistir sin mezclarse | Requiere unicidad y una estrategia de colisión |

**Recomendación: slug como identidad pública, UUID como clave primaria interna.** No es un capricho estético: es la única solución que resuelve H-01 **sin reescribir la base de datos ni cambiar los datos de la semilla**, porque el slug es un concepto que ambos mundos pueden compartir. La generación por trigger con sufijo numérico ante colisión (§7) evita tener que resolverlo en la aplicación.

**Consecuencia práctica:** `/pensiones/pension-costa-verde-mamatoco` en lugar de `/pensiones/9f3a...`. Y una redirección 308 desde las URL antiguas para no romper los enlaces de WhatsApp ya compartidos.

### 5.3 El catálogo demo: ¿degradación silenciosa o error visible?

| Opción | Efecto en producción |
|---|---|
| Degradación silenciosa (hoy) | La base cae → el usuario ve 6 pensiones falsas y un WhatsApp real. **Nadie se entera del fallo** (H-05) |
| Error visible ✅ | La base cae → "no pudimos cargar el catálogo", el equipo recibe alerta. Se pierde una visita, se conserva la confianza |
| Catálogo vacío sin mensaje | El usuario no entiende si no hay pensiones o el sitio está roto |

**Recomendación: error visible con bandera explícita.** El modo demo debe ser una **herramienta de desarrollo**, no una red de seguridad de producción. La bandera `PERMITIR_CATALOGO_DEMO` lo hace explícito y auditable, y conserva intacta la comodidad actual durante el desarrollo.

### 5.4 Principio rector: la base de datos es la última línea de defensa

Hoy la validación vive donde es más fácil de rodear: el formulario. La consecuencia es H-03 y H-02, y la razón de fondo es que **RLS autoriza por identidad, no por contenido**. Regla para todo el equipo a partir de aquí:

> Si una regla protege la integridad o la seguridad del dato, tiene que poder expresarse como una restricción de la base (CHECK, FOREIGN KEY, UNIQUE, política con `WITH CHECK`, o una función RPC transaccional). El formulario valida para dar buenos mensajes de error; la base valida para que el dato sea correcto.

Esta regla es también la que hace más barato el proyecto a medio plazo: una restricción bien escrita sustituye a una batería de pruebas de integración que nadie mantiene.

---

## 6. Plan de migración por fases

Cada fase es **autónoma y verificable**: si una falla, las anteriores siguen funcionando. Ninguna fase rompe el contrato de tipos ni obliga a tocar `components/` o `app/page.tsx`.

**Antes de empezar cualquier fase:** el proyecto sufre corrupción de `.next` cuando se mezclan `next build` y `next dev`. Todos los pasos de verificación de este plan asumen **un solo proceso a la vez** y usan los lanzadores existentes (`Iniciar-App.bat` / `Iniciar-Dev.bat`), que ya liberan el puerto.

### Fase 0 — Estado actual: dejar de depender de la demo (sin credenciales)

**Objetivo:** cerrar los riesgos que no requieren base de datos, y preparar el terreno.

| # | Paso | Verificación |
|---|---|---|
| 0.1 | Crear el respaldo del proyecto y **comprobarlo** (abrir el .zip y listar archivos) | El respaldo contiene `types/`, `lib/`, `supabase/` y `app/` |
| 0.2 | Incorporar la bandera `PERMITIR_CATALOGO_DEMO` (H-05). En desarrollo `true`; sin definir se comporta como hoy | `npm run build` sin errores; en el HTML de `/` siguen apareciendo las 6 pensiones demo |
| 0.3 | Ejecutar las consultas de diagnóstico del anexo §9 **contra un proyecto de prueba** para obtener la línea base | Se archiva la salida: es la foto "antes" |
| 0.4 | Inicializar el repositorio de migraciones: `supabase init`, y volcar el contenido actual de `esquema.sql` en `supabase/migrations/0001_esquema_inicial.sql` | `supabase migration list` muestra la 0001 |

**Riesgo:** nulo. Ningún paso altera el comportamiento visible.

### Fase 1 — Demo → datos reales (proyecto `staging`)

**Objetivo:** que la aplicación lea y escriba en una base de datos real, con la demo como respaldo de desarrollo.

| # | Paso | Verificación |
|---|---|---|
| 1.1 | Crear **dos** proyectos en Supabase: `pensiones-staging` y `pensiones-prod` | Ambos aprovisionados |
| 1.2 | `supabase link --project-ref <ref-staging>` y `supabase db push` (aplica 0001) | `\dt` en el SQL Editor muestra `usuarios`, `pensiones`, `habitaciones` |
| 1.3 | **Verificar el comportamiento de PostgREST ante un slug** (confirma H-01 en vivo): consultar `pensiones?id=eq.pension-costa-verde` | Se confirma el error `22P02` → queda documentado el bloqueante |
| 1.4 | Aplicar la migración **0002** (§7): restricciones, `slug`, `estado`, `actualizado_en`, coordenadas | Las consultas 1–5 del anexo §9 devuelven lo esperado |
| 1.5 | Cargar la semilla **con UUID deterministas** y `on conflict do nothing` (sustituye a `datos-ejemplo.sql`, que depende del título y del "primer anfitrión") | `select count(*) from pensiones` = 6; `select count(*) from habitaciones` = 16 |
| 1.6 | Configurar `.env.local` con las credenciales de `staging` y reiniciar | `/` muestra los datos de la base; `/publicar` deja de mostrar el aviso de "modo dinámico pendiente" |
| 1.7 | Recorrer el flujo completo: registro → publicación → aparición en el catálogo | La pensión nueva aparece en `/` y su ficha responde |
| 1.8 | Comprobación de no-regresión: `npm run build`, `node scripts/verificar-seo.mjs`, `node scripts/prueba-humo.mjs` | 16 rutas compiladas, comprobaciones en verde |

**Riesgo medio, mitigado:** todo ocurre en `staging`. Si algo va mal, se apunta `.env.local` de nuevo a la demo (o se comenta) y el proyecto vuelve al estado anterior sin tocar código.

### Fase 2 — Endurecer para producción (bloqueantes de lanzamiento)

**Objetivo:** cerrar H-02, H-03, H-04, H-06, H-09, H-10 (fases 1–2) y H-11.

| # | Paso | Verificación |
|---|---|---|
| 2.1 | Migración **0004**: `with check` en `habitaciones`, `anfitrion_id` + clave foránea compuesta, protección de `rol`, cascadas no destructivas | Se intenta el ataque de H-02 desde el cliente REST con una segunda cuenta → **debe ser rechazado** |
| 2.2 | Migración **0003**: trigger de sincronización de precio (H-12) e índices (H-08) | Consulta 1 del anexo devuelve 0 filas tras insertar una habitación más barata |
| 2.3 | Migración **0005**: RPC `publicar_pension` y su uso desde el Server Action (H-06) | Publicar crea **1 pensión + 1 habitación**; si la habitación es inválida, no queda ninguna pensión |
| 2.4 | Migración **0006**: bucket `fotos-pensiones` con RLS por carpeta y `remotePatterns` restringido (H-10) | Una cuenta A no puede escribir en la carpeta de B; el optimizador rechaza hosts ajenos |
| 2.5 | Ciclo de publicación: `estado` con default `'publicada'` **igual que hoy**; pantalla de moderación cuando exista | Comportamiento observable idéntico al actual (comparar catálogo antes/después) |
| 2.6 | Respaldos y entorno: `pg_dump` diario a almacenamiento externo; `staging` y `prod` separados; **prueba de restauración** | Se restaura un respaldo en `staging` y el catálogo carga |
| 2.7 | Carga inicial de datos reales: visitar y verificar cada pensión antes de publicarla | `select count(*) from pensiones where estado = 'publicada' and verificado` |

**Puerta de salida de la fase:** los 5 bloqueantes del resumen ejecutivo tienen su verificación en verde.

### Fase 3 — Escalar (después de lanzar)

| # | Paso | Hallazgo que cierra |
|---|---|---|
| 3.1 | Paginación server-side + embedding de PostgREST + columnas explícitas | H-07 |
| 3.2 | Buscador por barrio/nombre (`q` en la URL) y ordenamientos (`precio`, `calificacion`, `recientes`) | H-15 |
| 3.3 | `npm run tipos:bd` con tipos generados desde la base; limpieza de tipos muertos; verificación de la semilla en CI | H-18 |
| 3.4 | Reporte de errores y métrica `pensiones_activas_total` | H-19 |
| 3.5 | Automatizar la sincronización de la semilla TS↔SQL | H-18 |

### Fase 4 — Después (solo cuando el producto lo pida)

Normalización de `servicios` con catálogo y filtro por servicio (H-17) · tabla `inspecciones` para hacer trazable el sello "verificado" (H-16) · `eventos_pension` para auditoría y disputas (H-13) · captura de coordenadas reales (H-20) · `pension_imagenes` con `alt` y orden (H-10 fase 3) · reseñas reales de usuarios — que es lo que permitiría volver a emitir `aggregateRating` en el JSON-LD, esta vez con datos legítimos.

---

## 7. DDL propuesto (listo para revisar — **NO ejecutado**)

Cinco archivos que se aplicarían **en orden** con `supabase db push`. Todo es **aditivo y retrocompatible**: nada cambia el nombre de un campo del contrato de tipos, y `lib/datos.ts` sigue funcionando sin modificaciones después de cada migración.

> **Antes de aplicar 0004:** ejecutar la consulta 4 del anexo §9 (duplicados de habitación). El índice único `(pension_id, tipo, genero)` fallará si existen duplicados, y ese fallo es **deseado**: es la base avisando de que hay filas inconsistentes. Resuélvelas a mano antes.
> **Antes de aplicar 0004:** confirmar el nombre real de la clave foránea actual con la consulta 7 del anexo.

### `supabase/migrations/0002_integridad_slug_estado.sql`

```sql
-- ============================================================================
-- 0002 — Integridad en la base, slug público, ciclo de publicación y auditoría.
-- Objetivo: que las reglas que hoy solo valida el formulario pasen a ser
-- restricciones de la base (hallazgo H-03), dar URL estable a cada pensión
-- (H-01) y separar "publicado" de "activo" (H-04).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Slug: función determinista (sin acentos, sin símbolos)
--    Se usa translate() y no unaccent() porque translate es IMMUTABLE y por
--    tanto utilizable en índices y en triggers sin sorpresas.
-- ---------------------------------------------------------------------------
create or replace function public.slugificar(texto text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(
      texto,
      'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
      'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
    )),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

-- ---------------------------------------------------------------------------
-- 1) Columnas nuevas: slug, estado, auditoría temporal, borrado lógico
--    IMPORTANTE: el default de `estado` es 'publicada' para que el
--    comportamiento NO cambie: hoy todo lo publicado aparece al instante
--    (app/actions/pensiones.ts:115 inserta activa=true y lib/datos.ts:48
--    filtra por activa). Cambiar este default a 'en_revision' es una decisión
--    posterior y debe ir junto con la pantalla de moderación: si se cambia
--    antes, las publicaciones nuevas dejarán de aparecer.
-- ---------------------------------------------------------------------------
alter table public.pensiones add column if not exists slug          text;
alter table public.pensiones add column if not exists estado        text not null default 'publicada';
alter table public.pensiones add column if not exists actualizado_en timestamptz not null default now();
alter table public.pensiones add column if not exists archivada_en  timestamptz;

-- Relleno del slug para las filas existentes (idempotente: solo toca las que
-- aún no lo tienen). Los empates se resuelven con sufijo numérico.
with base as (
  select id,
         coalesce(nullif(public.slugificar(titulo || ' ' || coalesce(barrio, '')), ''), 'pension') as base_slug
  from public.pensiones
  where slug is null
),
numerada as (
  select id, base_slug,
         row_number() over (partition by base_slug order by creada_en, id) as n
  from base
)
update public.pensiones p
   set slug = case
                when numerada.n = 1 then numerada.base_slug
                else numerada.base_slug || '-' || numerada.n
              end
  from numerada
 where numerada.id = p.id;

alter table public.pensiones alter column slug set not null;
create unique index if not exists pensiones_slug_uk on public.pensiones (slug);

-- El slug se calcula UNA sola vez y no se recalcula al editar el título:
-- cambiar la URL de un anuncio ya compartido por WhatsApp rompería enlaces.
create or replace function public.pensiones_biu()
returns trigger
language plpgsql
as $$
declare
  v_base      text;
  v_candidato text;
  v_n         int := 1;
begin
  if new.slug is null or new.slug = '' then
    v_base := coalesce(nullif(public.slugificar(new.titulo || ' ' || coalesce(new.barrio, '')), ''), 'pension');
    v_candidato := v_base;
    while exists (
      select 1 from public.pensiones
       where slug = v_candidato and id is distinct from new.id
    ) loop
      v_n := v_n + 1;
      v_candidato := v_base || '-' || v_n;
    end loop;
    new.slug := v_candidato;
  end if;

  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists pensiones_biu_trigger on public.pensiones;
create trigger pensiones_biu_trigger
  before insert or update on public.pensiones
  for each row execute function public.pensiones_biu();

-- ---------------------------------------------------------------------------
-- 2) Restricciones que replican (y refuerzan) la validación del formulario.
--    Las reglas salen de app/actions/pensiones.ts:17-23,80-102 para que la
--    base y la interfaz no discrepen.
-- ---------------------------------------------------------------------------
alter table public.pensiones
  drop constraint if exists pensiones_estado_chk,
  add  constraint pensiones_estado_chk
       check (estado in ('borrador', 'en_revision', 'publicada', 'pausada', 'rechazada')),

  drop constraint if exists pensiones_titulo_largo_chk,
  add  constraint pensiones_titulo_largo_chk
       check (char_length(titulo) between 6 and 120),

  drop constraint if exists pensiones_descripcion_largo_chk,
  add  constraint pensiones_descripcion_largo_chk
       check (char_length(descripcion) <= 2000),

  drop constraint if exists pensiones_direccion_largo_chk,
  add  constraint pensiones_direccion_largo_chk
       check (char_length(direccion) between 5 and 200),

  drop constraint if exists pensiones_precio_maximo_chk,
  add  constraint pensiones_precio_maximo_chk
       check (precio_mensual >= 0 and precio_mensual <= 20000000),

  drop constraint if exists pensiones_imagenes_limite_chk,
  add  constraint pensiones_imagenes_limite_chk
       check (coalesce(cardinality(imagenes), 0) <= 8),

  drop constraint if exists pensiones_servicios_limite_chk,
  add  constraint pensiones_servicios_limite_chk
       check (coalesce(cardinality(servicios), 0) <= 12),

  drop constraint if exists pensiones_normas_limite_chk,
  add  constraint pensiones_normas_limite_chk
       check (coalesce(cardinality(normas), 0) <= 8),

  -- Coordenadas: en pareja y dentro de una envolvente del área de Santa Marta
  -- (evita que un JSON-LD declare a Google una ubicación imposible o de otra
  --  ciudad). La envolvente es DELIBERADAMENTE ancha —incluye los barrios
  --  periféricos y no solo el centro— y conviene revisarla con datos reales.
  --  Si se prefiere una validación más laxa, basta con cambiar esta línea por
  --  `latitud between -90 and 90 and longitud between -180 and 180`.
  drop constraint if exists pensiones_coordenadas_chk,
  add  constraint pensiones_coordenadas_chk
       check (
         (latitud is null and longitud is null)
         or (latitud between 11.10 and 11.35 and longitud between -74.30 and -74.05)
       );
```

### `supabase/migrations/0003_precio_sincronizado_e_indices.sql`

```sql
-- ============================================================================
-- 0003 — Una sola fuente para el precio e índices alineados con las consultas.
-- Cierra H-12 (deriva silenciosa de precio_mensual) y H-08 (índices).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) precio_mensual pasa a ser "precio desde", mantenido por trigger.
--    Regla idéntica a lib/pension.ts:34-38: mínimo de las habitaciones
--    DISPONIBLES; si no hay ninguna, se conserva lo que indicó el anfitrión.
--    Idempotente: si no hay habitaciones disponibles, min() es null y la
--    columna no se toca (nunca "baja a cero" por accidente).
--    Único matiz frente a lib/pension.ts:37: aquí se ignora una habitación con
--    precio 0 (`precio_mensual_cop > 0`). Es deliberado — una habitación
--    gratuita es un dato inválido, y el CHECK de la migración 0004 lo impide,
--    de modo que ambas reglas coinciden en la práctica.
```

### `supabase/migrations/0004_rls_endurecida.sql`

```sql
-- ============================================================================
-- 0004 — RLS sin agujeros e integridad de propiedad garantizada por la base.
-- Cierra H-02 (WITH CHECK ausente), H-09 (propietario denormalizado + FK
-- compuesta) y H-14 (rol auto-modificable).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) habitaciones.anfitrion_id: el propietario deja de ser una subconsulta
--    para convertirse en un dato, con una clave foránea que lo respalda.
--    Esto hace IMPOSIBLE la escritura cruzada de H-02, aunque una política
--    futura se escriba mal.
-- ---------------------------------------------------------------------------
alter table public.habitaciones add column if not exists anfitrion_id uuid;

update public.habitaciones h
   set anfitrion_id = p.anfitrion_id
  from public.pensiones p
 where p.id = h.pension_id
   and h.anfitrion_id is null;

alter table public.habitaciones alter column anfitrion_id set not null;

-- Índice único que la FK compuesta necesita como destino.
create unique index if not exists pensiones_id_anfitrion_uk
  on public.pensiones (id, anfitrion_id);

-- La FK de una sola columna queda subsumida por la compuesta.
-- (Confirmar el nombre real con la consulta 7 del anexo §9.)
alter table public.habitaciones
  drop constraint if exists habitaciones_pension_id_fkey;

alter table public.habitaciones
  drop constraint if exists habitaciones_pension_fk,
  add  constraint habitaciones_pension_fk
       foreign key (pension_id, anfitrion_id)
       references public.pensiones (id, anfitrion_id)
       on delete cascade;

create index if not exists habitaciones_anfitrion_idx on public.habitaciones (anfitrion_id);

-- ---------------------------------------------------------------------------
-- 2) Integridad de las habitaciones: precio útil y sin duplicados de tipo/género.
-- ---------------------------------------------------------------------------
alter table public.habitaciones
  add column if not exists actualizado_en timestamptz not null default now(),
  add column if not exists cupos smallint not null default 1;

alter table public.habitaciones
  drop constraint if exists habitaciones_precio_positivo_chk,
  add  constraint habitaciones_precio_positivo_chk check (precio_mensual_cop > 0),

  drop constraint if exists habitaciones_cupos_chk,
  add  constraint habitaciones_cupos_chk check (cupos > 0);

-- Evita publicar dos veces "individual femenino" en la misma pensión.
create unique index if not exists habitaciones_unica_uk
  on public.habitaciones (pension_id, tipo, genero);

-- ---------------------------------------------------------------------------
-- 3) Políticas de lectura: la publicación exige ahora las dos condiciones.
--    Retrocompatible: `estado` nace con 'publicada' y `archivada_en` es null,
--    así que lo que hoy se ve sigue viéndose.
-- ---------------------------------------------------------------------------
drop policy if exists "pensiones: lectura publica de activas" on public.pensiones;
create policy "pensiones: lectura publica de activas" on public.pensiones
  for select using (
    (activa and estado = 'publicada' and archivada_en is null)
    or auth.uid() = anfitrion_id
  );

drop policy if exists "habitaciones: lectura publica" on public.habitaciones;
create policy "habitaciones: lectura publica" on public.habitaciones
  for select using (
    auth.uid() = anfitrion_id
    or exists (
      select 1 from public.pensiones p
       where p.id = habitaciones.pension_id
         and p.activa and p.estado = 'publicada' and p.archivada_en is null
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Políticas de escritura: planas y con WITH CHECK en todas.
--    H-02 no puede repetirse: la política de UPDATE valida la fila NUEVA.
-- ---------------------------------------------------------------------------
drop policy if exists "habitaciones: crear las propias" on public.habitaciones;
create policy "habitaciones: crear las propias" on public.habitaciones
  for insert with check (auth.uid() = anfitrion_id);

drop policy if exists "habitaciones: editar las propias" on public.habitaciones;
create policy "habitaciones: editar las propias" on public.habitaciones
  for update using (auth.uid() = anfitrion_id)
  with check (auth.uid() = anfitrion_id);          -- ← el hallazgo H-02

drop policy if exists "habitaciones: borrar las propias" on public.habitaciones;
create policy "habitaciones: borrar las propias" on public.habitaciones
  for delete using (auth.uid() = anfitrion_id);

-- Publicar exige ser anfitrión de verdad (H-14). Requiere que exista el perfil,
-- que el trigger de registro ya crea.
drop policy if exists "pensiones: crear las propias" on public.pensiones;
create policy "pensiones: crear las propias" on public.pensiones
  for insert with check (
    auth.uid() = anfitrion_id
    and exists (
      select 1 from public.usuarios u
       where u.id = auth.uid() and u.rol = 'anfitrion'
    )
  );

-- ---------------------------------------------------------------------------
-- 5) El rol deja de ser auto-modificable (H-14).
-- ---------------------------------------------------------------------------
create or replace function public.usuarios_protege_columnas()
returns trigger
language plpgsql
as $$
begin
  -- 'service_role' (tareas administrativas) puede cambiar el rol; nadie más.
  if auth.role() is distinct from 'service_role' then
    new.rol       := old.rol;
    new.id        := old.id;
    new.creado_en := old.creado_en;
  end if;
  return new;
end;
$$;

drop trigger if exists usuarios_protege_columnas_trigger on public.usuarios;
create trigger usuarios_protege_columnas_trigger
  before update on public.usuarios
  for each row execute function public.usuarios_protege_columnas();
```

> **Bloque opcional, deliberadamente NO incluido** (H-13): sustituir `on delete cascade` de `pensiones.anfitrion_id` y de `usuarios.id` por `on delete set null` exige hacer `anfitrion_id` nullable y decidir qué pasa con los anuncios de una cuenta dada de baja. Es una **decisión de producto**, no una corrección técnica: no debe aplicarse sin acordarlo, porque cambia el significado del dato. Mientras no se decida, conviene al menos **prohibir el borrado de cuentas con anuncios activos** desde la operación.

### `supabase/migrations/0005_publicar_pension_rpc.sql`

```sql
-- ============================================================================
-- 0005 — Publicación atómica: pensión + primera habitación en una transacción.
-- Cierra H-06: hoy el formulario publica pensiones sin habitaciones y quedan
-- invisibles para los filtros de género y alimentación (lib/filtros.ts:82-85).
-- ============================================================================
create or replace function public.publicar_pension(
  p_titulo            text,
  p_descripcion       text,
  p_direccion         text,
  p_barrio            text,
  p_precio_referencia integer,
  p_distancia_minutos smallint,
  p_servicios         text[],
  p_normas            text[],
  p_imagenes          text[],
  p_tipo              text,
  p_genero            text,
  p_precio_habitacion integer,
  p_alimentacion      boolean default false
)
returns uuid
language plpgsql
-- security invoker: la función NO se salta RLS. Si las políticas de arriba se
-- escribieran mal, esto sigue fallando de forma segura.
security invoker
set search_path = public
as $$
declare
  v_pension_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión activa para publicar';
  end if;

  insert into public.pensiones (
    anfitrion_id, titulo, descripcion, precio_mensual, direccion, barrio,
    distancia_a_pie_minutos, servicios, normas, imagenes, estado
  ) values (
    auth.uid(), p_titulo, p_descripcion, p_precio_referencia, p_direccion, p_barrio,
    p_distancia_minutos, p_servicios, p_normas, p_imagenes, 'publicada'
  )
  returning id into v_pension_id;

  insert into public.habitaciones (
    pension_id, anfitrion_id, tipo, genero, precio_mensual_cop, alimentacion_incluida
  ) values (
    v_pension_id, auth.uid(), p_tipo, p_genero, p_precio_habitacion, p_alimentacion
  );

  return v_pension_id;
end;
$$;

grant execute on function public.publicar_pension(
  text, text, text, text, integer, smallint, text[], text[], text[], text, text, integer, boolean
) to authenticated;
```

**Qué cambia en la aplicación (no en esta auditoría, solo para dimensionarlo):** `app/actions/pensiones.ts:104-116` pasa de un `insert` a un `supabase.rpc("publicar_pension", {...})`; el formulario añade los campos de la habitación principal. `types.Pension` y `types.Habitacion` **no cambian**.

### `supabase/migrations/0006_storage_fotos.sql`

```sql
-- ============================================================================
-- 0006 — Almacenamiento propio de fotos con RLS por carpeta (H-10).
-- A partir de aquí, next.config.mjs puede restringir remotePatterns a
-- **.supabase.co + images.unsplash.com y eliminar el comodín "**".
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-pensiones', 'fotos-pensiones', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Convención de ruta: fotos-pensiones/{auth.uid()}/{uuid}.jpg
drop policy if exists "fotos: subir en la propia carpeta" on storage.objects;
create policy "fotos: subir en la propia carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos-pensiones'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fotos: actualizar las propias" on storage.objects;
create policy "fotos: actualizar las propias" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fotos-pensiones'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'fotos-pensiones'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fotos: borrar las propias" on storage.objects;
create policy "fotos: borrar las propias" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos-pensiones'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- La lectura pública la cubre `public = true` (servido por el CDN de Supabase).

-- Validador reutilizable para las URLs de `pensiones.imagenes`.
create or replace function public.url_imagen_valida(url text)
returns boolean
language sql
immutable
as $$
  select url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/fotos-pensiones/[0-9a-f-]{36}/[A-Za-z0-9._-]+$';
$$;
```

> **Secuencia importante, para no romper nada:** este validador **no debe aplicarse como CHECK sobre `pensiones.imagenes` todavía**, porque las 6 pensiones de ejemplo usan URLs de Unsplash (`lib/datos.semilla.ts:14-15`) y el CHECK las rechazaría. Primero se suben las fotos del catálogo al bucket, después se añade la restricción. Entretanto, úsalo como validación en el servidor (Server Action) y como comprobación periódica (anexo §9, consulta 8).

---

## 8. Riesgos, reversión y comprobación de "no se rompió nada"

### 8.1 Riesgos específicos de esta propuesta

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| El índice único `habitaciones (pension_id, tipo, genero)` falla por datos existentes | Media si ya hay datos reales | Ejecutar la consulta 4 del anexo **antes**; resolver los duplicados a mano. El fallo es informativo, no un accidente |
| El relleno de `slug` colisiona con slugs ya asignados en una ejecución parcial | Baja | El índice único falla de forma visible; la solución es recalcular el sufijo numérico de las filas afectadas |
| El trigger de precio produce escrituras en bucle | Muy baja | Solo `habitaciones` dispara el trigger, y este escribe únicamente en `pensiones`; no hay camino de vuelta |
| Cambiar `estado` a `'en_revision'` antes de tener moderación oculta las publicaciones nuevas | **Alta si se hace fuera de orden** | El default se mantiene en `'publicada'` (H-04). No cambiar hasta que exista la pantalla |
| Los CHECK de longitud rechazan filas válidas de datos reales | Media | Aplicar primero la consulta 3 del anexo (filas que incumplirían) y corregirlas antes |
| Compilar mientras el servidor de desarrollo está activo corrompe `.next` | **Ya ocurrió en este proyecto** | Un solo proceso a la vez; usar `Iniciar-App.bat` / `Iniciar-Dev.bat`, que liberan el puerto |

### 8.2 Reversión

- **Nivel 1 — aplicación (segundos):** comentar las dos variables de Supabase en `.env.local`. La aplicación vuelve al modo demo sin tocar código (`docs/integracion-supabase.md:139-140`).
- **Nivel 2 — datos (minutos):** las migraciones 0002–0006 son aditivas; revertir una restricción es `alter table ... drop constraint ...`. Los datos existentes no se transforman en ningún paso destructivo **salvo** el relleno de `slug` y de `habitaciones.anfitrion_id`, que solo añaden información derivable.
- **Nivel 3 — proyecto (horas):** restaurar el respaldo en `staging`. **Este camino debe probarse al menos una vez antes de confiar en él** (H-11).

### 8.3 Comprobación de no-regresión, fase por fase

Comandos que el equipo ya tiene y que deben ejecutarse **en serie, nunca a la vez**:

```bash
npm run build                        # 16 rutas, sin errores de tipos ni lint
node scripts/verificar-seo.mjs       # comprobaciones de JSON-LD y metadatos
node scripts/prueba-humo.mjs         # 9 rutas con el servidor levantado
node scripts/verificar-contraste.mjs # WCAG AA de la paleta
```

Y la comprobación funcional que hoy no existe y que este plan sí exige, porque es la única que detecta H-06: **publicar una pensión y confirmar que aparece en `/` con al menos una habitación, y que sigue apareciendo con el filtro "solo femenino" y con "con alimentación" activos.** Sin ese paso, la publicación puede estar "correcta" y ser invisible.

---

## 9. Anexo: consultas de verificación

**1. Deriva de precio** (H-12). Debe devolver **0 filas** después de la migración 0003:

```sql
select p.id, p.titulo, p.precio_mensual,
       (select min(h.precio_mensual_cop) from public.habitaciones h
         where h.pension_id = p.id and h.disponible and h.precio_mensual_cop > 0) as minimo_disponible
  from public.pensiones p
 where p.precio_mensual is distinct from coalesce(
         (select min(h.precio_mensual_cop) from public.habitaciones h
           where h.pension_id = p.id and h.disponible and h.precio_mensual_cop > 0),
         p.precio_mensual);
```

**2. Anuncios publicados sin habitaciones** (H-06). Objetivo: **0**:

```sql
select count(*) as publicadas_sin_habitaciones
  from public.pensiones p
 where p.activa and p.estado = 'publicada'
   and not exists (select 1 from public.habitaciones h where h.pension_id = p.id);
```

**3. Filas que incumplirían los CHECK de 0002** (ejecutar **antes** de migrar). Debe devolver 0 filas:

```sql
select id, titulo, char_length(titulo) as largo_titulo, precio_mensual,
       cardinality(imagenes) as n_imagenes, cardinality(servicios) as n_servicios
  from public.pensiones
 where char_length(titulo) not between 6 and 120
    or char_length(descripcion) > 2000
    or char_length(direccion) not between 5 and 200
    or precio_mensual > 20000000
    or coalesce(cardinality(imagenes), 0) > 8
    or coalesce(cardinality(servicios), 0) > 12
    or coalesce(cardinality(normas), 0) > 8
    or (latitud is not null and (latitud not between 11.10 and 11.35
                              or longitud not between -74.30 and -74.05));
```

**4. Duplicados que harían fallar el índice único de 0004** (H-09). Objetivo: **0 filas**:

```sql
select pension_id, tipo, genero, count(*) as repetidas
  from public.habitaciones
 group by 1, 2, 3
having count(*) > 1;
```

**5. Habitaciones sin propietario coherente** (H-09). Objetivo: **0 filas**:

```sql
select h.id, h.pension_id, h.anfitrion_id, p.anfitrion_id as dueno_de_la_pension
  from public.habitaciones h
  join public.pensiones p on p.id = h.pension_id
 where h.anfitrion_id is distinct from p.anfitrion_id;
```

**6. Salud del catálogo** (H-19). Ejecutar como tarea programada y alertar si baja a 0:

```sql
select count(*)                                        as activas_publicadas,
       count(*) filter (where verificado)              as verificadas,
       count(*) filter (where not exists (
         select 1 from public.habitaciones h where h.pension_id = p.id)) as sin_habitaciones,
       min(creada_en)                                  as primera_publicacion,
       max(creada_en)                                  as ultima_publicacion
  from public.pensiones p
 where activa and estado = 'publicada' and archivada_en is null;
```

**7. Nombre real de la clave foránea antes de aplicar 0004:**

```sql
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.habitaciones'::regclass and contype = 'f';
```

**8. Imágenes que no están en el almacenamiento propio** (H-10, tras adoptar Storage):

```sql
select p.id, p.titulo, url
  from public.pensiones p, unnest(p.imagenes) as url
 where not public.url_imagen_valida(url);
```

**9. Comprobación de RLS desde fuera** — se ejecuta en el SQL Editor, que opera como `postgres` y **no** está sujeto a RLS; sirve para simular un cliente anónimo:

```sql
set local role anon;
select count(*) from public.pensiones;            -- solo activas + publicadas + no archivadas
select count(*) from public.habitaciones;         -- solo de las anteriores
reset role;
```

**10. Ataque de H-02, para comprobar que la corrección funciona** (con una segunda cuenta autenticada y el cliente REST del navegador): intentar un `PATCH` sobre una habitación propia cambiando `pension_id` a una pensión de otro anfitrión. **Resultado esperado: rechazado por la política o por la clave foránea compuesta.**

---

## 10. Cierre

**Lo que ya está bien y este plan preserva:** el contrato de tipos, el aislamiento de la persistencia en `lib/datos.ts` y `lib/supabase/mapeo.ts`, la identidad derivada de la sesión, el cliente anónimo para ISR y las políticas RLS existentes (que se endurecen, no se reemplazan).

**Lo que hay que resolver antes de lanzar:** los cinco bloqueantes del resumen ejecutivo (H-01 a H-05). Los tres primeros son de esquema y caben en una jornada; H-04 necesita una pantalla; H-05 es una bandera y un mensaje de error.

**Lo que no hay que hacer todavía:** ni reescribir el modelo desde cero, ni migrar a un ORM, ni añadir una capa de caché propia. El problema de este proyecto no es la tecnología: es que **la base de datos todavía no defiende sus propios datos** y que **la publicación no cierra el ciclo**. Resuelto eso, el resto del plan es incremental y cada fase puede entregarse por separado sin bloquear al equipo.

*Auditoría de solo lectura. Ningún archivo de código fue modificado y ninguna compilación fue ejecutada durante este trabajo.*
