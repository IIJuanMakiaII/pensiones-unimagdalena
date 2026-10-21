# Oleada 16 — El código visible de una pensión (`NID-0001`)

> **Estado: NO aplicada.** La aplica Juan en el editor SQL del panel:
> <https://supabase.com/dashboard/project/ayznnqkacpdvvufclhon/sql>
>
> Archivo: [`supabase/oleada-16-codigo-visible-pension.sql`](../supabase/oleada-16-codigo-visible-pension.sql).
> Rama: `codigo-visible-pension-87` (sin fusionar, sin empujar, sin desplegar).
> Tarea #87 · Oleada 16.

---

## 1. El orden, en una línea

**Aplicar la migración → comprobar que E.6 devuelve `t | t` → solo entonces fusionar y desplegar el código que lee el campo.**

La dirección contraria —desplegar primero— deja el catálogo sin anuncios hasta que se
aplique la migración. No es una hipótesis: es el fallo que ya ocurrió en este proyecto
con `verificado_en` y está medido en [`aplicar-migraciones-pendientes.md`](aplicar-migraciones-pendientes.md)
§2 (`HTTP 400`, `code 42703`, portada sin un solo enlace a fichas).

La dirección que sí es segura, y es la que se va a tomar: **aplicar la migración con el
código de producción actual**. Ese código no pide el campo, así que añadir la columna y
conceder su lectura no cambia nada de lo que hay publicado.

## 2. Qué se midió antes de escribirla (2026-10-12, solo lectura, clave anónima)

Las tres sondas son las mismas que documenta
[`aplicar-migraciones-pendientes.md`](aplicar-migraciones-pendientes.md) §3, y no escriben nada.

| Sonda | Respuesta | Qué significa |
|---|---|---|
| `pensiones?select=id,codigo_visible&limit=1` | `400` · `42703` · «column pensiones.codigo_visible does not exist» | **La columna no existe todavía.** Es el estado «antes», y es la prueba de que `oleada-16` no está aplicada |
| La proyección completa de 19 columnas `&activa=eq.true` | `200` | El catálogo funciona hoy; los permisos por columna están completos para lo que el código pide hoy |
| `pensiones?select=id,slug,creada_en,activa&order=creada_en.asc` | `200` · **1 fila**: `residencia-makia`, `creada_en = 2026-09-18T01:47:46.707833+00:00` | El anuncio de demostración es el único visible sin sesión, y es el más antiguo. **Después de aplicar, ese anuncio pasa a ser el `NID-0001`** |

Con la clave anónima solo se ven los anuncios activos; la consulta E.2 de la migración es
la que dice el total real (activas y retiradas) cuando Juan la ejecute.

## 3. Qué hace la migración, por secciones

| § | Qué hace | Por qué así |
|---|---|---|
| 1 | Añade `pensiones.codigo_visible text`, anulable y **sin `default`** | El valor no sale de una expresión de tabla: sale del sello o del relleno. Un `default` sería un segundo camino para asignar el mismo número |
| 2 | **El relleno**: numera lo que ya existe por `order by creada_en asc, id asc`, **solo las filas sin código** | El anuncio más antiguo es el `NID-0001`, y el reparto no cambia si la migración se aplica otra vez. El `id` desempata para que el orden sea total |
| 3 | **La secuencia** `pensiones_codigo_visible_seq` y su `setval(…, max + 1, false)` | De aquí salen los códigos nuevos, sin que dos anfitriones publicando a la vez puedan calcular el mismo número (que es lo que pasaría con `max() + 1`) |
| 4 | `not null`, `unique` y el CHECK de formato `^NID-[0-9]{4,}$` | `unique` hace cierto lo que promete el formato y crea el índice que necesita el buscador del panel. El formato se cierra en la base para que no pueda contener un código que no se pueda dictar |
| 5 | **El sello**: `asignar_codigo_pension()` + el disparador `antes_de_asignar_codigo`, `before insert` | El código lo pone la base al publicar. El disparador **pisa** el valor que llegue: la política `pensiones: crear las propias` permite a un anfitrión insertar en la tabla, así que el sello tiene que ser el disparador y no un privilegio |
| 6 | **La trampa**: `revoke select` + `grant select` con la lista completa (20 columnas) reemitida | `pensiones` concede la lectura columna por columna: una columna que falte aquí no llega vacía, **hace fallar la consulta con `42501`** y tumba el catálogo entero. Es la línea que decidió el precedente `oleada-13:211-233` |
| 7 | Verificación posterior, `E.1`–`E.8`, ninguna escribe nada | `E.6` es la que decide si se puede desplegar |
| 8 | Reversión, documentada y **no ejecutada** | `drop column` perdería los códigos repartidos: el esquema vuelve, el dato no |

## 4. Los tres criterios de aceptación, y dónde se comprueban

| Criterio | Dónde se sostiene |
|---|---|
| **Único, visible, generado en la base y no falsificable desde el cliente** | Lo genera el disparador (no el formulario: `EntradaPension` no tiene el campo). Nadie puede escribirlo después: `authenticated` no tiene UPDATE sobre la columna (se reafirma en §6 y lo mide E.5), la lista blanca del maestro (`oleada-9.sql:206`) rechaza la clave con `22023`, y un INSERT con un código a mano lo pisa el disparador (E.8, paso 2). `unique` impide que dos anuncios compartan código |
| **Aditiva, idempotente, sin pérdida y sin tocar la funcionalidad** | `add column if not exists`, `create sequence if not exists`, `drop constraint if exists` + `add`, `create or replace function`, `drop trigger if exists` + `create`, y un relleno que solo toca las filas sin código. No hay `delete`, ni `drop column`, ni reescritura de datos de negocio. **Ninguna función privilegiada existente se toca** |
| **Una prueba nueva falla si alguien renombra el campo** | [`pruebas/codigo-visible.prueba.ts`](../pruebas/codigo-visible.prueba.ts) · 9 comprobaciones. Cubre el nombre (`codigo_visible` en la fila, en la proyección y en el dominio), el valor (se conserva `null`: no se fabrica con el `id` ni con el `slug`), y **el contrato con el SQL**: que la lista del `grant select` cubra exactamente las columnas que pide la aplicación, y que el `grant update` no incluya el código |

## 5. Cómo comprobarlo, paso a paso

1. **Antes de aplicar**: copia de seguridad del proyecto (o, como mínimo, anotar que hay
   un anuncio y que su código será `NID-0001`). El relleno no borra nada, pero el hábito
   es el hábito.
2. **Aplicar** el contenido del archivo en el editor SQL.
3. **Ejecutar la sección 7** y mirar, en este orden:
   - `E.2` → `sin_codigo` = 0, y `codigos_distintos` = `total`.
   - `E.3` → el anuncio más antiguo (`residencia-makia`) con `NID-0001`.
   - `E.5` → `f | f | f | t`.
   - **`E.6` → `t | t`.** Si esto no sale `t`, **no se fusiona ni se despliega nada**: el
     catálogo se caería con `42501`.
4. **Comprobar el catálogo, con la clave anónima**, que es la consulta que de verdad
   importa (la de `aplicar-migraciones-pendientes.md` §3.4) más el campo nuevo:
   ```bash
   curl -s "${CAB[@]}" "$U/pensiones?select=id,slug,codigo_visible,anfitrion_id,titulo,descripcion,precio_mensual,direccion,barrio,distancia_a_pie_minutos,servicios,normas,calificacion,verificado,verificado_en,imagenes,activa,creada_en,latitud,longitud&activa=eq.true"
   ```
   → esperado: `200`, con `"codigo_visible":"NID-0001"` dentro.
5. **Solo entonces** se fusiona y se despliega la implementación del panel (#88).

## 6. Lo que esta oleada NO decide

- **Si el código se muestra en la ficha pública.** La lectura ya está concedida a `anon`,
  así que el día que se decida mostrarlo el cambio es de interfaz y de proyección, sin
  migración nueva. Lo fija la especificación de la ficha #86.
- **El buscador del panel maestro.** Es la ficha #88 (bloqueada por esta y por #86): el dato
  y su contrato llegan hasta aquí; la pantalla que busca por código es de esa ficha.
- **`whatsapp` y `autorizacion_contacto_en`** siguen fuera de la lista de lectura, como en
  `oleada-13`.

## 7. Comprobaciones ejecutadas en esta rama (y su origen)

Medido sobre `nido-wt-87`, rama `codigo-visible-pension-87` (base `main @ a621c20`):

| Comprobación | Resultado | Origen del número |
|---|---|---|
| `npm run tipos` (`tsc --noEmit`) | sin errores | — |
| `npm run probar` | **510 pruebas, 510 pasan, 0 fallan** | todo el conjunto (`pruebas/*.prueba.ts`) |
| `pruebas/codigo-visible.prueba.ts` sola | **9 pruebas, 9 pasan** | mi archivo |
| Base sin mi archivo | 501 pruebas | 510 − 9 |
| `npm run verificar:secretos` | `OK` · sin credenciales versionadas | 261 archivos versionados |
| `npm run verificar:lint` | **SALTADO**, no superado | faltan `eslint` y su configuración en el proyecto: no analizó nada |
| `npm run build` | ver §8 | — |

## 8. Pendiente de medir aquí

- **`npm run build`** en esta rama (evidencia de que la compilación no se rompe).
- La aplicación real de la migración: **no se puede hacer desde esta cuenta**
  (`site_owner_denied`, ver `aplicar-migraciones-pendientes.md` §5). La aplica Juan, y E.6
  es la prueba de que entró.
