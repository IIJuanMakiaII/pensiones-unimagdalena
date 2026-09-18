# Revisión independiente de seguridad — camino de escritura del panel de disponibilidad

**Tarea:** #11 · **Revisor:** Seguridad & DevOps (última línea de revisión antes de producción)
**Objeto:** las dos Server Actions que introduce la tarea #10 — `cambiarDisponibilidadHabitacion` y `cambiarEstadoPublicacion` — y el panel que las consume.
**Fecha de la revisión:** 17 de septiembre de 2026, entre 22:00 y 22:30 (America/Bogota).
**Base de datos inspeccionada:** proyecto Supabase `ayznnqkacpdvvufclhon` (el de producción del usuario).

## Revisión auditada (importante)

El proyecto **no tiene control de versiones** (no existe `.git`), así que fijo la revisión por fecha de modificación de los archivos:

| Archivo | Última modificación | ¿Cambió durante la revisión? |
|---|---|---|
| `app/actions/pensiones.ts` | 2026-09-17 21:42 | No |
| `components/PanelPublicacion.tsx` | 2026-09-17 21:43 | No |
| `app/publicar/page.tsx` | 2026-09-17 21:43 | No |
| `components/CardPension.tsx` | 2026-09-17 21:43 | No |
| `components/DetallePension.tsx` | 2026-09-17 21:43 | No |
| `supabase/oleada-1.sql` | 2026-09-17 21:13 | No |
| `lib/filtros.ts` | 2026-09-13 22:50 | No |
| **`lib/pension.ts`** | **2026-09-17 22:13** | **Sí — se modificó mientras auditaba** |
| **`app/pensiones/[id]/page.tsx`** | **2026-09-17 22:13** | **Sí — se modificó mientras auditaba** |

Los dos últimos cambiaron a las 22:13, en mitad de esta revisión (apareció la función `precioReservable`, que antes no existía). Todas las citas de esos dos archivos corresponden a la revisión de 22:13 o posterior y están verificadas de nuevo después del cambio. Esto no es un detalle menor: se documenta como hallazgo **A-5**, porque significa que **el artefacto bajo revisión cambió sin que exista forma de saber qué se revisó** (sin git no hay revisión estable ni comparación posible).

## Método

- Lectura íntegra del código del camino de escritura y de sus consumidores (acciones, panel, tarjeta, ficha, motor de filtros, reglas de precio).
- Contraste con el SQL realmente aplicado en la base: políticas RLS (`pg_policies`), privilegios por columna (`has_column_privilege`), permisos de función (`pg_proc.proacl`), claves foráneas y restricciones (`pg_constraint`), triggers (`pg_trigger`) y estado de RLS en las tres tablas.
- **Pruebas de autorización ejecutadas de verdad**, cambiando el rol de sesión (no como superusuario) con las claims JWT simuladas: matriz con **control positivo** incluido.
- **Sin efectos secundarios**: cada prueba corrió dentro de una transacción que termina lanzando una excepción, de modo que todo se revierte. Verificado al final con una consulta de residuos (resultado: 0).
- No se ejecutó `npm run build` ni `npm start` (la carpeta `.next` la necesita la tarea #12, por indicación expresa).
- Las consultas de solo lectura mostraron estados transitorios porque **la tarea #12 estaba ejecutándose en paralelo**: se indica en cada caso, y A-5 lo documenta.

---

## 1. Veredicto

> ## ✅ APTO CON RESERVAS
>
> **El camino de escritura de la tarea #10 está correcto y puede desplegarse.** Las dos Server Actions resuelven bien lo que más importaba: la identidad sale de la sesión, la autorización la aplica la base (RLS) y **no existe forma de que un anfitrión modifique habitaciones o publicaciones de otro** — lo comprobé ejecutando la matriz de autorización, no deduciéndolo. Tampoco encontré ningún caso de "éxito falso": ambas acciones verifican la fila devuelta y una violación de política produce un error, no un éxito silencioso.
>
> **Las reservas no son del panel, son de la superficie de escritura sobre la que se apoya.** Al revisar la política que habilita el panel descubrí que **autoriza mucho más de lo que el panel necesita**: el mismo permiso que permite marcar una habitación como ocupada permite también **autootorgarse el sello "verificado" y la calificación** (A-1), y **fijar a voluntad el precio que se publica** (A-2). Nada de eso se puede hacer *desde la interfaz*, pero sí con una petición directa a la API, que es la frontera real.
>
> **Antes de exponer el sitio al público**, corregir A-1 (30 minutos de trabajo). Es el hallazgo que más afecta a la propuesta de valor del producto: el sello "verificado" y el "Puntaje del equipo" —que es lo que estudiantes y padres usan para decidir— pueden ser falsificados por quien los recibe.

**Resumen de hallazgos**

| ID | Hallazgo | Severidad | Esfuerzo | ¿Bloquea publicar? |
|---|---|---|---|---|
| A-1 | El anfitrión puede autootorgarse `verificado` y `calificacion` | 🟠 Alto | 30 min | **Sí** |
| A-2 | Precio publicado manipulable y no reservable ("precio fantasma") | 🟡 Medio | 1 h | Recomendado |
| A-3 | La autorización depende de una sola capa (sin predicado de propiedad en la consulta) | 🟡 Medio | 20 min | No |
| A-4 | Las dos acciones nuevas no exigen correo confirmado (sí lo exige `crearPension`) | 🟢 Bajo | 10 min | No |
| A-5 | Sin control de versiones: el código cambió durante la revisión; las pruebas automatizadas escriben en la base de producción | 🟡 Medio | 2–4 h | Recomendado |
| A-6 | La RPC acepta forma y precio que el formulario prohíbe (precio 0, arrays sin límite, coordenadas sin rango) | 🟢 Bajo | 20 min | No |

---

## 2. Respuestas a las preguntas obligatorias

### 2.1 ¿Puede un anfitrión modificar habitaciones o publicaciones de **otro** (IDOR)?

**No.** Comprobado por ejecución, con control positivo para que un "0 filas" signifique algo.

Datos de prueba: una pensión + una habitación del anfitrión real (**A**) y otra pareja de un segundo anfitrión (**B**, creado dentro de la misma transacción, con su fila en `auth.users` y su perfil generado por el trigger).

| Prueba (rol `authenticated`, claims JWT del usuario indicado) | Resultado |
|---|---|
| **A** edita `disponible` de **su** habitación | **1 fila** ← control positivo: el arnés detecta un éxito real |
| **B** edita `disponible` de la habitación de **A** | **0 filas** ✅ |
| **B** cambia `activa` de la pensión de **A** | **0 filas** ✅ |
| **B** mueve la habitación de **A** a otra pensión | **0 filas** ✅ |
| **A** intenta mover **su** habitación a la pensión de **B** | **BLOQUEADO — `42501`** (violación de política) ✅ |
| **A** intenta transferir **su** pensión a **B** (`anfitrion_id = B`) | **BLOQUEADO — `42501`** ✅ |
| **A** edita la habitación de **B** | **0 filas** ✅ |
| **A** retira la pensión de **B** | **0 filas** ✅ |
| **A** borra la habitación de **B** | **0 filas** ✅ |
| Rol `anon`: actualizar pensión / habitación | **0 filas / 0 filas** ✅ |

Las dos formas de "mover datos ajenos" que en teoría podrían escaparse (`WITH CHECK`) están **bloqueadas de verdad**: la corrección de la política UPDATE de `habitaciones` que introdujo `supabase/oleada-1.sql:52-68` **está aplicada en la base** (lo verifiqué en `pg_policies`, no me fié del archivo) y su efecto se comprobó con la prueba de bloqueo `42501`.

### 2.2 ¿Se confía en algún identificador que llega del formulario para autorizar la operación?

**No para autorizar.** El formulario envía `habitacionId` y `pensionId` (`components/PanelPublicacion.tsx:130-131,157-158`) y las acciones los usan **solo como filtro del `UPDATE`**; la autoridad es `auth.uid()` resuelta por la RLS dentro de la base (`app/actions/pensiones.ts:314,333-337,388,407-411`). La prueba lo demuestra de la forma más directa: **el mismo identificador, con las claims de otro usuario, afecta 0 filas**.

**Matiz que sí merece corrección (A-3):** la consulta de actualización filtra *únicamente* por `id`, sin predicado de propiedad. Toda la autorización recae en una sola capa (RLS). Hoy es correcta y está verificada, pero conviene añadir la segunda capa.

### 2.3 ¿Puede la interfaz informar de un éxito que en realidad no ocurrió?

**No.** Las dos acciones comprueban la fila devuelta antes de responder `ok`:

- `app/actions/pensiones.ts:347-357` — si `data` no trae fila, responde *"Esa habitación no pertenece a tus publicaciones, así que no se cambió nada"*, **nunca `ok: true`**.
- `app/actions/pensiones.ts:421-427` — mismo criterio para la publicación.

Y verifiqué la condición que podría producir un **falso negativo** (una actualización legítima que no devuelve fila, y el anfitrión viendo un error donde sí se guardó): el `RETURNING` de Postgres exige permiso de lectura sobre la fila actualizada, y las dos políticas de `SELECT` incluyen al propietario en cualquier estado — `pensiones` (`activa OR auth.uid() = anfitrion_id`) y `habitaciones` (`p.activa OR p.anfitrion_id = auth.uid()`) según `pg_policies`. Es decir: **el dueño siempre recibe su fila**, incluso con la publicación retirada. No hay falso éxito ni falso error.

Un detalle adicional bueno: si el `WITH CHECK` bloquea, PostgreSQL devuelve **error** (`42501`) y no 0 filas, y el código lo trata en la rama de error (`:339-345`, `:413-419`). Ninguno de esos caminos reporta éxito. Desde la interfaz esas rutas no son alcanzables (el panel solo escribe `disponible` y `activa`, que no alteran columnas de propiedad), pero el manejo es correcto.

### 2.4 ¿Queda algún camino que permita escribir sin sesión válida, o con una cuenta sin correo confirmado?

**Sin sesión: no.** Aunque el middleware solo cubre `/publicar` y `/login` (`middleware.ts:22-24`) y una Server Action puede invocarse por POST desde cualquier ruta pública (su identificador es global), **la comprobación que decide está dentro de la acción**: `supabase.auth.getUser()` antes de tocar la base (`:325-331` y `:399-405`). Es decir, la autorización no depende del matcher del middleware. Correcto por diseño.

**Sin correo confirmado: sí, y es una inconsistencia (A-4).** `crearPension` exige `user.email_confirmed_at` (`:157-163`), pero **las dos acciones nuevas no lo comprueban**. Hoy no es explotable: con "Confirm email" activo Supabase no emite sesión a una cuenta sin confirmar, y en la base hay **0 usuarios sin confirmar** (verificado). Se reporta porque es un control de política que ya solo aplica a una de las tres acciones de escritura: si mañana se relaja el interruptor de Supabase, o se revoca la confirmación de una cuenta, el panel seguiría funcionando para quien la política dice que no debería publicar.

### 2.5 ¿Retirar una publicación la oculta **de verdad** al público?

**Sí, comprobado.** Lecturas ejecutadas con el rol `anon` (el mismo que usa el navegador de un visitante):

| Consulta como `anon` | Activa | Retirada |
|---|---|---|
| Filas visibles en `pensiones` | **1** ✅ | **0** ✅ |
| Filas visibles en `habitaciones` de esa pensión | **1** ✅ | **0** ✅ |

La política `pensiones: lectura publica de activas` (`supabase/esquema.sql:130-132`) y `habitaciones: lectura publica` (`:147-155`) hacen el trabajo, y la lectura de la pensión activa sirve de control positivo: el 0 de la retirada significa algo. Además, la acción invalida caché para que no siga sirviéndose la ficha desde ISR (`revalidarCatalogo`, `:284-289`, con `revalidateTag` + `revalidatePath` del catálogo, del panel y de la ficha).

### 2.6 ¿El campo `disponible` puede usarse para algo distinto de la disponibilidad?

**Sí: es la palanca que deja un precio publicado que ya no se puede reservar.** No sirve para saltarse el recálculo del trigger *hacia arriba* (nunca sube el precio), pero sí para quedarse con el último valor, o con uno inyectado por API:

1. El trigger **conserva** el precio cuando no queda ninguna habitación libre — `supabase/oleada-1.sql:90-93`, literalmente *"Sin habitaciones disponibles se conserva el precio declarado por el anfitrión"*.
2. Al marcar la última habitación como ocupada, quedó comprobado: `precio_que_queda = 1000`, `habitaciones_libres = 0`, `sigue_activa = true`.
3. Ese precio **sigue alimentando dos consumidores públicos** que no usan la regla nueva de "precio reservable": el filtro de precio (`lib/filtros.ts:82-84`: `return f.precioMaximoCop === 0 || p.precioMensual <= f.precioMaximoCop`) y los límites del deslizador (`lib/filtros.ts:35-40`).

Es decir: marcar la última habitación como ocupada no "apaga" el precio; y como además el precio se puede escribir a voluntad (A-2), el resultado es un anuncio que compite en el filtro de precio sin tener nada que reservar. El detalle completo está en A-2.

---

## 3. Matriz de comprobaciones de autorización (resumen)

| # | Comprobación | Método | Resultado |
|---|---|---|---|
| 1 | Control positivo: el dueño puede editar su habitación | rol `authenticated` + claims del dueño | ✅ 1 fila |
| 2 | Control positivo: el dueño puede retirar su publicación | ídem | ✅ 1 fila |
| 3 | Otro anfitrión edita habitación ajena | rol `authenticated` + claims ajenas | ✅ 0 filas |
| 4 | Otro anfitrión retira publicación ajena | ídem | ✅ 0 filas |
| 5 | Otro anfitrión mueve habitación ajena | ídem | ✅ 0 filas |
| 6 | Otro anfitrión borra habitación ajena | ídem | ✅ 0 filas |
| 7 | El dueño mueve su habitación a publicación ajena | `WITH CHECK` de `habitaciones` | ✅ bloqueado `42501` |
| 8 | El dueño transfiere su publicación a otro | `WITH CHECK` de `pensiones` | ✅ bloqueado `42501` |
| 9 | Anónimo actualiza publicación / habitación | rol `anon` | ✅ 0 filas / 0 filas |
| 10 | Anónimo **lee** publicación activa y sus habitaciones | rol `anon` | ✅ 1 / 1 (control positivo) |
| 11 | Anónimo **lee** publicación retirada y sus habitaciones | rol `anon` | ✅ 0 / 0 |
| 12 | Anónimo lee perfiles de `usuarios` | rol `anon` | ✅ 0 filas |
| 13 | RLS activa en las tres tablas | `pg_class.relrowsecurity` | ✅ `true` / `true` / `true` |
| 14 | Política UPDATE de `habitaciones` con `WITH CHECK` | `pg_policies` | ✅ presente (corrección de oleada 1 aplicada) |
| 15 | Integridad referencial | `pg_constraint` | ✅ FK validadas; 0 habitaciones huérfanas |
| 16 | `anon` no puede ejecutar la RPC ni el trigger | `has_function_privilege` | ✅ `false` / `false` |
| 17 | La RPC se ejecuta con permisos del llamante | `pg_proc.prosecdef` | ✅ `INVOKER` (RLS sigue aplicando) |
| 18 | Residuos de las pruebas de esta revisión | consulta final | ✅ 0 (pensiones, habitaciones y usuario sintético) |

**Control de integridad del arnés:** sin la fila 1 y la 10, un "0 filas" no probaría nada (una actualización que no casa con ninguna fila también devuelve 0). Se incluyeron a propósito.

---

## 4. Hallazgos

### 🟠 A-1 — El anfitrión puede autootorgarse el sello `verificado` y la calificación

**Severidad:** Alto · **Bloquea publicar:** sí · **Esfuerzo:** 30 min

**Evidencia**
- `supabase/esquema.sql:41` — `verificado boolean not null default false`; `:40` — `calificacion numeric(2,1) not null default 0`.
- `supabase/esquema.sql:138-140` — la política que usa el panel es `for update using (auth.uid() = anfitrion_id) with check (auth.uid() = anfitrion_id)`: **no restringe columnas**. Verificado en `pg_policies`.
- Privilegios reales: `has_column_privilege('authenticated', 'public.pensiones', 'verificado', 'UPDATE')` → **`true`** (lo mismo para `calificacion`, `precio_mensual`, `creada_en`, `anfitrion_id`, `latitud` y `longitud`).
- **No hay ningún trigger en `pensiones`** (`pg_trigger`: `ninguno`; el único trigger del proyecto es `al_cambiar_habitacion`, sobre `habitaciones`).
- **Ejecutado y confirmado**: como el propio anfitrión, `update public.pensiones set verificado = true, calificacion = 5.0 where id = <su pensión>` → **1 fila**, y al releer la fila: `verificado = t`, `calificacion = 5.0`.

**Dónde se ve en el producto** (lo que hace que importe): el sello se pinta en `components/CardPension.tsx:68` y en `app/pensiones/[id]/page.tsx:153,173`; la calificación con la etiqueta *"Puntaje del equipo"* en `components/CardPension.tsx:91-97` y `:158-160`; y el filtro **"Solo verificadas"** (`lib/filtros.ts:78`, `p.verificado`) deja al anuncio autotorgado aparecer donde el estudiante busca garantías. El propio `esquema.sql` documenta la calificación como *"Puntaje interno del equipo"*: un dato que, por definición, no puede escribir el anfitrión.

**Escenario de explotación concreto**
Un anfitrión ya registrado (no necesita nada más) envía, con su propia sesión:

```
PATCH /rest/v1/pensiones?id=eq.<id-de-su-anuncio>
apikey: <clave anónima pública>
Authorization: Bearer <su access_token>
{"verificado": true, "calificacion": 5.0}
```

Su anuncio pasa a mostrar el sello azul de verificación, 5 estrellas con la marca "Puntaje del equipo" y a aparecer bajo el filtro "Solo verificadas". No hay rastro de que el equipo lo haya verificado: `verificado` es un booleano sin procedencia ni auditoría. En un producto cuya promesa central —y cuya landing— es *"pensiones verificadas"* para estudiantes foráneos y sus padres, esto es una falsificación de la confianza, no una manipulación de datos menores.

**Corrección propuesta**
1. Quitar al rol `authenticated` el permiso de actualizar las columnas que el panel **nunca** escribe:

```sql
revoke update (verificado, calificacion, creada_en, anfitrion_id, latitud, longitud, precio_mensual)
  on public.pensiones from authenticated;
```

2. **⚠️ Ojo antes de aplicar el revoke de `precio_mensual`**: la RPC `crear_pension_con_habitaciones` también hace `update public.pensiones set precio_mensual = ...` y es **`SECURITY INVOKER`** (verificado: `pg_proc.prosecdef = false`), así que ese `UPDATE` corre con los permisos del llamante y **fallaría con "permission denied for column"** si se revoca el permiso. Dos opciones válidas:
   - (a) revocar `precio_mensual` **y** borrar esas tres líneas de la RPC (`supabase/oleada-1.sql:187-194`), ya que el trigger `al_cambiar_habitacion` hace el mismo cálculo; o
   - (b) no revocarlo y añadir un trigger `before insert or update on public.pensiones` que **imponga** el valor calculado (`coalesce(min de habitaciones libres, old.precio_mensual)`), con lo que el valor que envíe el cliente se vuelve irrelevante.
   La opción (b) es la más robusta porque cierra el camino del A-2 al mismo tiempo y no depende de recordar permisos.
3. Para otorgar el sello, un camino con privilegios: una función `security definer` restringida a un rol de administración, o directamente desde el panel de Supabase mientras la verificación sea manual (hoy lo es: 1 anuncio, 0 verificados).
4. **Prueba de regresión:** repetir el `PATCH` de arriba y esperar `403`/`42501`; y comprobar que "Marcar ocupada" sigue funcionando (la columna `activa` **debe** seguir siendo actualizable desde el panel).

---

### 🟡 A-2 — Precio publicado manipulable y no reservable ("precio fantasma")

**Severidad:** Medio · **Esfuerzo:** 1 h

**Evidencia (todo ejecutado)**
- Como el anfitrión: `update public.pensiones set precio_mensual = 1000 where id = <su pensión>` → **1 fila**, precio releído **1000**. El trigger no lo corrige porque **solo vigila `habitaciones`** (`supabase/oleada-1.sql:99-102`).
- Al marcar después la última habitación como ocupada (el flujo normal del panel nuevo): `precio_que_queda = 1000`, `habitaciones_libres = 0`, `sigue_activa = true`. El precio **no se apaga**.
- Por la RPC (camino documentado, alcanzable desde cualquier cuenta autenticada): `crear_pension_con_habitaciones` con `precio_mensual: 1234` y la única habitación enviada ya `disponible: false` → pensión creada con **precio 1234, `activa = true`, 0 habitaciones reservables**. El precio lo fija el cliente: `supabase/oleada-1.sql:153` (`coalesce((p_pension->>'precio_mensual')::integer, 0)`) y el recálculo solo se aplica **si hay alguna disponible** (`:188-194`).
- Ese precio sigue usándose en dos sitios públicos: **filtro** (`lib/filtros.ts:82-84`) y **límites del deslizador** (`lib/filtros.ts:35-40`).

**Lo que ya está bien y conviene no romper**: la tarjeta y los datos estructurados **sí** lo ocultan — `components/CardPension.tsx:49-53` (precio 0 si hay habitaciones pero ninguna libre) y, muy importante, `app/pensiones/[id]/page.tsx:78,113` con la regla nueva `precioReservable` de `lib/pension.ts:53-59`. Es decir: **tres consumidores del precio, dos corregidos y el tercero (los filtros) no**. Esa asimetría es exactamente el hallazgo.

**Escenario de explotación concreto**
Un anfitrión con las habitaciones alquiladas (o con una publicación heredada sin habitaciones, como la actual *"Residencia Makia"*: `precio_mensual = 600000`, 0 habitaciones) pone su precio en 1.000 vía `PATCH`. Resultado: su anuncio **aparece** cuando un estudiante filtra "hasta \$300.000", aunque no tenga nada que alquilar; la tarjeta no muestra precio y ofrece "Consultar por WhatsApp", de modo que el anfitrión capta contactos en una búsqueda en la que no debería competir. Además, un solo valor atípico distorsiona el rango del deslizador para todos los visitantes (`limitesDePrecio`).

**Corrección propuesta**
1. Unificar la regla en **una sola función** (`precioReservable`, ya existente) y que la usen los tres consumidores. En `lib/filtros.ts:82-84`, distinguir los dos casos que hoy se mezclan:

```ts
const disponibles = habitacionesDisponibles(p);
const todas = p.habitaciones ?? [];
if (disponibles.length === 0) {
  if (f.soloConAlimentacion || f.genero !== "todos") return false;
  if (todas.length > 0) return false;                        // tiene habitaciones, todas ocupadas → no compite por precio
  return f.precioMaximoCop === 0 || p.precioMensual <= f.precioMaximoCop;  // sin habitaciones publicadas (caso heredado)
}
```
   Y en `limitesDePrecio` (`:36-39`), incluir `p.precioMensual` **solo** cuando `p.habitaciones` está vacío.
2. Imponer el precio en la base (opción (b) de A-1), con lo que un valor inyectado deja de tener efecto.
3. **Prueba de regresión:** publicar con habitaciones ocupadas y comprobar que el anuncio **no** aparece al filtrar por precio por debajo de su valor real, y que el rango del deslizador no se ve afectado.

---

### 🟡 A-3 — La autorización descansa en una sola capa

**Severidad:** Medio (defensa en profundidad, no vulnerabilidad) · **Esfuerzo:** 20 min

**Evidencia**: `app/actions/pensiones.ts:333-337` — la actualización de la habitación filtra **solo** por `id`:

```ts
const { data, error } = await supabase
  .from("habitaciones")
  .update({ disponible })
  .eq("id", habitacionId)          // ← sin predicado de propiedad
  .select("id, pension_id");
```
Igual en `:407-411` para `pensiones`. La única barrera entre un identificador que llega del formulario y la fila de otro anfitrión es la RLS.

**Escenario de fallo concreto**: **hoy no hay vulnerabilidad** (la RLS está bien y lo verifiqué). El escenario es el modo de fallo: si en el futuro alguien desactiva RLS en `habitaciones` para depurar, o recrea una política a medias durante una migración, estas dos acciones pasan a ser un interruptor entre inquilinos **y la comprobación de fila devuelta seguiría diciendo "ok"**, porque la escritura sí habría ocurrido. Un anfitrión podría entonces ocultar todas las habitaciones de un competidor con un solo POST, y el panel del afectado no mostraría ninguna señal; la única traza sería el catálogo del rival vaciándose. Toda la seguridad quedaría en una sola capa, y esa capa ya se modificó dos veces en este proyecto (`esquema.sql`, `oleada-1.sql`).

**Corrección propuesta** (añadir la propiedad a la propia consulta, sin depender solo de la política):

```ts
.eq("id", habitacionId)
.eq("pension_id", pensionDelAnfitrion)   // pensionId validado contra las publicaciones del usuario
```
o, más simple y sin consulta extra, para la publicación: `.eq("id", pensionId).eq("anfitrion_id", user.id)`. La fila devuelta sigue siendo la verificación final.

---

### 🟢 A-4 — Las dos acciones nuevas no exigen correo confirmado

**Severidad:** Bajo · **Esfuerzo:** 10 min

**Evidencia**: `crearPension` comprueba `if (!user.email_confirmed_at)` (`app/actions/pensiones.ts:157-163`); `cambiarDisponibilidadHabitacion` (`:302-368`) y `cambiarEstadoPublicacion` (`:376-437`) **no**. Ambas sí comprueban la sesión.

**Escenario de explotación concreto**: hoy **no es explotable** (con "Confirm email" activo no hay sesión sin confirmar, y en la base hay 0 usuarios en ese estado, comprobado). El escenario que se cubre es el día que se relaje el interruptor en el panel de Supabase —una operación de una casilla, habitual al depurar el registro—: a partir de ese momento cualquier cuenta creada con un correo ajeno tendría sesión y podría publicar, y las dos acciones del panel seguirían funcionando aunque la política del proyecto diga que no debería. Se corrige por coherencia, no porque haya un agujero abierto.

**Corrección propuesta**: extraer un ayudante `requiereUsuarioConCorreoConfirmado()` y usarlo en las tres acciones, para que la regla no dependa de recordar el `if` en cada sitio.

---

### 🟡 A-5 — Sin control de versiones el objeto de revisión no es estable; y las pruebas escriben en la base de producción

**Severidad:** Medio (proceso) · **Esfuerzo:** 2–4 h

**Evidencia (dos hechos observados durante esta misma revisión)**
1. **El código cambió a mitad de auditoría**: `lib/pension.ts` y `app/pensiones/[id]/page.tsx` tienen fecha 22:13, y la función `precioReservable` (`lib/pension.ts:53`) **no existía** cuando empecé a leer el archivo. Sin git no hay forma de saber qué revisión se revisó, ni de comparar contra el estado auditado, ni de revertir si una corrección rompe algo. (La ausencia de repositorio ya está en el informe maestro; aquí queda la constancia de que **ya afectó a una revisión real**: tuve que volver a leer dos archivos y republicar citas.)
2. **La verificación automatizada escribe en la base de producción del usuario**: durante la auditoría apareció de forma transitoria una pensión *"Prueba QA disponibilidad"* con 2 habitaciones (ambas ocupadas, retirada) creada minutos antes por el arnés de la tarea #12, y desapareció segundos después al limpiarla el propio arnés. Consecuencias: (a) la revisión ve estados que no son reales y hay que repetir consultas para no reportar residuos falsos; (b) la seguridad depende de que el arnés llegue a limpiar —`scripts/verificar-disponibilidad.mjs:38-40,178-183`— y si se interrumpe a mitad quedan datos de prueba en el catálogo del anfitrión; (c) durante la ejecución el arnés **crea el anuncio de prueba como activo** (`verificar-disponibilidad.mjs:62`), es decir, publica temporalmente un anuncio ficticio en el catálogo público y en la caché ISR.

**Escenario de riesgo concreto**: el arnés se interrumpe (corte de red, un test que falla, cerrar la ventana) entre la creación y el borrado → queda en la base del usuario un anuncio de prueba con habitaciones. Si el arnés se interrumpió **antes** de la fase de retirada, ese anuncio se queda **activo**: aparece en el catálogo público, entra en el HTML prerenderizado de ISR y Google puede indexarlo como una pensión real de Santa Marta. Y sin git, nadie puede saber qué versión del código produjo ese estado ni comparar con la revisión auditada — que es exactamente lo que me obligó a releer dos archivos a mitad de esta revisión.

**Corrección propuesta**
- Crear un **segundo proyecto de Supabase** (nivel gratuito) para pruebas y que los arneses apunten ahí por variable de entorno, con una comprobación que **se niegue a ejecutarse** si el `project_id` es el de producción.
- Si eso no es viable ahora: que el arnés cree el anuncio de prueba con `activa = false` (probando el ciclo de retirada con una fila propia, sin publicarlo nunca) y que envuelva cada fase en una transacción con `rollback` (el patrón que usé en esta revisión: prueba dentro de un bloque que termina en excepción → cero residuos por construcción, sin depender de una limpieza que puede no llegar).
- Versionar el proyecto (git + remoto privado). Ya está en el informe maestro; aquí se refuerza la prioridad.

---

### 🟢 A-6 — La RPC acepta lo que el formulario prohíbe

**Severidad:** Bajo · **Esfuerzo:** 20 min

**Evidencia** (verificado en `pg_constraint` y en `supabase/oleada-1.sql`)

| Campo | Regla en el formulario | Regla real en la base | Consecuencia |
|---|---|---|---|
| `habitaciones.precio_mensual_cop` | ≥ 1.000 (`app/actions/pensiones.ts:107-113`) | `>= 0` (`habitaciones_precio_rango`) | Se puede publicar una habitación a 0 |
| `pensiones.servicios` | máx. 12 (`MAX_SERVICIOS`) | sin límite | Array arbitrario por API/RPC |
| `pensiones.normas` | máx. 8 (`MAX_NORMAS`) | sin límite | Ídem |
| `pensiones.latitud/longitud` | no aplica | sin rango | Coordenadas imposibles (la ficha las publica en `geo`, `page.tsx:101-108`) |
| `pensiones.descripcion` | ≥ 30 | solo `<= 2000` | Descripción vacía |

**Escenario de explotación concreto**: con una petición directa a la API, un anfitrión publica una habitación a **\$0** (el formulario exige mínimo \$1.000) o un anuncio con 500 servicios; el precio del anuncio pasa a ser 0 —`precioReservable` lo trata como "no anunciable" y la tarjeta no muestra precio, pero el CTA de reserva sigue ahí— y los servicios se pintan como badges en la tarjeta y en la ficha. En el caso de las coordenadas, la ficha las publica en el `geo` de los datos estructurados (`page.tsx:101-108`), de modo que un par inválido viaja a Google y al mapa. No hay escalada de privilegios: es un anfitrión ensuciando su propio anuncio, y ese es justamente el motivo de que la severidad sea baja.

**Por qué importa aunque sean "datos propios"**: es el mismo patrón que la auditoría anterior señaló — **el formulario no es una frontera de seguridad**; la base es. Lo que el formulario impide y la base permite, se puede hacer con una petición directa. El impacto es bajo (el anfitrión ensucia su propio anuncio y, con las coordenadas, la ficha y el mapa), pero el arreglo es de minutos y cierra la clase entera de problema.

**Corrección propuesta**: subir el `check` de precio a `>= 1000`, añadir `check (coalesce(array_length(servicios,1),0) <= 12)`, lo mismo para `normas` (≤ 8), y `check (latitud between -90 and 90)` / `check (longitud between -180 and 180)`.

---

## 5. Contraste de las afirmaciones de las tareas #10 y #12

El enunciado pedía no dar por buenas dos afirmaciones. Esto es lo que encontré:

**a) "Un `PATCH` anónimo contra la base devuelve HTTP 200 con 0 filas (bloqueado por RLS)"**
La **conclusión es correcta** — lo confirmé con una vía más fuerte (rol `anon` en la propia base: 0 filas, con control positivo de que el dueño obtiene 1). Pero **la prueba, tal como se describió, no demostraba lo que afirmaba**, por dos razones independientes:
1. Un `UPDATE` que no casa con ninguna fila devuelve 0 filas **con RLS y sin RLS**. Sin una prueba de control (el mismo cambio hecho por el dueño legítimo, que debe afectar 1 fila), un 0 no distingue "bloqueado" de "no había nada que actualizar".
2. La afirmación se apoya en que la tabla estaba vacía — algo que yo mismo observé **no ser cierto** en un momento de la revisión (2 habitaciones, creadas por el arnés de la #12). Si la tabla está vacía, la prueba es **vacua**; si no lo está, faltaba el control. En cualquiera de los dos casos hay que repetirla como en la §3.

**b) "La tabla `habitaciones` está vacía en el proyecto"**
Es el estado **final** que yo también verifiqué (0 filas al cierre de esta revisión), pero **no es un estado estable**: se llena y se vacía mientras corren los arneses. La frase es peligrosa como supuesto de trabajo para cualquier verificación futura (ver A-5).

**c) "Se comprueba la fila devuelta y no se responde éxito si no se modificó nada"**
**Confirmado y bien resuelto.** `app/actions/pensiones.ts:347-357` y `:421-427` responden con error explícito cuando no hay fila. Además verifiqué la condición inversa (que un dueño legítimo **siempre** reciba su fila, incluso con la publicación retirada), así que no hay falso éxito **ni** falso error. Es la parte mejor construida del camino de escritura.

**d) "La RLS permite al anfitrión actualizar lo suyo"**
**Confirmado**, con un matiz importante: permite actualizar **todas las columnas** de lo suyo, y ahí están A-1 y A-2. La RLS resuelve *qué filas*, no *qué campos*.

---

## 6. Lo verificado y correcto (no tocar)

1. **Identidad desde la sesión, nunca desde el formulario** en las tres acciones (`:146-153`, `:324-331`, `:398-405`). Es la decisión que hace que el resto sea defendible.
2. **Comprobación de la fila devuelta** en las dos acciones nuevas, con mensaje útil para el anfitrión en lugar de un éxito falso.
3. **`WITH CHECK` en la política UPDATE de `habitaciones`** aplicado en la base y **funcionando**: bloquea mover una habitación a la publicación de otro o transferir la propia (probado: error `42501`).
4. **`pensiones: lectura publica de activas` y `habitaciones: lectura publica`**: retirar oculta de verdad al público, probado con el rol `anon` y con control positivo.
5. **Revalidación correcta tras cada escritura**: `revalidateTag` + `revalidatePath("/")`, `"/publicar"` y la ficha concreta (`:284-289`), de modo que la retirada no queda servida desde la caché ISR.
6. **Sin éxito falso al bloquear**: un `WITH CHECK` produce error y el código lo trata en la rama de error, no como éxito.
7. **`crear_pension_con_habitaciones` es `SECURITY INVOKER`** con `set search_path = public` (`oleada-1.sql:117-119`): la RLS sigue aplicando dentro de la función, y `anon` **no** puede ejecutarla (verificado con `has_function_privilege`). El trigger `sincronizar_precio_pension` también tiene la ejecución revocada para `anon` y `authenticated` (`:104-105`), que es la corrección correcta.
8. **Integridad referencial sana**: ambas claves foráneas validadas, 0 habitaciones huérfanas.
9. **CSRF**: las acciones se invocan como Server Actions (POST con el identificador firmado del framework, que Next valida contra el origen); no hay `allowedOrigins` que relaje esa comprobación en `next.config.mjs`.
10. **Detalles del panel bien resueltos**: `disabled={pending}` impide el doble envío (`PanelPublicacion.tsx:202-207`); el enlace "Ver en el catálogo" se oculta cuando la publicación está retirada (`:170-184`), evitando el 404 que se había detectado; los mensajes usan `role="status"`/`role="alert"` (`:221-236`).
11. **Los tres estados de disponibilidad son honestos**: la tarjeta distingue *sin habitaciones publicadas* de *sin habitaciones libres* (`CardPension.tsx:31-34,77-81`) y el precio solo se muestra si hay algo reservable.

---

## 7. Correcciones propuestas, por orden

| Prioridad | Acción | Hallazgo | Esfuerzo |
|---|---|---|---|
| 1 | Revocar al rol `authenticated` el `UPDATE` de `verificado`, `calificacion`, `creada_en`, `anfitrion_id`, `latitud`, `longitud` (con la precaución de `precio_mensual` por la RPC) | A-1 | 30 min |
| 2 | Imponer `precio_mensual` con un trigger `before insert or update on pensiones` (cierra A-1 y A-2 de una vez) | A-1, A-2 | 1 h |
| 3 | Que los **filtros** usen la misma regla de precio que la tarjeta y la ficha (`precioReservable`) | A-2 | 30 min |
| 4 | Añadir el predicado de propiedad a las dos consultas de escritura | A-3 | 20 min |
| 5 | Unificar la exigencia de correo confirmado en las tres acciones | A-4 | 10 min |
| 6 | Endurecer los `check` (precio de habitación ≥ 1000, cardinalidad de arrays, rango de coordenadas) | A-6 | 20 min |
| 7 | Sacar los arneses de prueba de la base de producción; versionar el proyecto | A-5 | 2–4 h |

**Prueba de regresión mínima tras aplicar 1–3** (todo debe seguir funcionando): marcar ocupada/libre una habitación desde el panel → el chip cambia y el catálogo se actualiza; retirar y volver a publicar → desaparece y reaparece; y los tres casos de A-1/A-2 → `403`/`42501` y sin precio fantasma.

---

## 8. Límites de esta revisión

1. **No se compiló ni se levantó la aplicación** (restricción de la tarea: `.next` es de la #12). Por tanto **no se probó la interfaz en un navegador**: las conclusiones sobre "sin éxito falso" y sobre el comportamiento del panel se apoyan en el código y en las políticas reales de la base, no en una prueba de clics. Lo que sí es prueba directa es toda la autorización a nivel de datos (§3).
2. **Las pruebas de autorización se ejecutaron en la base de producción**, aunque siempre dentro de transacciones revertidas y con datos sintéticos. Verificación final de residuos: 0 pensiones, 0 habitaciones y 0 usuarios de prueba (incluido el segundo anfitrión sintético, creado en una transacción revertida).
3. **Los estados de datos citados están fechados.** Durante la revisión, la tarea #12 corrió en paralelo y creó/eliminó filas de prueba; los recuentos que se citan son de mis consultas (con su hora) y no deben usarse como foto permanente. Estado al cierre: 1 pensión (*"Residencia Makia"*, activa, `verificado = false`, `calificacion = 0.0`, `precio_mensual = 600000`, **0 habitaciones**), 0 habitaciones, 1 usuario.
4. **No se audita aquí la UI del panel** (accesibilidad, textos, CRO): es de otras tareas. Esta revisión cubre el camino de escritura, su autorización y su efecto sobre los datos públicos.
5. **A-1 y A-2 no los introduce la tarea #10**: son propiedades de la política y del esquema que existían antes. Se reportan aquí porque el panel es la primera escritura sobre datos existentes y porque su revisión los sacó a la luz. **El código de #10 está bien**; lo que hay que corregir es la superficie en la que se apoya.

---

## Anexo — Cómo reproducir las comprobaciones

Patrón para simular un usuario autenticado **sin ser superusuario** (lo importante es cambiar el rol de sesión; sin eso, la RLS no aplica y todas las pruebas "pasarían", que es el error que invalida una matriz de autorización):

```sql
do $rev$
declare v_uid uuid;
begin
  select id into v_uid from auth.users order by created_at limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  perform set_config('role', 'authenticated', true);   -- ← imprescindible

  -- … prueba (control con el dueño, ataque con otro uuid, anónimo con role anon) …

  raise exception 'RESULTADO|%', v_resultado;   -- revierte todo lo hecho en el bloque
end $rev$;
```

Consultas de introspección usadas (no modifican nada):

```sql
select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public';

select c.relname, a.attname,
       has_column_privilege('authenticated', c.oid, a.attnum, 'UPDATE') as auth_update
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
where n.nspname = 'public' and c.relname in ('pensiones','habitaciones');

select proname, prosecdef, proacl from pg_proc p
join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public';

select tgrelid::regclass, tgname from pg_trigger where not tgisinternal;
```

**Resultados obtenidos con ellas** (los que sostienen A-1 y la §3): privilegio de `UPDATE` en **todas** las columnas de `pensiones` para `authenticated`; cero triggers sobre `pensiones`; RLS activa en las tres tablas; `WITH CHECK` presente en la política UPDATE de `habitaciones`; `prosecdef = false` en la RPC; ejecución de la RPC y del trigger denegada a `anon`.
