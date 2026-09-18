# Oleada 3 — Verificación QA (tarea #20)

> **Fecha:** 2026-09-18
> **Qué se verifica:** cabecera con entrada de cuenta (#17), edición de publicaciones
> ya subidas (#19) y WhatsApp propio de cada pensión (#22), sobre el trabajo de base
> de #18 y #21.
> **Veredicto:** ✅ **Apto.** 18/18 comprobaciones de escritura contra la base real,
> 23/23 del arnés de disponibilidad y la batería completa de no regresión en verde.
> Queda **una** tarea abierta (#23) y una limitación de esta verificación que se
> declara al final.

---

## 1. Cómo se verificó

El veredicto es sobre comportamiento observado, no sobre lo que reportaron los
autores. Dos hallazgos de este mismo informe explican por qué eso importa.

| Vía | Qué cubre |
|---|---|
| `supabase/pruebas/oleada-3-verificacion-qa.sql` (**nuevo**) | El camino de escritura del editor contra la base real, cambiando de rol y con las claims del JWT. Crea una publicación temporal, la usa y la borra en la misma ejecución. |
| `npm run build` | Que la cabecera no rompió el renderizado estático. |
| Batería del proyecto | Humo, SEO, estructura, contraste, estados y el arnés de disponibilidad. |
| Inspección del HTML del build | El WhatsApp real en la ficha servida y su ausencia en los datos estructurados. |

---

## 2. El requisito que no se podía romper: la cabecera no volvió dinámicas las páginas

Era el riesgo real de montar la sesión en el layout. Medido en la salida del build:

```
┌ ○ /                        2.79 kB   111 kB   ← estática, se mantiene
├ ● /pensiones/[id]          2.71 kB   111 kB   ← SSG, se mantiene
├ ƒ /publicar                3.17 kB   180 kB   ← dinámica (correcto: necesita sesión)
├ ƒ /publicar/[id]/editar    2.7 kB    180 kB   ← dinámica (correcto)
└ ƒ /login · /registro · /auth/signout         ← dinámicas (correcto)
```

La portada y las fichas —lo que leen los buscadores y lo que sostiene el rendimiento
móvil— **siguen estáticas**.

---

## 3. El camino de escritura del editor: 18/18 contra la base real

Lo que más importaba: que abrir la edición no reabriera el agujero que costó cerrar.

| Comprobación | Resultado |
|---|---|
| Publicación temporal creada | ✅ |
| **El dueño edita los 9 campos editables** (control positivo) | ✅ 1 fila |
| **Otro anfitrión NO puede editarla** | ✅ 0 filas |
| **Un anónimo NO puede** | ✅ denegado |
| Sigue prohibido `verificado` | ✅ `permission denied` |
| Sigue prohibido `calificacion` | ✅ `permission denied` |
| Sigue prohibido `precio_mensual` | ✅ `permission denied` |
| Sigue prohibido `anfitrion_id` (transferir la publicación) | ✅ `permission denied` |
| Añadir y ocupar habitaciones | ✅ libres=2, ocupadas=1 |
| **La habitación no tocada conserva su estado** | ✅ `disponible=true` |
| Quitar una habitación | ✅ quedan 2 |
| El precio se deriva de las habitaciones libres | ✅ `precio=500000` |
| Rechaza descripción de 2001 caracteres | ✅ restricción |
| Rechaza 9 fotos | ✅ restricción |
| Rechaza WhatsApp de 9 dígitos | ✅ restricción |
| Rechaza WhatsApp sin normalizar (`+57 310 …`) | ✅ restricción |
| Limpieza sin residuos | ✅ `residuos=0` |
| El dato real sigue intacto | ✅ `Makia: activa=true whatsapp=null habitaciones=1` |

**El control positivo es lo que da valor al resto:** sin él, un «0 filas» no
demostraría nada (un `UPDATE` que no coincide con ninguna fila devuelve 0 con RLS y
sin ella). Es la misma lección que dejó la auditoría de seguridad en #11.

---

## 4. WhatsApp por pensión: medido sobre el HTML servido

- La ficha real (**sin** número propio) construye sus enlaces con **`wa.me/573001234567`**:
  el respaldo a la plataforma funciona y aparece **un solo número**, sin mezclas.
- El `telephone` de los datos estructurados es **`+573001234567`**, el número de la
  plataforma —el del negocio, que es legítimo—, no el de un anfitrión. El caso con
  número propio lo midió su autor con una publicación temporal (7/7) y aquí se
  confirma la separación por el lado que sí es comprobable sin sesión.

---

## 5. No regresión

```
✓ npx tsc --noEmit                    sin errores
✓ npm run build                       ✓ Compiled successfully · 11 páginas
✓ prueba-humo            «Todas las rutas responden correctamente»
✓ verificar-seo          «Todas las verificaciones pasaron (con catálogo)»
✓ verificar-estructura   «Estructura correcta en todas las rutas»
✓ verificar-contraste    «16/16 cumplen WCAG AA»
✓ verificar-estados      404 / 200 / 200 / 404, los esperados
✓ verificar-disponibilidad  23/23
```

---

## 6. Dos defectos de prueba que encontré y corregí (y por qué se cuentan)

**1. Mi tabla temporal no era escribible por los roles que la usaban.**
`supabase/pruebas/oleada-3-verificacion-qa.sql` cambia de rol a `authenticated` y
`anon` para probar la autorización, pero la tabla temporal la crea el rol de
administración: los `INSERT` del propio registro fallaban y el bloque se revertía.
Resultado: la primera pasada reportó «ERROR GENERAL» sin probar nada. Corregido con
un `grant` explícito a los dos roles.

**2. `servicios` e `imagenes` son `text[]`, no `jsonb`.**
Mi `UPDATE` de prueba usaba `jsonb_build_array`, así que el control positivo fallaba
por un error de tipos y —más peligroso— la comprobación de «rechaza 9 fotos»
**pasaba por el motivo equivocado**. Un falso positivo por accidente es peor que un
fallo, porque se habría reportado como verificado. Corregido a `array[...]`.

**3. Una aserción del arnés de disponibilidad era válida solo mientras el catálogo
estuviera casi vacío.** Comprobaba «ninguna tarjeta ofrece reservar» sobre la **página
entera**. En cuanto «Residencia Makia» tuvo una habitación libre —la que se le cargó
para poder ver el ciclo completo—, su CTA de reserva, legítimo, hizo fallar la
comprobación. Acotada a la tarjeta de la publicación de prueba (`<article>`), vuelve
a 23/23. Una aserción global sobre el catálogo no es una invariante.

---

## 7. Lo que esta verificación NO cubre

**El recorrido con una sesión real de navegador** (entrar, pulsar «Editar anuncio»,
guardar y ver el cambio en el catálogo) no se ejecutó desde aquí: no hay credenciales
de la cuenta. Lo que sí está medido es todo lo que ocurre por debajo —la escritura, la
autorización, los límites y el HTML servido— y la ruta sin sesión (307 a `/login`).

Por eso queda como comprobación de un minuto para el usuario: entrar al panel, pulsar
**Editar anuncio**, cambiar la descripción y guardar. Si algo no cuadra, el mensaje
exacto de la pantalla es lo que hace falta para corregirlo.

---

## 8. Tareas abiertas

| # | Tarea | Estado |
|---|---|---|
| **#23** | El enlace «Saltar al contenido» apunta a `#resultados`, que no existe en 7 de las 11 páginas | Asignada al Ingeniero |
