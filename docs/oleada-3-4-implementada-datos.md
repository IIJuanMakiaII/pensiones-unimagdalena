# Oleadas 3 y 4 — Edición de publicaciones y contacto propio del anfitrión

**Tareas:** #18 (habilitar la edición en la base) y #21 (número de WhatsApp por pensión) · **Autor:** Arquitecto Datos/Backend
**Fecha:** 18 de septiembre de 2026
**Artefactos:** [supabase/oleada-3.sql](../supabase/oleada-3.sql) · [supabase/pruebas/oleada-3.sql](../supabase/pruebas/oleada-3.sql) · [supabase/oleada-4.sql](../supabase/oleada-4.sql) · [supabase/pruebas/oleada-4.sql](../supabase/pruebas/oleada-4.sql)
**Migraciones aplicadas al proyecto real:** `oleada_3_edicion_publicacion` (`20260918043425`) y `oleada_4_whatsapp_pension` (`20260918043556`), registradas ambas en el historial del proyecto (`supabase_migrations.schema_migrations`).

Las dos tareas tocaban `supabase/`, así que se hicieron en orden y con **una migración por tarea**, aplicadas y verificadas por separado.

---

## 1. El problema (tarea #18)

Un anfitrión necesita corregir su anuncio: nombre, descripción, ubicación, fotos, servicios, normas y sus habitaciones. **Hoy no puede, y falla en la base, no en la interfaz.**

La Oleada 2 revocó el privilegio de tabla de `pensiones` y de `habitaciones` y volvió a conceder solo lo que el panel de disponibilidad necesitaba. El precio de esa corrección es que la concesión tiene que ser explícita: en PostgreSQL **revocar una columna no retira el privilegio de tabla**, así que no existe un punto medio entre «todo» y «una lista enumerada». Cualquier intento del editor de escribir `titulo` devolvía:

```
42501 permission denied for table pensiones
```

### Estado real medido antes de decidir (no supuesto)

| Tabla | SELECT | INSERT | UPDATE de tabla | DELETE | Columnas de UPDATE |
|---|---|---|---|---|---|
| `pensiones` | ✅ | ✅ | ❌ | ✅ | `activa` |
| `habitaciones` | ✅ | ✅ | ❌ | ✅ | `disponible` |

Ese dato cambió el trabajo: **`habitaciones` ya tenía INSERT y DELETE de tabla concedidos**, así que añadir y quitar habitaciones no requería ninguna concesión nueva — solo faltaba ampliar el conjunto de columnas actualizables. Las seis políticas RLS de escritura también se revisaron (`qual` y `with_check`) y **ya estaban correctas**: no se tocó ninguna.

---

## 2. Las decisiones, y por qué

### 2.1 Qué se concede, columna por columna

| Tabla | Columnas concedidas | Por qué esas |
|---|---|---|
| `pensiones` | `titulo`, `descripcion`, `direccion`, `barrio`, `distancia_a_pie_minutos`, `servicios`, `normas`, `imagenes`, `whatsapp`, `activa` | Es exactamente lo que el editor escribe. `activa` ya estaba (panel de disponibilidad) |
| `habitaciones` | `tipo`, `genero`, `precio_mensual_cop`, `alimentacion_incluida`, `disponible` | Editar una habitación. Añadir y quitar ya estaban cubiertos por INSERT y DELETE de tabla |

### 2.2 Qué sigue prohibido, y por qué

| Columna | Motivo |
|---|---|
| `verificado`, `calificacion` | Es lo que miran estudiantes y padres para decidir. Los otorga el equipo, no el anunciante (hallazgo **A-1**) |
| `precio_mensual` | Lo impone el disparador a partir de las habitaciones. Cederlo reabriría **A-2**: un `PATCH` podría anunciar un precio que no corresponde a ninguna habitación |
| `anfitrion_id`, `id`, `creada_en` | Identidad y trazabilidad. Conceder `anfitrion_id` permitiría **transferir la publicación** a otra cuenta |
| `latitud`, `longitud` | El editor definido no las pide. Concederlas sería privilegio de más: cuando exista el selector de mapa se añaden aquí, y la restricción de rango ya está en la base |
| `habitaciones.pension_id` | **No se concede, a propósito.** Es la forma más fuerte de que una habitación no pueda reasignarse a la publicación de otro: ni siquiera se puede intentar. La política ya tiene `with check` (segunda capa, intacta) |

### 2.3 Una sola lista coherente

`oleada-3.sql` concedió la lista de 9 columnas; `oleada-4.sql` **reemite la lista completa** (las mismas 9 más `whatsapp`). Así `oleada-4.sql` deja el estado correcto por sí sola y no quedan dos listas que puedan divergir.

---

## 3. El número de contacto (tarea #21)

### 3.1 Formato: exactamente 10 dígitos, **no** «empieza por 3»

```sql
check (whatsapp is null or whatsapp ~ '^[0-9]{10}$')
```

Descarté a propósito la restricción más «obvia» (`^3[0-9]{9}$`, móvil colombiano). En Colombia un **teléfono fijo del área de Santa Marta con su indicativo** (60X XXX XXXX) también tiene 10 dígitos, y sería un error rechazar el número real de un anfitrión que atiende por su línea fija. Lo que sí se rechaza es todo lo que no sean diez cifras: 9, 11, letras, espacios, guiones o el prefijo `+57`.

El código de país **no se guarda**: lo añade la aplicación al construir el enlace `wa.me`. Así el dato queda normalizado y no depende de cómo lo escriba cada anfitrión.

### 3.2 La columna es opcional, y tiene que serlo

Las publicaciones que ya existen no tienen número propio y no se les puede inventar uno: `NULL` significa «esta publicación todavía no tiene contacto directo» y la interfaz usa el número de la plataforma como respaldo hasta que el anfitrión ponga el suyo. **Ninguna fila existente se modifica** (verificado: 0 publicaciones con número tras aplicar).

### 3.3 Privacidad: hasta dónde llega esta migración

El número **no** va a los datos estructurados ni a los metadatos; eso se garantiza en el código (tareas #19 y #22), no en la base.

Lo que sí conviene decir sin adornos: **`whatsapp` queda legible por el rol `anon`**. No es un descuido — la ficha y el catálogo se sirven de forma anónima y con caché (ISR), así que necesitan leer el número para construir el enlace. Mientras el contacto sea directo, el número es visible para quien inspeccione la página; es inherente a la función que se pidió. Si en algún momento se decide exigir sesión para verlo, la vía sería exponerlo por una función `security definer` y retirar el privilegio de lectura de esa columna a `anon` — no se hace ahora porque cambiaría la funcionalidad pedida.

---

## 4. Verificación ejecutada contra la base real

### Tarea #18 — 17/17 en verde

```
 1. La creación por RPC sigue operativa                  ok  pensión creada
 2. Columnas de UPDATE concedidas (lista exacta)         ok  las 9 esperadas, ni una más
 3. Editar título, descripción, dirección, barrio,
    distancia, servicios, normas e imágenes              ok  filas=1
 4. Sigue denegado: verificado y calificación            ok  42501
 5. Sigue denegado: precio_mensual                       ok  42501
 6. Sigue denegado: anfitrion_id (transferir)            ok  42501
 7. Sigue denegado: coordenadas                          ok  42501
 8. Añadir una habitación a mi publicación               ok  habitación creada
 9. Editar tipo, género, precio y alimentación           ok  filas=1
10. El precio se sigue derivando al editar la habitación ok  precio=450000 (no el anterior)
11. Denegado: reasignar pension_id de una habitación     ok  42501
12. Otro anfitrión NO puede editar mi publicación        ok  filas=0 (RLS)
13. El panel sigue retirando/publicando (activa)         ok  filas=1  ← control positivo
14. El panel sigue marcando ocupada/libre (disponible)   ok  filas=1  ← control positivo
15. Quitar una habitación de mi publicación              ok  filas=1
16. anon sigue leyendo el catálogo                       ok  filas visibles ≥ 1
17. Limpieza sin residuos                                ok  residuos=0
```

La prueba 11 se ejecuta reasignando a la **misma** publicación a propósito: así el único motivo posible de rechazo es el privilegio de columna, y no la RLS ni la clave foránea. Si el intento más benigno ya se rechaza, reasignar a la publicación de otro queda descartado por completo.

### Tarea #21 — 17/17 en verde

```
 1. Columna whatsapp: existe, es TEXT y opcional          ok
 2. Restricción de formato de 10 dígitos                  ok  CHECK (whatsapp IS NULL OR whatsapp ~ '^[0-9]{10}$')
 3. Las publicaciones existentes quedan con NULL          ok  0 con número
 4. Fijar el número al publicar (INSERT)                  ok  publicación creada
 5. Cambiar el número desde el editor (UPDATE)            ok  filas=1
 6. El valor guardado es exactamente el que se envió      ok  3119876543
 7. Rechaza 9 dígitos                                     ok  23514
 8. Rechaza 11 dígitos                                    ok  23514
 9. Rechaza letras                                        ok  23514
10. Rechaza «+57 300 123 4567»                            ok  23514
11. Los intentos rechazados no alteraron el valor         ok  sigue 3119876543
12. Otro anfitrión NO puede escribir mi número            ok  filas=0 (RLS)
13. Lista de columnas editables: la esperada, +whatsapp    ok  10 columnas
14. Lo prohibido sigue prohibido (A-1 y A-2 intactos)     ok  sensibles=0 · UPDATE de tabla=f
15. anon lee el catálogo y la columna whatsapp sin error  ok  filas=1 · lectura sin error
16. La publicación retirada sigue oculta para anon         ok  filas=0
17. Limpieza sin residuos                                 ok  residuos=0 · con número=0
```

### Estado final de la base (consulta independiente)

```
columnas de UPDATE concedidas a authenticated:
  pensiones    → activa, barrio, descripcion, direccion, distancia_a_pie_minutos,
                 imagenes, normas, servicios, titulo, whatsapp
  habitaciones → alimentacion_incluida, disponible, genero, precio_mensual_cop, tipo

prohibiciones que siguen en pie:
  pensiones    → verificado=f calificacion=f precio_mensual=f anfitrion_id=f latitud=f · UPDATE de tabla=f
  habitaciones → pension_id=f · INSERT=t · DELETE=t

whatsapp: nullable=YES · CHECK (whatsapp IS NULL OR whatsapp ~ '^[0-9]{10}$')

datos reales intactos:
  «Residencia Makia» → activa=t verificado=f calificacion=0.0 precio=600000
                       whatsapp=NULL · 1 habitación (1 libre)

residuos de pruebas: 0
migraciones aplicadas: 7 (esquema_inicial · endurecimiento_rls · storage_fotos ·
                          oleada_1_habitaciones · oleada_2_cerrar_escritura ·
                          oleada_3_edicion_publicacion · oleada_4_whatsapp_pension)
```

---

## 5. Un defecto que encontré en mi propia prueba (y cómo se detecta)

La primera ejecución dio **16/17**: falló «La publicación retirada sigue oculta para anon». No era un fallo del producto: era **mi prueba la que no probaba nada**. Cambiaba el rol a `anon` pero dejaba puestas las claims JWT del anfitrión, así que `auth.uid()` seguía devolviendo al dueño y la política de lectura pública ni se evaluaba.

Es la misma trampa que invalida una matriz de autorización, en la dirección contraria a la del caso habitual: no basta con cambiar el rol, también hay que quitar la identidad. Corregido: en las pruebas de lectura anónima se limpian `request.jwt.claims` y `request.jwt.claim.sub`. Con eso, la prueba 15 (anon lee) y la 16 (la publicación retirada no existe para anon) miden lo que dicen medir.

---

## 6. Lo que queda del lado de la aplicación

Esta migración deja la base lista; el trabajo de interfaz es de las tareas #19 y #22:

| Punto | Estado |
|---|---|
| El editor escribe los campos de la publicación y las habitaciones | Habilitado por privilegio en la base |
| El editor traduce los errores `42501` y `23514` a mensajes útiles | Pendiente (aplicación) |
| Normalizar el número antes de enviarlo (quitar `+57`, espacios y guiones) | Pendiente (aplicación). **La base lo rechaza** si llega sin normalizar |
| El número en la tarjeta, la ficha y la barra fija del móvil | Tarea #22 |
| Que el número **no** entre en el JSON-LD ni en los metadatos | Tarea #22 |
| La RPC de creación `crear_pension_con_habitaciones` **no acepta `whatsapp`** | Detalle de traspaso: fijarlo al publicar exigiría añadir una clave al JSONB. Con el `UPDATE` ya concedido basta con que el editor lo guarde al editar, así que no se tocó la RPC para no interferir con el trabajo en curso sobre `app/actions/pensiones.ts` |
