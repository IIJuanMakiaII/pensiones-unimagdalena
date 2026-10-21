# Oleada 17 — el estado «reservada» de una habitación

> Tarea **#103**. Migración: [`supabase/oleada-17-habitacion-reservada.sql`](../supabase/oleada-17-habitacion-reservada.sql).
> **No está aplicada.** La aplica Juan en el editor SQL del proyecto `ayznnqkacpdvvufclhon`.
> Bloquea la ficha **#106** (el botón del panel maestro), que no puede fusionarse antes.

## Qué añade, y qué no

| Añade | No toca |
|---|---|
| Tres columnas en `habitaciones`: `reservada_en`, `reservada_por`, `disponible_antes_de_reservar` | `habitaciones.disponible` (sigue siendo el predicado del catálogo) |
| Cuatro `check` que impiden estados imposibles | Precios, comisión, anticipo |
| Dos funciones `security definer`: `marcar_habitacion_reservada(uuid)` y `liberar_habitacion_reservada(uuid)` | `pensiones` y sus privilegios |
| `select`/`update` de `habitaciones` reemitidos **por columna** | Ninguna fila existente |

**Por qué una habitación reservada deja de ofrecerse sin tocar ninguna consulta:** el catálogo, la ficha y el precio «desde» ya filtran por `habitaciones.disponible` (`lib/pensiones.ts:27`, `components/DetallePension.tsx:26-27`, `lib/filtros.ts:67-68,146`). Marcar una reserva pone `disponible = false`, así que el mismo predicado la excluye en el acto. El estado nuevo **acompaña** al booleano, no lo sustituye.

## Antes de aplicar — dos comprobaciones de un minuto

1. Que no haya reservas a medias de una prueba anterior:
   ```sql
   select count(*) from public.habitaciones where reservada_en is not null;   -- esperado: 0
   ```
   Antes de aplicar las columnas no existen, así que esta consulta **fallará con `42703`**. Eso es lo normal y es la primera prueba de que la migración hace falta.
2. Que `es_maestro()` exista (la necesita el `raise` de las funciones):
   ```sql
   select pg_catalog.to_regprocedure('public.es_maestro()') is not null;       -- esperado: t
   ```

## Orden de pasos

| Paso | Qué | Resultado esperado |
|---|---|---|
| 1 | Pegar **el archivo entero** en <https://supabase.com/dashboard/project/ayznnqkacpdvvufclhon/sql> y ejecutar | `Success. No rows returned` (la última sentencia ejecutable del archivo es un comentario) |
| 2 | Correr **G.2** (los cuatro `check`) | Aparecen `habitaciones_autor_con_fecha`, `habitaciones_reserva_con_valor_previo`, `habitaciones_reservada_no_se_ofrece`, `habitaciones_sin_reserva_sin_rastro` |
| 3 | Correr **G.3** — el semáforo de lectura | **`f \| f`**. Si alguna da `t`, **no se despliega el botón** |
| 4 | Correr **G.4** — el semáforo de escritura | **`t \| t \| f \| f`** |
| 5 | Correr **G.5** y **G.6** | 2 filas con `prosecdef = t`; `f \| f` |
| 6 | Correr **G.8** (la consulta de la app, con la clave anónima) | **200** y las mismas habitaciones que antes. Un `42501` aquí = la lista del `grant` y `COLUMNAS_HABITACION` se separaron |
| 7 | Correr **G.7** sustituyendo `<UUID_MAESTRO>` | Marca → `disponible = f`; repetir no mueve la fecha; liberar → `true` y `disponible` vuelve a `t`. Termina en `rollback` |
| 8 | Correr **G.9** | `0` reservadas |

**Los dos semáforos que deciden son G.3 y G.8.** G.3 prueba que el estado no se lee desde fuera; G.8 prueba que el catálogo sigue en pie. Lo demás es integridad.

## Después de aplicar, desde fuera

```bash
# 1. La app sigue leyendo habitaciones (debe dar 200 con filas)
curl -s -w '\n%{http_code}\n' \
  "$SUPABASE_URL/rest/v1/habitaciones?select=id,pension_id,tipo,genero,precio_mensual_cop,alimentacion_incluida,disponible" \
  -H "apikey: $ANON_KEY"

# 2. El estado NO se lee con la clave pública (debe dar 401 · 42501)
curl -s -w '\n%{http_code}\n' \
  "$SUPABASE_URL/rest/v1/habitaciones?select=reservada_en" \
  -H "apikey: $ANON_KEY"

# 3. Y por `select=*` tampoco (401 · 42501): el SELECT ya es por columna
curl -s -w '\n%{http_code}\n' \
  "$SUPABASE_URL/rest/v1/habitaciones?select=*" \
  -H "apikey: $ANON_KEY"
```

La número 3 es nueva y esperada: `habitaciones` deja de aceptar `select=*`, igual que `pensiones` desde la oleada 10. **Ningún consumidor de la app lo usa** — se comprobó antes de escribir la migración: la app pide `COLUMNAS_HABITACION` (7 columnas), `verificar-supabase.mjs:44` pide `id,pension_id,disponible`, y las funciones que leen la tabla son `security definer`.

## Rollback

Está al final del `.sql`, **comentado** para que pegarlo entero no lo ejecute. Descomentado, corre en una sola transacción y deja la tabla como estaba en `41aca1e`: sin las tres columnas, sin los cuatro `check`, sin las dos funciones y con el `select` de tabla devuelto. El orden importa y está razonado en el archivo: funciones → checks → columnas (al revés, Postgres rechaza el `drop column` por dependencia).

**No se pierde ningún dato de negocio:** las tres columnas nacen `NULL` y solo se llenan al marcar una reserva. Si hay reservas marcadas y se revierte, se pierde el registro de esas reservas — por eso el rollback debe ejecutarse, si hace falta, con la tabla de reservas vacía (G.9 = 0).

## Lo que esta oleada NO decide

1. **Si el estudiante ve «Reservada» o «Ocupada».** La base guarda la diferencia; `components/DetallePension.tsx:26-27` sigue diciendo «Ocupadas por ahora». Mostrarlo es un cambio de interfaz, sin migración.
2. **Si se exige `pensiones.verificado = true` para reservar.** Hoy no se exige, y no puede exigirse todavía: la única pensión publicada tiene `verificado = false`.
3. **Nada de pagos.** No hay pasarela ni evento de «pago confirmado»; la confirmación es de Juan, y la marca la pone él desde el panel.

## Registro de comprobaciones

| Qué | Cómo se comprobó | Origen |
|---|---|---|
| `habitaciones` no tenía SELECT por columna | `?select=*` con la clave anónima respondía **200** | sondas del 21 oct (auditoría #98) |
| La app no usa `select=*` | `lib/datos.ts` usa `COLUMNAS_HABITACION` en las 6 lecturas | lectura del código |
| La app entra entera en la lista reemitida | La sección 4 concede **8** columnas: las **7** de `COLUMNAS_HABITACION` (`id, pension_id, tipo, genero, precio_mensual_cop, alimentacion_incluida, disponible`) **más `creada_en`**. Las lecturas y las escrituras de la app caben sin un `42501` | `lib/supabase/mapeo.ts:107-115`; `lib/pension-escritura.ts:146-150,377,421`; `app/actions/maestro.ts:143`; `app/actions/pensiones.ts:332` |
| `creada_en` se concede aunque la app no la lea | Es la fecha de creación de la habitación, no un dato de nadie; excluirla solo ahorraría una columna y dejaría roto cualquier lectura que ordene por ella. No se concede en cambio `reservada_en`, `reservada_por` ni `disponible_antes_de_reservar`, que es donde sí hay información de terceros | decisión de esta tarea |
| El `update` no puede perder `disponible` | Oleada 11:154-161 lo reemite con 5 columnas; la sección 4 las repite idénticas | lectura de `oleada-11` |
| Las funciones que leen la tabla no se rompen | `imponer_precio_pension` y `crear_pension_con_habitaciones` son `security definer`, o piden columnas de la lista | `oleada-1.sql:77,86-88,188-190` |
| `es_maestro()` existe y es definer | `oleada-9.sql:76-90` | lectura |
| El rollback es simétrico | Cada objeto que crea la migración aparece en la reversión; verificado por script | esta tarea |
