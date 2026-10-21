# Oleada 17 · Revisión previa de QA y Seguridad

**Fecha:** 21 de octubre de 2026
**Objeto:** `supabase/oleada-17-habitacion-reservada.sql` (508 líneas, 22.960 bytes, `sha256` `9ce9c5d43f4d59b1c66ea7f8a55c27a2ec4dd78ed09e50a21134ee58cbf16171`) y su procedimiento `docs/oleada-17-procedimiento-de-aplicacion.md` (372 líneas, 23.360 bytes), commit `d4df449`.
**Método:** solo lectura. No se ejecutó nada contra la base, no se aplicó la migración, no se tocó `main`, no se fusionó, no se desplegó, no se abrió `.acceso`.

---

## Veredicto: **PASS con dos condiciones documentales**

La migración es **apta para aplicarse**. Las dos condiciones que pongo **no tocan el `.sql`**: son sobre el documento que la acompaña, y ninguna bloquea la ejecución. El SQL no tiene un solo defecto que impida aplicarlo.

**Condición 1** — antes de publicar `d4df449` en `origin` (tarea #115), sustituir la ruta absoluta del disco del operador por una relativa (§H-1). No bloquea la aplicación; bloquea la publicación del documento tal cual.
**Condición 2** — añadir al procedimiento la advertencia de que `.gitignore` no cubre un token suelto (§H-2). Tampoco bloquea.

---

## Lo que verifiqué y sale bien

### 1. ¿Es aditiva? — **Sí** [MEDIDO]

191 líneas activas (sin comentarios). Cero `delete`, cero `truncate`, cero `update` sobre datos de negocio fuera de las dos funciones.

Los cuatro `drop` activos no son destructivos: son `drop constraint if exists` de las líneas 110, 117, 124 y 134, el patrón idempotente que sustituye al inexistente `add constraint if not exists`. Las tres columnas se crean con `add column if not exists` (77, 80, 85), así que reejecutar no duplica ni sobrescribe nada.

`pensiones` **no se escribe en ninguna parte**. Aparece solo como lectura dentro de las funciones. La única escritura de la migración sobre datos existentes es la de las funciones, y solo sobre tres columnas nacidas `NULL`.

Ningún camino pierde datos: el cambio más agresivo es añadir `NULL` a tres columnas nuevas.

### 2. Las columnas del `grant select` frente a lo que la app lee — **completa, cero olvidos** [MEDIDO]

La lista reemitida tiene **8 columnas** (`.sql:310-319`): `id`, `pension_id`, `tipo`, `genero`, `precio_mensual_cop`, `alimentacion_incluida`, `disponible`, `creada_en`.

Lo que la aplicación pide de verdad:

| Columna | Dónde se pide | ¿En el `grant`? |
|---|---|---|
| `id` | `lib/supabase/mapeo.ts:129` · `lib/datos.ts:119,201,396,427,471` · `lib/pension-escritura.ts:378` · `app/actions/maestro.ts:147,210,413` · `app/actions/pensiones.ts:309,340,427,511,584` | **sí** |
| `pension_id` | `lib/supabase/mapeo.ts:130` · `app/actions/pensiones.ts:340` | **sí** |
| `tipo` | `lib/supabase/mapeo.ts:131` | **sí** |
| `genero` | `lib/supabase/mapeo.ts:132` | **sí** |
| `precio_mensual_cop` | `lib/supabase/mapeo.ts:133` | **sí** |
| `alimentacion_incluida` | `lib/supabase/mapeo.ts:134` | **sí** |
| `disponible` | `lib/supabase/mapeo.ts:135` | **sí** |
| `creada_en` | nadie la pide | **sí, de más** |

Las siete de `COLUMNAS_HABITACION` (`mapeo.ts:128-136`) están las siete. `creada_en` es la octava y sobra: cubrirla no hace daño y evita romper cualquier lectura futura que ordene por ella.

**Las dos únicas consultas que no usan `COLUMNAS_HABITACION` tampoco salen de la lista:** `select("id")` y `select("id, pension_id")` (`app/actions/pensiones.ts:340`). Ambas cubiertas.

**El caso que más me preocupaba —la escritura— también cuadra.** `lib/pension-escritura.ts:419` hace `const { id, ...campos } = habitacion` y `:422` ejecuta `.update(campos)`. `campos` no es un objeto libre: el tipo es `EntradaHabitacionEditada` (`types/index.ts:235`), que extiende `EntradaHabitacion` (`types/index.ts:220-226`) y añade solo `id?`. Desestructurado `id`, quedan exactamente `tipo`, `genero`, `precio_mensual_cop`, `alimentacion_incluida` y `disponible`: **las cinco del `grant update`** (`.sql:322-328`). Ni una más, ni una menos. Y no lleva `pension_id`, que es justo la columna que el comentario de `oleada-3.sql:115` deja fuera a propósito.

Un detalle que confirma que la lista no recorta nada que ya se usara: **no existía ningún `grant select` por columna previo sobre `habitaciones`**. `oleada-3.sql:105-113` y `oleada-11:154-161` solo conceden `update`. El `select` actual viene del privilegio de tabla por defecto de Supabase, que es exactamente lo que la sección 4 sustituye. Por tanto no hay una lista anterior más amplia que esta pueda dejar corta.

### 3. `security definer`, `search_path` y `revoke` — **correcto** [LEÍDO]

```
.sql:162-163   security definer / set search_path = pg_catalog   (marcar)
.sql:223-224   security definer / set search_path = pg_catalog   (liberar)
.sql:332       revoke all on function … from public, anon, authenticated
.sql:333       grant execute … to authenticated
.sql:335-336   revoke all / grant execute                        (liberar)
```

Las dos fijan `search_path = pg_catalog`, así que un `search_path` manipulado por el llamante no puede redirigir las referencias. El `revoke all` —y no solo `execute`— cierra la herencia de `public`, que en Postgres trae `EXECUTE` por defecto; sin ese `revoke`, `anon` heredaría la llamada.

Y no se apoyan solo en el privilegio: ambas validan el rol en el cuerpo. `.sql:196` y `.sql:254` abortan con `42501` si no es el maestro ni el anfitrión dueño. Con `security definer` sobre un dueño con `BYPASSRLS`, esa validación explícita es la que sostiene la autorización, y está.

### 4. El hallazgo del Arquitecto sobre el rollback — **correcto, y está escrito** [LEÍDO]

Lo verifiqué por mi cuenta y coincide. `liberar` devuelve el estado con `coalesce(v_disponible_antes, false)` (`.sql:266`), y ese valor previo vive en `disponible_antes_de_reservar`. Si se revierte, el `drop column` se lleva la única columna que sabía a qué estado volver, y la habitación **se queda apagada**: el rollback restaura la estructura, no el estado.

El procedimiento lo dice en §3.2 (líneas 171-178) con la misma conclusión a la que llegué yo: **es inocuo solo si `select count(*) from public.habitaciones where reservada_en is not null` da 0**, o si se devuelve `disponible` desde `respaldo.habitaciones_20261021` emparejando por `id` **antes** de revertir. El orden importa y está dicho en ese mismo párrafo. Nada que objetar.

### 5. El respaldo — **verificable y suficiente** [LEÍDO]

`create schema if not exists respaldo` (`.md:75`) y `revoke all on schema respaldo from public, anon, authenticated` (`:77`), así que el respaldo no nace legible desde la API.

La copia nombra **las ocho columnas una a una** (`.md:82-89`), sin comodín. Y son **las ocho del `grant select`**: lo que se respalda es exactamente lo que el cliente podrá leer después, que es la pregunta correcta. Coinciden nombre a nombre y en el mismo orden.

La verificación es la buena: conteo **y** diferencia simétrica en los dos sentidos (`.md:108-123`). El propio documento explica por qué el conteo solo no basta —dos tablas con el mismo número de filas pueden tener filas distintas— y tiene razón. Falta una tercera dimensión (privilegios), pero eso no lo cubre el respaldo: lo cubre la huella H.1-H.8 de §3.3, que sí compara privilegios de tabla y de columna.

### 6. `select=*` de 200 a `42501` — **sin consumidores, confirmado** [MEDIDO]

`select("*")` aparece **una sola vez** en todo el código activo, y es un **comentario** que explica por qué ya no se usa (`lib/supabase/mapeo.ts:88`). Cero llamadas reales.

`select=*` aparece solo en scripts de verificación y **nunca sobre `habitaciones`**: `scripts/verificar-contacto-privado.mjs:372` (sobre `contacto_anfitrion`) y `scripts/verificar-exposicion-propietario.mjs:241` (sobre `pensiones`). Ninguno se rompe.

Y el `revoke` sí cierra el comodín de verdad: busqué `grant … to public` sobre `habitaciones` en todas las migraciones y **no existe ninguno**. Los privilegios van a `anon`/`authenticated`, que es de donde hereda el `200` actual. Revocar a esos dos roles lo cierra.

### 7. Secretos e interfaz — **limpio** [MEDIDO]

El `.sql`: cero coincidencias de `sbp_`, `eyJ`, `service_role`, `SUPABASE_SERVICE`, `postgres://`, `password`, `Bearer`.

El `.md`: cero valores. La línea 54 usa `-H "Authorization: Bearer $tok"` con **variable**, no con el token. Menciona el nombre del proyecto en la línea 36, que ya es público en el HTML del sitio.

Sobre la interfaz: la migración no toca ni un archivo de interfaz. Sus 191 líneas activas escriben solo en `public.habitaciones`, crean dos funciones en `public` y reemiten privilegios. Las dos menciones a archivos de interfaz en el `.sql` son comentarios. `components/Filtros.tsx` es `"use client"`, recibe todo por props y no consulta la base: el plegado de filtros **no puede** verse afectado por esta migración. Coincide con lo que declaró el Arquitecto y lo confirmo leyendo, no copiando.

Y la rama **no asume ninguna fusión**: el documento no menciona fusionar, ni `merge`, ni `cherry-pick`. La única aparición de `41aca1e` es la línea 454, y se refiere al estado de la **base**, no a una rama. La restricción de no fusionar `habitacion-reservada-103` sigue siendo válida, pero no es un defecto de este procedimiento.

---

## Hallazgos

| # | Severidad | Hallazgo | Evidencia | Estado |
|---|---|---|---|---|
| **H-1** | **medio** | El procedimiento deja en el texto la **ruta absoluta del disco del operador**, incluida la carpeta donde se guarda el token. No es un secreto (no hay valor), pero la #115 publica `d4df449` en `origin` y esa ruta entra al historial del repositorio. | `.md:36` y `.md:37`: `C:\Users\DELL\AccioWork\...\.acceso\supabase-token.txt` | Abierto · **no bloquea la aplicación**, sí la publicación del documento tal cual |
| **H-2** | bajo | El procedimiento guarda el token fuera del repositorio —correcto— pero **no advierte** que `.gitignore` cubre `.env*.local` y **no** cubriría un token suelto. Quien lo aplique mañana puede no saberlo. | `.md:36-37` vs `.gitignore:23` | Abierto · no bloqueante |
| **H-3** | bajo | El `.md` vive en `nido-wt-103` y **no en el árbol de `main`**: la ficha #113 lo citaba en `pensiones-unimagdalena\docs\`. Mientras la #115 no publique, el procedimiento existe en un solo disco. | ruta real `nido-wt-103\docs\` · commit `d4df449` sin publicar en `origin` | Ya en curso (#115) |

Ninguno de los tres es un defecto del SQL. Los tres son del documento que lo acompaña.

---

## Riesgo residual declarado

Lo que **no** puedo afirmar y por tanto no firmo:

1. **No ejecuté nada.** El comportamiento de las dos funciones en tiempo de ejecución no está medido por mí: no hay token, y no aplico. Los semáforos G.3, G.4 y G.7 del `.sql` son la prueba que falta, y se miden **después** de aplicar. Mi veredicto es sobre el archivo, no sobre la base.
2. **No verifiqué que `es_maestro()` exista hoy en la base.** La sección 0 lo comprueba y aborta con un mensaje claro si falta (`.sql:59-60`). Es una guarda del archivo, no una medición mía.
3. **No sé si hay clientes externos** que hoy lean `habitaciones?select=*`. Sé que el código del repositorio no lo hace. Si alguien de fuera lo usa, ese `200` se convierte en `42501` sin aviso: es el cambio de comportamiento declarado en §0 y en el semáforo `comodin`, y me parece correcto, pero es un corte.
4. **El rollback no deshace las marcas.** Ya está escrito y es correcto. Quien revierta con reservas activas tiene que devolver `disponible` desde el respaldo **antes**, o perderá el estado.
5. **El `.sql` es idempotente pero la prueba funcional G.7 necesita un UUID de una cuenta maestra real.** Está resuelto en `.md:283-300` ejecutándola entre `begin` y `rollback`, de modo que no deja ninguna habitación marcada. No la ejecuté.

---

## Lo que hace falta para aplicar

En este orden, del procedimiento:

1. Token con alcance (`sbp_fc…`), solo `ayznnqkacpdvvufclhon`, permiso **Database → Read-write**, caducidad corta, guardado en `.acceso\` **fuera del repositorio**. Sin contraseña de Postgres ni `service_role`: el alcance del token no limita a los comandos que se autentican con la contraseña, y `service_role` se salta RLS.
2. Sondas `antes` y huella H.1-H.8 guardada.
3. Respaldo y su verificación (conteo **y** diferencia simétrica).
4. Secciones 0 a 4 del `.sql` **en una sola transacción**: `begin; … commit;`.
5. G.1-G.4 dentro, sondas `después`, y los cuatro semáforos: `ochoColumnas` = 200, las tres rutas web con `42501`=0 y `42703`=0, `reservadaEn` = 42501, `rpcMarcar` = 42501.
6. Revocar el token el mismo día.

Si `ochoColumnas` falla, se revierte en el acto: significa que la lista del `grant` y `COLUMNAS_HABITACION` se separaron, y el catálogo entero responde `42501`.
