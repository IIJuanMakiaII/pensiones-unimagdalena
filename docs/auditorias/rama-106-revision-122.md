# Rama 106 · Segundo veredicto: H-1 corregido, antes de fusionar a `main`

**Fecha:** 21 de octubre de 2026
**Objeto:** `reserva-panel-maestro-106` en `8f89380` (local = `origin`), con el arreglo `c1e1a17` sobre `2543309`. La referencia de comportamiento anterior es `8fdf160` (`origin/main`).
**Método:** solo lectura, más ejecución de las compuertas del proyecto en local. No se escribió SQL, no se tocó la base, no se fusionó, no se desplegó.
**Antecedente:** `docs/auditorias/rama-106-revision-previa.md` (veredicto **FAIL** sobre `2543309`).

---

## Veredicto: **PASS**

La rama puede ir a `main`. Los cinco criterios que pidió Juan están cumplidos y **medidos por ejecución propia**, no leídos de un informe.

Lo que cambió respecto del veredicto anterior no es el criterio: es el código. La #120 dio FAIL porque `PanelPublicacion` había **perdido una acción** que existía en `8fdf160` —una habitación apagada por mantenimiento ya no se podía volver a ofrecer, y encima se la llamaba «reservada»—. `c1e1a17` la devuelve, y de una forma mejor que la anterior: tres estados explícitos en lugar de un ternario sobre `disponible`.

---

## 1. Los cinco criterios de la petición de Juan

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | Veredicto explícito | **PASS** | este documento |
| 2 | «Marcar libre» vuelve a existir para una habitación apagada sin reserva, y ningún texto afirma reserva cuando no la hay | **cumple** | §2 |
| 3 | Liberar una reserva propia pasa por `liberar_habitacion_reservada`, no por escribir `disponible` | **cumple** | §3 |
| 4 | No se añadió ningún permiso, política, columna ni migración | **cumple** | §4 |
| 5 | El resto del comportamiento y los permisos de los demás no cambian | **cumple** | §5 |

---

## 2. Los tres estados: la acción que faltaba ha vuelto

`lib/reserva.ts` gana una función pura, y `PanelPublicacion` decide con ella:

```
lib/reserva.ts            export type EstadoDeLaHabitacion = "libre" | "reservada" | "apagada";
lib/reserva.ts            if (disponible) return "libre";  return reservadaEn ? "reservada" : "apagada";
PanelPublicacion.tsx:173  const situacion = estadoDeLaHabitacion(habitacion.disponible, reservadaEn);
```

El resultado por estado, leído del código:

| Estado | Insignia | Acción | Qué escribe |
|---|---|---|---|
| libre | «Libre» `:192` | «Retirar de la oferta» `:185` | `disponible="0"` por la columna `:244` |
| **apagada** | «No se ofrece» `:191` | **«Volver a ofrecer»** `:184` | **`disponible="1"` por la columna `:244`** |
| reservada | «Reservada» `:189` | «Liberar reserva» `:182` | `action={accionLiberar}` `:228`, **sin campo `disponible`** |

**El criterio 2, verificado por los dos lados.** La acción existe:

```
PanelPublicacion.tsx:244   <input type="hidden" name="disponible" value={situacion === "apagada" ? "1" : "0"} />
PanelPublicacion.tsx:249   ? `Volver a ofrecer la habitación ${descripcion}`
```

Y ningún texto afirma una reserva que no existe. La frase que la #119 dejó —«Esta habitación está reservada. Las reservas las gestiona la coordinación de Nido»— **ya no está en el archivo**; en su lugar, el caso apagado dice lo contrario y con la razón correcta:

```
PanelPublicacion.tsx:217   No se muestra en el catálogo: no hay ninguna reserva, la retiraste tú.
```

La única mención de «Reservada el …» está condicionada a que haya fecha real (`:212`, `situacion === "reservada" && fecha`), y «Reservada» solo se pinta en la rama `situacion === "reservada"`.

**Un cerco contra la recaída, que no había antes:** la prop dejó de ser opcional.

```
PanelPublicacion.tsx:39    reservas: ReservasPorHabitacion;   // obligatoria, sin `?` ni default
```

Un sitio nuevo que monte el panel **no compila** si no pasa el mapa. El fallo de la #119 fue exactamente ese —`app/publicar/page.tsx` no pasaba nada y nadie se enteró— y ahora el compilador lo impide. La página que lo monta lo alimenta:

```
app/publicar/page.tsx:69    const { reservas } = await leerReservas();
app/publicar/page.tsx:136   reservas={reservasDeLaPension(…
```

---

## 3. Liberar la reserva propia: por la función, nunca por la columna

`liberarReservaDeMiHabitacion` (`app/actions/pensiones.ts:447`) es la acción nueva. Su orden, que es lo que importa:

```
:468   crearClienteServidor()            identidad de la sesión, no del formulario
:473   if (!user)                        sin sesión, no se sigue
:477   if (!user.email_confirmed_at)     mismo criterio que las demás escrituras del panel
:490   .from("pensiones").eq("anfitrion_id", user.id)   las publicaciones propias
:510   .from("habitaciones").select("id, pension_id")   columnas nombradas, nunca `select("*")`
:529   if (!esHabitacionDeMisPensiones(...))  ← la propiedad se comprueba ANTES de llamar
:537   supabase.rpc("liberar_habitacion_reservada", { p_habitacion_id })
```

Y el barrido de escrituras sobre `habitaciones` en los siete archivos del arreglo: la única de `disponible` es

```
app/actions/pensiones.ts:372-373   .from("habitaciones") / .update({ disponible })
```

que es la del camino **encender/apagar**, no la de liberar. La rama reservada no manda `disponible` en absoluto — hay una prueba que lo comprueba aislando el trozo de JSX:

```
pruebas/reserva-anfitrion-122.prueba.ts:319   !rama.includes('name="disponible"'), "liberar no escribe la columna"
```

**Un detalle que apruebo expresamente:** el mensaje de error de `42501` de este camino **no** habla de rol maestro (`pensiones.ts:580-581`), con el razonamiento escrito de que aquí quien llama es el dueño, no el maestro. Heredar el traductor del panel maestro le habría dicho al anfitrión que «la base no reconoce esta sesión como maestra», que es falso y sugiere que el permiso es cuestión de rol cuando es cuestión de propiedad.

Y `data !== true` no se cuenta como éxito (`:553-558`): si la función devuelve `false` —no había reserva— se dice eso, y se le indica que el botón que corresponde es «Volver a ofrecer». No se finge haber liberado nada.

---

## 4. Cero permisos, cero políticas, cero migración

```
git diff --name-only 8fdf160..HEAD | grep '^supabase/'   → vacío
git diff --name-only 8fdf160..HEAD | wc -l               → 20
```

**Ninguno de los 20 archivos de la rama está bajo `supabase/`.** Los 7 del arreglo son: `PanelPublicacion.tsx`, `app/publicar/page.tsx`, `app/actions/pensiones.ts`, `lib/reserva.ts`, `lib/pension-escritura.ts`, `pruebas/reserva-panel-119.prueba.ts`, `pruebas/reserva-anfitrion-122.prueba.ts`. Coincide exactamente con lo declarado en la ficha, y `8f89380` solo añade este tipo de documento (`git diff --name-only c1e1a17..8f89380` → `docs/auditorias/rama-106-revision-previa.md`).

No hay `grant`, no hay `revoke`, no hay `create policy`, no hay `alter table`. La capacidad que Juan pedía **ya existía en la base** —el predicado de `liberar_habitacion_reservada` es `es_maestro() or v_anfitrion = v_usuario`— y lo que faltaba era la pantalla. Eso es lo que esta rama arregla.

---

## 5. Los permisos y el comportamiento de los demás

**La propiedad se comprueba en dos capas, y las dos están.** En encender/apagar: identidad de sesión (`:315-321`), correo confirmado (`:326`), y escritura filtrada por `.in("pension_id", misPensionesIds)` (`:375`) **más** la comprobación de fila devuelta (`:393`), que nunca responde `ok` si no se modificó nada. En liberar: lo mismo, más la comprobación explícita antes de llamar a la función (`:529`).

Un `id` inventado y una habitación ajena reciben **el mismo mensaje** (`:533`), para no revelar si existe algo que no es de quien pregunta.

**Lo que no cambia, y comprobé que no cambia:**

```
tsc --noEmit                      exit 0, sin salida
npm run probar                    617 tests · 145 suites · 617 pass · 0 fail
npm run build                     ✓ Compiled successfully · 24/24 páginas · 87.8 kB shared
                                  /publicar 5.77 kB / 182 kB
npm run verificar:secretos        275 archivos · 7 patrones · OK
```

Las tres cifras del Ingeniero (`617/617`, `24/24`, `87.8 kB`) coinciden con mi ejecución. El editor de habitaciones sigue igual y con su prueba intacta (`:340-347`, `disabled={Boolean(habitacion.id && reservadas[habitacion.id])}`): una habitación **reservada** no se puede marcar «Disponible ahora», y una **apagada sin reserva** sí se puede volver a encender. Que es exactamente la distinción correcta.

**Producción no se movió** (la rama no está desplegada; sirve `main`):

```
/                              200 · 70.733 bytes · 42501=0 · 42703=0
/pensiones/residencia-makia    200 · 83.308 bytes · 42501=0 · 42703=0
/publicar                      307  (redirección a sesión: correcto sin sesión)
```

**Corrección a mi informe anterior:** yo medía `70.599 / 83.172` y lo dejé apuntado como discrepancia con el Arquitecto (`70.733 / 83.308`). Hoy mido exactamente sus cifras. **La diferencia era el momento de lectura (ISR), no el contenido**, y el riesgo residual nº 3 de la #120 queda cerrado a favor de él.

---

## Hallazgos

Ninguno bloquea. El primero es deuda preexistente que esta rama **no** introduce, y lo digo así a propósito: una puerta a `main` no debe cerrarse por defectos que `main` ya tiene.

### N-1 · **medio** · El panel del maestro sigue con dos estados (`PanelMaestro.tsx:220`)

```
PanelMaestro.tsx:220   const reservada = !habitacion.disponible;
PanelMaestro.tsx:243   {habitacion.disponible ? "Libre" : "Reservada"}
PanelMaestro.tsx:260   etiqueta={reservada ? "Liberar" : "Marcar reservada"}
```

Es el **mismo razonamiento que la #122 acaba de retirar del panel del anfitrión**, vivo en la otra pantalla: `disponible = false` significa dos cosas desde la oleada 17. Consecuencias sobre una habitación apagada por el anfitrión y sin reserva: el maestro la ve rotulada «Reservada» en color de peligro, sin fecha (porque no la hay), y el botón que se le ofrece es «Liberar». Si lo pulsa, la función devuelve `false` y el panel lo dice bien —«Esa habitación no tenía una reserva registrada… cámbiala en «Editar anuncio»» (`app/actions/maestro.ts:269-273`)—, así que **falla cerrado y tiene camino**. Pero el rótulo es falso y el maestro no puede marcarla como reservada desde ahí.

**Por qué no bloquea:** no es una regresión. En `8fdf160` el panel del maestro ya decía `{habitacion.disponible ? "Libre" : "Reservada"}` (línea 167) y ya alternaba «Marcar libre» / «Marcar reservada» con `siguienteDisponible` (línea 181). La rama **mejora** esa pantalla: le pasa `reservadaEn` y le añade la fecha persistida. Lo que no hizo fue llevarle la función pura que ella misma creó.

**Arreglo propuesto (no implementado):** `const situacion = estadoDeLaHabitacion(habitacion.disponible, reservadaEn);` y decidir con tres ramas, igual que `PanelPublicacion`. `reservadaEn` **ya está en la firma de la fila** (`:204`, `:208`), así que es una línea y el mismo ternario. **Responsable:** Ingeniero; cabe en esta rama o en una ficha aparte, a criterio del Líder.

### N-2 · **bajo** · El mensaje de éxito al liberar afirma un resultado que no siempre ocurre

```
app/actions/pensiones.ts:567   "Reserva liberada: la habitación vuelve a ofrecerse en el catálogo…"
```

La función restaura el valor **previo**, no `true`:

```
oleada-17-habitacion-reservada.sql:266   set disponible = coalesce(v_disponible_antes, false),
```

Si la habitación estaba **apagada** cuando se marcó como reservada, al liberar queda apagada y **no vuelve a ofrecerse**. La cadena es alcanzable por interfaz, no solo por API: el panel del maestro ofrece «Marcar reservada» sobre una habitación apagada (`PanelMaestro.tsx:220`, `reservada = !disponible` → `false` → «Marcar reservada»), y eso deja `disponible_antes_de_reservar = false`.

**Por qué es bajo:** no hay pérdida de datos ni de capacidad, el panel se revalida y muestra la verdad al instante, y el botón «Volver a ofrecer» está ahí mismo. Es un texto optimista, no un fallo de estado. El mismo texto existe en `app/actions/maestro.ts:284`.

**Arreglo propuesto:** «La marca de reserva quedó borrada. Mira cómo quedó la habitación en la lista.» — o condicionar la frase a que el panel sepa que estaba ofrecida. **Responsable:** Ingeniero.

### N-3 · **bajo** · Nombre de bloque de prueba que no describe a su contenido

```
pruebas/reserva-panel-119.prueba.ts:275   describe("el editor no ofrece la acción que la base rechazará", …)
pruebas/reserva-panel-119.prueba.ts:276     it("el panel del anfitrión ya no deduce el estado de la columna sola", …)
```

Un `describe` que dice «el editor» contiene una prueba del panel del anfitrión. Cosmético: no se pierde cobertura —la del editor sigue en el mismo bloque, `:280`— y la prueba del panel está en el sitio correcto conceptualmente. Se arregla renombrando.

### N-4 · **informativo** · Cifra de `verificar:secretos`

La ficha declara 273 archivos; mi ejecución analiza **275**. La diferencia son los dos archivos versionados después de su medición (la prueba nueva y este documento). El resultado es el mismo: `OK sin credenciales versionadas`. No es un hallazgo, es una cifra que caduca.

---

## Lo que no puedo afirmar y por tanto no firmo

1. **No hice el clic con una sesión real de anfitrión.** No hay credenciales y no las invento. Lo que verifiqué es el código, el orden de las comprobaciones y su prueba. Que la base acepte al dueño y rechace al ajeno con `42501` / `0 filas` es **medición del Líder**, no mía, y la ficha me pide no repetirla.
2. **No comprobé contra la base** que `liberar_habitacion_reservada` acepte al anfitrión dueño. Leí su predicado en el `.sql` (`:254`), que coincide con lo que el Líder midió; ejecutarlo no me corresponde.
3. **El estado «reservada» depende de que `listar_reservas()` responda.** Si la lectura falla, el mapa llega vacío, `estadoDeLaHabitacion` devuelve «apagada» y el panel ofrece «Volver a ofrecer» sobre una reservada. El `update` choca entonces con `23514`, que `mensajeDeErrorDeBase` traduce a «Esa habitación está reservada… la gestiona la coordinación». **Falla cerrado y con el mensaje correcto**, y no inventa una reserva a partir de una ausencia de dato —que es la decisión correcta—, pero la pantalla ofrece un botón que fallará mientras dure el fallo de lectura. No lo considero defecto porque la alternativa (deducir reserva de la columna) es justo lo que rompió la #119.
4. **`verificar:lint` no es una comprobación real** (no hay ESLint instalado) y `verificar:disponibilidad` no la ejecuté. Ninguna de las dos cuenta como verde en este documento.

---

## Estado

`origin/main` sigue en `8fdf160`, sin tocar. La rama no se fusionó ni se desplegó. Este informe vive en el árbol de trabajo sin confirmar en git, y **yo no hago commit**: lo tiene que empujar el Ingeniero o el Líder. Es el quinto entregable de la oleada en esa situación, y la única razón por la que ya no es un problema es que los anteriores terminaron publicándose.

Con este PASS, la #121 —compilar el árbol fusionado, fusionar, desplegar y verificar producción— puede arrancar. **La decisión de fusionar es de Juan**, no mía ni del Líder.
