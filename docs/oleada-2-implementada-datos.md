# Oleada 2 — Cierre de la superficie de escritura (datos y backend)

**Tarea:** #14 · **Autor:** Arquitecto Datos/Backend
**Fecha:** 17 de septiembre de 2026
**Hallazgos cerrados:** A-1, A-2 (parte de servidor) y A-6 de [docs/auditorias/seguridad-panel-disponibilidad.md](auditorias/seguridad-panel-disponibilidad.md)
**Artefactos:** [supabase/oleada-2.sql](../supabase/oleada-2.sql) · [supabase/pruebas/oleada-2.sql](../supabase/pruebas/oleada-2.sql)
**Migración aplicada al proyecto real:** `oleada_2_cerrar_escritura` (versión `20260918033345`), registrada en el historial del proyecto (`supabase_migrations.schema_migrations`).

---

## 1. Qué estaba mal (medido, no deducido)

El informe de la tarea #11 lo dejó probado con la sesión del propio anfitrión. Yo lo volví a medir antes de tocar nada, dentro de una transacción que termina en excepción (revertida, sin residuos):

```
ANTES >> filas_sello=1 verificado=t calificacion=5.0 precio_tras_patch=1000 precio_rpc_inventado=1234
```

| Hallazgo | Qué significa |
|---|---|
| **A-1** | El anfitrión ejecutó `update pensiones set verificado = true, calificacion = 5.0` → **1 fila**. El sello «Verificado» y el «Puntaje del equipo» —lo que miran los padres para decidir— los escribía quien los recibe. |
| **A-2** | `update pensiones set precio_mensual = 1000` → **guardado**. Y por la RPC: `precio_mensual: 1234` con la habitación ya ocupada → **guardado 1234**. Precio publicado a voluntad del cliente. |
| **A-6** | La RPC no validaba lo que el formulario prohíbe: habitación a 0 COP, arrays sin límite, coordenadas sin rango. |

**Causa raíz común:** RLS resuelve *qué filas* puede tocar un rol, no *qué columnas*. Y `has_column_privilege('authenticated', …)` devolvía `true` para **todas** las columnas de las tres tablas. No había ningún disparador sobre `pensiones`.

---

## 2. Qué hice

Todo en la base. **Cero líneas de código de la aplicación modificadas.**

### 2.1 Privilegios de columna (A-1)

En `pensiones` y `habitaciones` no se revoca columna por columna, sino el privilegio de tabla, y se reconcede **solo la columna que la interfaz escribe de verdad**:

```sql
revoke update on public.pensiones from anon, authenticated;
grant  update (activa) on public.pensiones to authenticated;
```

Por qué así: en PostgreSQL, **revocar una columna no retira el privilegio de tabla**. Con el `grant all on tables to authenticated` que Supabase aplica por defecto, un `revoke update (verificado)` habría dejado el privilegio intacto. Revocar la tabla y reconceder la columna es explícito y no depende de cómo esté el ACL.

| Tabla | Columna concedida | Por qué esa y no otra |
|---|---|---|
| `pensiones` | `activa` | Es lo único que escribe `cambiarEstadoPublicacion` (retirar / volver a publicar) |
| `habitaciones` | `disponible` | Es lo único que escribe `cambiarDisponibilidadHabitacion` (marcar ocupada / libre) |
| `usuarios` | `nombre`, `email` | La aplicación no escribe esta tabla; se protegen `id`, `rol` y `creado_en` (el `rol` era auto-modificable: hoy inerte, escalada en cuanto una política lo consulte) |

Verificado con búsqueda en todo el código: la aplicación **no escribe** `precio_mensual`, `verificado`, `calificacion` ni `usuarios` en ningún punto. Las tres son solo de lectura (`lib/supabase/mapeo.ts`, tarjetas y ficha), así que revocarlas no puede romper nada.

### 2.2 El precio lo impone la base (A-1 + A-2)

Nuevo disparador `antes_de_escribir_pension` (`before insert or update on pensiones`) que **nunca lee el precio de la petición**: lo deriva de las habitaciones.

- Mínimo de las habitaciones **disponibles** (la regla de negocio vigente, igual que `lib/pension.ts`).
- Si ninguna está disponible pero existen, el mínimo de todas.
- Si no hay habitaciones: en `INSERT` queda en 0; en `UPDATE` se **conserva** el valor guardado (no se destruye el dato de una publicación heredada como «Residencia Makia»).

Y la RPC dejó de leer `precio_mensual` del cliente (`p_pension->>'precio_mensual'`): inserta 0 y el valor real lo fijan los disparadores. Se eliminó también el `update … set precio_mensual` que hacía la RPC al final —era redundante y, con el privilegio revocado, habría fallado con `42501`.

### 2.3 Decisión de diseño: se aplican **las dos** correcciones que el informe ofrecía como alternativas

El informe planteaba elegir entre revocar el privilegio (con la precaución de la RPC) o dejar la columna escribible y añadir un disparador. Se aplican las dos, porque cubren fallos distintos:

- El **privilegio** es una barrera declarativa: la base rechaza el `PATCH` antes de evaluar RLS (`42501`). Cubre el ataque directo, que es el real.
- El **disparador** cubre que alguien vuelva a conceder el privilegio, o que una función `SECURITY DEFINER` futura escriba la columna. Sin él, la corrección dependería de que nadie olvide un `GRANT`.

### 2.4 Validaciones de forma (A-6)

Restricciones en la tabla (barrera real) **y** validaciones en la RPC (para que el anfitrión reciba un mensaje en español en lugar del error crudo de una restricción):

| Regla | Base | RPC |
|---|---|---|
| Precio de habitación entre 1000 y 20.000.000 COP | `habitaciones_precio_rango` | mensaje claro |
| Máximo 12 servicios | `pensiones_servicios_limite` | mensaje claro |
| Máximo 8 normas | `pensiones_normas_limite` | mensaje claro |
| Coordenadas en pareja y en rango válido | `pensiones_coordenadas_rango` | mensaje claro |

Los casts se protegen con comprobaciones previas de formato: un texto no numérico ya no produce un error de tipo sin contexto. Antes de añadir cada restricción comprobé que **ninguna fila existente la incumple** (0 violaciones en las cuatro).

---

## 3. Verificación

`supabase/pruebas/oleada-2.sql` — se ejecuta y se limpia sola. **14/14 en verde** contra el proyecto real.

```
 1. A-2 precio = habitación más barata libre   ok   precio=500000
 2. A-2 precio inventado 1234 ignorado         ok   precio=0 (el 1234 del cliente no se guardó)
 3. A-1 sello verificado y calificación        ok   42501 · permission denied for table pensiones
 4. A-1/A-2 precio_mensual por PATCH directo   ok   42501 · permission denied for table pensiones
 5. El panel sigue publicando/retirando        ok   filas=1     ← control positivo
 6. El panel sigue marcando ocupada/libre      ok   filas=1     ← control positivo
 7. A-6 rechaza habitación a 0 COP             ok   P0001 · El precio debe estar entre 1000 y 20000000
 8. A-6 rechaza 13 servicios                   ok   P0001 · Demasiados servicios (máximo 12)
 9. A-6 rechaza 9 normas                       ok   P0001 · Demasiadas normas (máximo 8)
10. A-6 rechaza coordenadas fuera de rango     ok   P0001 · Las coordenadas están fuera del rango válido
11. A-6 rechaza latitud sin longitud           ok   P0001 · Indica la latitud y la longitud juntas
12. anon puede LEER las tres columnas          ok   verificado=t calificacion=t precio_mensual=t
13. anon sigue viendo el catálogo publicado    ok   lectura pública intacta
14. limpieza sin residuos                      ok   residuos=0
```

**Estado final de la base** (consulta independiente, después de las pruebas):

```
privilegios authenticated:
  pensiones:   verificado=f  calificacion=f  precio_mensual=f  activa=t
  habitaciones: disponible=t
disparadores en pensiones: antes_de_escribir_pension
restricciones nuevas: pensiones_servicios_limite, pensiones_normas_limite,
                      pensiones_coordenadas_rango, habitaciones_precio_rango
datos: 1 pensión · 0 habitaciones · 1 usuario · 0 residuos de prueba
publicación real intacta: «Residencia Makia» activa=t verificado=f calificacion=0.0 precio=600000
migraciones aplicadas: 5 (…, oleada_1_habitaciones, oleada_2_cerrar_escritura)
```

### Precauciones de método en las pruebas

1. **El rol de sesión se cambia de verdad** (`set_config('role', …)`) y se restaura tras cada prueba. Sin cambiarlo, las pruebas correrían como el dueño de las tablas: ni RLS ni privilegios aplicarían y todas «pasarían». Es el error que invalida una matriz de autorización.
2. **Hay controles positivos** (pruebas 5 y 6): un «rechazado» solo significa algo si el mismo rol puede hacer lo legítimo.
3. **Las publicaciones de prueba se crean retiradas** (`activa = false`), así que nunca aparecieron en el catálogo público. Es una mejora sobre el arnés de la Oleada 1, que las crea activas (ya señalado como A-5).
4. **No se toca la publicación real del anfitrión**: ni su estado, ni su precio, ni su visibilidad. Confirmado al cierre con los valores idénticos a la línea base del informe de seguridad.

---

## 4. Lo que dejé fuera a propósito

Estos puntos **no** entraban en los criterios de aceptación de esta tarea. Los dejo señalados con su coste para que se despachen aparte:

| Pendiente | Origen | Por qué importa | Esfuerzo |
|---|---|---|---|
| **La rama de precio de los filtros** | A-2 · corrección nº 3 del informe de seguridad | Con el precio ya derivado por la base, un anuncio con habitaciones **todas ocupadas** puede quedar en `precio_mensual = 0` y entonces **aparece en cualquier búsqueda filtrada por precio** aunque no tenga nada que reservar (`lib/filtros.ts:82-84`). La corrección es distinguir «tiene habitaciones, todas ocupadas» de «no publicó habitaciones». Es código de aplicación, no base de datos. | 30 min |
| **Predicado de propiedad en las dos consultas de escritura** | A-3 | Hoy la autorización descansa solo en RLS. No es una vulnerabilidad, es un modo de fallo. | 20 min |
| **Exigir correo confirmado en las dos acciones nuevas** | A-4 | Coherencia con `crearPension`. Hoy no es explotable. | 10 min |
| **Sacar los arneses de la base de producción y versionar el proyecto** | A-5 | Apareció una pensión de prueba transitoria durante mi propia verificación (creada por otro arnés en paralelo), lo que confirma el hallazgo. | 2–4 h |
| **Descripción mínima de 30 caracteres en la base** | A-6, no listado | El formulario la exige; la base solo limita el máximo. Un anuncio con descripción vacía por API se renderiza vacío. | 10 min |

**Nota sobre una decisión consciente:** mantuve el disparador `sincronizar_precio_pension` **exactamente como estaba** (solo recalcula si queda alguna habitación libre). Cambiar su respaldo a «mínimo de todas» habría dado un precio más significativo en el caso de «todas ocupadas», pero habría dejado desactualizados tres comentarios del código de otros agentes (`lib/pension.ts`, `CardPension.tsx`, `app/pensiones/[id]/page.tsx`) que describen con precisión el comportamiento actual. La corrección correcta de ese caso es la rama de filtros de la tabla de arriba, no el disparador.

---

## 5. Cómo repetir la verificación

```sql
-- Pruebas de aceptación completas (se limpian solas, no tocan datos reales)
-- Ejecutar el contenido de: supabase/pruebas/oleada-2.sql
```

O desde el MCP de Supabase, sobre el proyecto `ayznnqkacpdvvufclhon`. Las consultas de comprobación rápida están al final de `supabase/oleada-2.sql`, y la reversión de la migración también está documentada ahí (con la advertencia de que volver a conceder `update` sobre `pensiones` reintroduce A-1).
