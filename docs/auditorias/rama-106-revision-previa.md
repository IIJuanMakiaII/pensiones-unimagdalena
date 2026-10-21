# Rama 106 · Revisión previa de QA y Seguridad, antes de fusionar a `main`

**Fecha:** 21 de octubre de 2026
**Objeto:** rama `reserva-panel-maestro-106`, punta `254330957a7620aed595012d48e0a408c64d3298` (local = `origin`), sobre `origin/main` = `8fdf160`.
**Commits revisados:** `f473fd3` (marcar y liberar por las funciones) y `2543309` (fecha persistida y rechazo explicado).
**Método:** solo lectura. No se ejecutó nada contra la base, no se fusionó, no se desplegó, no se tocó `main`.

---

## Veredicto: **FAIL — no fusionar todavía**

En seguridad y en dinero la rama está limpia y eso no está en discusión: cero escrituras directas a `habitaciones`, cero lecturas de las tres columnas protegidas, `select("*")` eliminado, `lib/pension.ts` intacto byte a byte, `components/Filtros.tsx` fuera del diff y el plegado vivo en producción.

**Lo que la tumba es una regresión de comportamiento en el panel del anfitrión** (§H-1). El caso que la ficha pregunta expresamente —«si el caso **no reservado** se comporta como antes de la oleada 17»— tiene respuesta **no**: una habitación apagada por el anfitrión, sin ninguna reserva, **pierde la acción de volver a ofrecerse** que sí tenía en `8fdf160`, y a cambio recibe la frase «Esta habitación está reservada… escríbenos para liberarla», que afirma una reserva que no existe.

El defecto es acotado y el arreglo también: **una prop y un ternario de tres estados**. Con eso corregido, esta revisión pasa a PASS sin más cambios. Hoy no se materializa —2 habitaciones, las dos ofrecidas, 0 reservas— pero es exactamente la clase de cosa que esta puerta existe para detener: la rama no puede cambiar lo que el anfitrión podía hacer antes.

**Corrección a mi propio informe:** la primera versión de este documento decía «PASS con una condición» y calificaba H-1 como *medio* porque lo había leído como un texto falso. Al comparar la pantalla con su versión de `8fdf160` encontré que no es solo el texto: **había un botón y ya no está**. La severidad y el veredicto se corrigen aquí, antes de firmar.

---

## 1. Los tres caminos que darían `42501` — **los tres cerrados**

### 1.1 Escrituras nuevas a `habitaciones` — **ninguna directa**

De las 1.512 líneas añadidas, la **única** que contiene `.from("habitaciones")` es un `assert` de una prueba que verifica precisamente que el lector **no** consulta la tabla:

```
+ assert.ok(!LECTOR.includes('.from("habitaciones")'), "el lector no debe consultar `habitaciones`");
```

Cero `insert`, cero `update`, cero `delete`, cero `upsert` sobre `habitaciones` en todo el diff. Las escrituras van por las dos funciones:

```
app/actions/maestro.ts   supabase.rpc("marcar_habitacion_reservada", …)
app/actions/maestro.ts   supabase.rpc("liberar_habitacion_reservada", …)
```

Y el `update({ disponible })` que había antes en el panel **se retira**: no aparece ni una vez en las líneas añadidas.

### 1.2 Lecturas de las tres columnas protegidas — **ninguna como columna**

`reservada_en`, `reservada_por` y `disponible_antes_de_reservar` aparecen en el diff de tres maneras, y ninguna es una consulta:

1. **Comentarios** que explican por qué no se leen.
2. **Asserts** que vigilan que sigan fuera: `for (const columna of ["reservada_en", "reservada_por", "disponible_antes_de_reservar"])`.
3. **Lectura del campo de la respuesta de la RPC**, no de la tabla: `lib/reservas.ts`, `const fecha = typeof fila.reservada_en === "string" ? fila.reservada_en : ""`. El objeto `fila` sale de `data`, que es lo que devuelve `listar_reservas()`; no hay ningún `.select()` de por medio.

### 1.3 `select("*")` — **fuera del código activo**

No aparece en ninguna línea funcional añadida. Las dos menciones son mensajes de error dentro de pruebas, que describen el `42501` que produce:

```
+ `${ruta.join("/")}: \`select("*")\` sobre habitaciones responde 42501 desde la oleada 17`
```

---

## 2. La fecha se lee por la función de la #118 — **sí**

`lib/reservas.ts` es el único punto de lectura y llama a la RPC sin argumentos:

```
const { data, error } = await supabase.rpc("listar_reservas");
```

Se ejecuta **en el servidor** (`crearClienteServidor`), una vez, y reparte el mapa hacia abajo: `app/maestro/page.tsx` lo entrega a `PanelMaestro`, que pasa `reservadaEn={reservas[habitacion.id] ?? null}` a cada fila (`components/PanelMaestro.tsx:147`).

La degradación es limpia y **falla cerrado**: si la función no está (`PGRST202`), devuelve `motivo: "sin-funcion"` con el mapa vacío, no una fecha inventada. Si el error es otro, `motivo: "error"`. En ninguno de los dos casos se pinta una fecha que no venga de la base.

Y `app/actions/maestro.ts` no da por buena la operación sin fecha: si la RPC responde sin `timestamptz`, devuelve «La base no devolvió la fecha de la reserva, así que no podemos confirmar que se guardara». Es el comportamiento correcto.

---

## 3. Precio, comisión y anticipo — **sin cambios, con prueba dura**

`lib/pension.ts` **no está en el diff** de los 17 archivos. Y no hace falta fiarse de la lista: el blob es el mismo objeto en las dos puntas.

```
main = 8fdf160:lib/pension.ts → d7ce5931489aee78870006d29058fd0c61ba3f47
HEAD             :lib/pension.ts → d7ce5931489aee78870006d29058fd0c61ba3f47
```

Idénticos. El 20 % del depósito, el 10 % de la tarifa y el 80 % del saldo no pueden haber cambiado: viven en ese archivo y ese archivo es el mismo.

Los importes que aparecen en las líneas añadidas están todos dentro de `pruebas/reserva-habitacion.prueba.ts`, y son **aserciones de que no cambian**: `deposito: 96000, tarifaServicio: 48000, anticipo: 48000, saldoAlLlegar: 384000` sobre un canon de 480.000, y `assert.deepEqual(desgloseReserva(cara.precio_mensual_cop), desgloseReserva(900000))`. Que el desglose se calcule sobre la habitación **elegida** y no sobre `precioDesde` está comprobado en la propia prueba.

---

## 4. `components/Filtros.tsx` fuera del diff y el plegado vivo — **confirmado**

Los 17 archivos del diff son:

```
.gitignore · app/actions/maestro.ts · app/actions/pensiones.ts
app/maestro/[id]/editar/page.tsx · app/maestro/page.tsx
app/publicar/[id]/editar/page.tsx · components/EditorHabitaciones.tsx
components/FormularioEditarPension.tsx · components/PanelMaestro.tsx
components/PanelPublicacion.tsx · lib/formato.ts · lib/pension-escritura.ts
lib/reserva.ts (nuevo) · lib/reservas.ts (nuevo)
pruebas/panel-maestro.prueba.ts · pruebas/reserva-habitacion.prueba.ts (nuevo)
pruebas/reserva-panel-119.prueba.ts (nuevo)
```

`components/Filtros.tsx` **no está**. La rama no puede tocar el plegado.

Y en producción, medido ahora mismo, sigue en pie:

```
/                                   200 · 70.599 bytes · aria-expanded=2 · panel-filtros=3
                                                    · 42501=0 · 42703=0 · ocupad=0
/pensiones/residencia-makia          200 · 83.172 bytes · 42501=0 · 42703=0
```

El tamaño de la portada (70.599) es el mismo que medí en la verificación de producción del despliegue de las siete ramas: la oleada 17 no cambió el HTML. Las marcas del plegado siguen ahí.

---

## 5. El caso **no reservado** — **parcialmente igual, y aquí está el hallazgo**

Criterio de la ficha: *«si el caso no reservado se comporta como antes de la oleada 17»*. La respuesta se parte en dos.

**`disponible = true` (habitación ofrecida): idéntico.** Antes montaba un formulario con `<input name="habitacionId">`, `<input type="hidden" name="disponible" value="0">` y el botón con etiqueta «Marcar reservada», `ariaLabel` «Marcar como reservada la habitación …» y `tono="neutral"`. Después, exactamente lo mismo: mismos campos ocultos, misma etiqueta, mismo `ariaLabel`, mismo tono. La rama conserva la acción y no añade poder nuevo.

**`disponible = false`: ya no se comporta igual, y esto no es un matiz de texto.** Antes de la oleada 17, en `8fdf160`, el panel del anfitrión era un **interruptor de dos vías**:

```
8fdf160:components/PanelPublicacion.tsx:109   const siguienteDisponible = !habitacion.disponible;
8fdf160:components/PanelPublicacion.tsx:133   <form action={accion}>
8fdf160:components/PanelPublicacion.tsx:135     <input type="hidden" name="disponible" value={siguienteDisponible ? "1" : "0"} />
8fdf160:components/PanelPublicacion.tsx:137     etiqueta={siguienteDisponible ? "Marcar libre" : "Marcar reservada"}
8fdf160:components/PanelPublicacion.tsx:139-143 ariaLabel y tono, también por `siguienteDisponible`
```

Es decir: con la habitación apagada, el anfitrión veía **«Marcar libre»** y podía volver a ofrecerla con un clic, y ese `update` funcionaba. En `HEAD` esa rama del ternario ya no existe: hay una sola etiqueta y un solo campo oculto. El caso apagado **perdió la acción**. Ver §H-1.

---

## Hallazgos

### H-1 · **alto** · El panel del anfitrión confunde «reservada» con «apagada por el anfitrión», y con ello retira una acción

`components/PanelPublicacion.tsx` decide con `habitacion.disponible` y **no recibe el mapa de reservas**. La interfaz `Props` solo lleva `pension` (`:21-22`, `:34`), y la página que lo monta lo hace sin ninguna prop de reservas:

```
app/publicar/page.tsx:115   <PanelPublicacion key={pension.id} pension={pension} />
```

Como `disponible = false` significa dos cosas distintas desde la oleada 17 —**reservada** o **apagada por el anfitrión**—, el componente hace dos cosas mal en el caso «apagada sin reserva»:

| Línea | Qué dice o hace | El problema |
|---|---|---|
| `PanelPublicacion.tsx:130` | `{habitacion.disponible ? "Libre" : "Reservada"}` | Llama «Reservada» a una habitación que el anfitrión apagó por mantenimiento |
| `PanelPublicacion.tsx:158` | `{habitacion.disponible ? <form…> : <p…>}` | Le quita el formulario: **la acción «Marcar libre» de `8fdf160` desaparece** |
| `PanelPublicacion.tsx:170` | «Esta habitación está reservada. Las reservas las gestiona la coordinación de Nido: escríbenos para liberarla.» | Afirma una reserva que no existe y le manda pedir permiso para ejercer una decisión que era suya |

El propio comentario del código afirma lo contrario de lo que ocurre:

```
PanelPublicacion.tsx:155-156   El caso **no reservado** queda exactamente como estaba: mismo formulario,
                               mismos campos ocultos, mismo botón.
```

Cierto para `disponible = true`; **falso para `disponible = false`**, que también puede no estar reservado. El razonamiento de `:150-153` —«ofrecer un botón que la base va a rechazar siempre es peor que no ofrecerlo»— es correcto pero descansa en una premisa falsa: la base **no** rechaza siempre ese `update`; rechaza con `23514` solo cuando hay reserva. Sobre una habitación apagada por el anfitrión el `update` es legítimo y funcionaba.

**Mitigación que sí existe, y que hay que decir para no exagerar:** el anfitrión **no perdió la capacidad**, la perdió en esa pantalla. El editor la conserva y está bien hecho de punta a punta:

```
app/publicar/[id]/editar/page.tsx:109   const { reservas } = await leerReservas();
components/FormularioEditarPension.tsx:121  reservas?: Readonly<Record<string, string>>
components/FormularioEditarPension.tsx:410  reservadas={reservas}
components/EditorHabitaciones.tsx:214   disabled={Boolean(habitacion.id && reservadas[habitacion.id])}
```

`EditorHabitaciones` desactiva la casilla **solo si hay reserva registrada**, y su comentario (`:53-…`) lo razona igual que este informe: *«Sin esta prop el editor no puede distinguir “esta habitación está reservada” de “esta habitación simplemente no se ofrece”, y la segunda sí es una decisión legítima del anfitrión»*. **El diagnóstico era correcto y está aplicado en una pantalla; falta la otra.** Eso es lo que convierte esto en un arreglo pequeño y no en un rediseño.

**Por qué es alto y no medio:** no es un texto falso —eso sería cosmético—, es una capacidad retirada en la pantalla donde el anfitrión gestiona sus anuncios, más un texto que le manda a pedir ayuda por algo que él mismo decidió. Juan pidió expresamente «mantener intacto el comportamiento existente». La probabilidad hoy es baja (2 habitaciones ofrecidas, 0 reservas, 0 apagadas), pero el disparador es una acción que la propia aplicación ofrece y no requiere ninguna condición rara.

**Por qué no es un agujero de seguridad:** falla cerrado, y esto no cambia. La restricción `habitaciones_reservada_no_se_ofrece` sigue rechazando el `update` sobre una reservada (`23514`), y el anfitrión no gana ninguna capacidad que no tuviera. El daño es de producto y de confianza, no de datos.

**Arreglo propuesto (no implementado):** dos cambios, ninguno toca la base.
1. `PanelPublicacion` recibe `reservas` como ya hace `PanelMaestro` (`PanelMaestro.tsx:147`) y decide con **tres** estados: libre → «Marcar reservada»; reservada → el aviso actual, que ya es correcto; apagada sin reserva → «No disponible» y **el botón «Volver a ofrecer» con `disponible="1"`, restaurando `8fdf160`**.
2. `app/publicar/page.tsx:115` pasa el mapa, como ya hace `app/publicar/[id]/editar/page.tsx:109`.

**Responsable:** Ingeniero, en esta misma rama, antes de fusionar.

### H-2 · **bajo** · El recuento de archivos de la rama no coincide con el real

La ficha habla de 12 archivos y el informe del Ingeniero de 7; el diff completo contra `main` son **17**, con 1.512 inserciones y 76 borrados. No es un defecto del código —los 17 son coherentes con lo que la rama hace— pero un recuento equivocado en un informe de auditoría es un defecto del informe, y ya van dos veces en esta oleada (antes fueron los «cinco» sitios de la ruta que eran tres).

### H-3 · **bajo** · `.gitignore` gana dos patrones y un comentario que nombra credenciales

```
.acceso/
*.token
# `sbp_…` de Supabase, una clave de servicio, un volcado de `service_role`.
```

Cierra el hueco que señalé en la revisión de la oleada 17 (`.env*.local` no cubría un token suelto). **No es un secreto**: son nombres de patrón, sin valores. `*.token` no excluye ningún archivo legítimo del repositorio — comprobado, no hay ninguno con esa extensión.

---

## 6. Secretos y rutas absolutas — **limpio**

En las 1.512 líneas añadidas, cero coincidencias de `sbp_`, `eyJ`, `service_role`, `postgres://`, `Bearer`, `C:\Users` o `DELL`, salvo la línea de comentario de `.gitignore` ya descrita en §H-3, que nombra las categorías sin contener ninguna.

El árbol tiene **exactamente un archivo sin confirmar**, y es este informe:

```
git status --porcelain →  ?? docs/auditorias/rama-106-revision-previa.md
```

Ningún archivo de código queda fuera del commit. Pero conviene decirlo sin adornos: este documento vive hoy en un solo disco. Es el cuarto entregable de la oleada en esa situación —la migración, el procedimiento, el informe de la #113— y las tres veces anteriores se cerraron publicándolo. **Yo no hago commit**; lo tiene que empujar el Ingeniero o el Líder. Un veredicto que solo existe en un árbol de trabajo no es una puerta.

---

## Riesgo residual declarado

Lo que **no** puedo afirmar y por tanto no firmo:

1. **No abrí `/maestro` ni el panel del anfitrión con una sesión real.** No hay credenciales y no las invento. Todo lo anterior es lectura de código más medición de producción sin sesión. Que el clic funcione lo midió el Arquitecto en la #114 con la cuenta maestra y revirtiendo por excepción; que el texto se pinte bien, no lo ha visto nadie todavía.
2. **No ejecuté las 590 pruebas ni recompilé.** Son cifras del Ingeniero. Lo que sí verifiqué es que `lib/pension.ts` es byte a byte el de `main` y que el árbol está limpio, que es lo que hace creíble el resto.
3. **No reproduzco los bytes que reportó el Arquitecto** (70.733 / 83.308 / 37.332). Mido 70.599 y 83.172. El tamaño de la portada coincide con el que medí **antes** de la oleada 17, así que la diferencia apunta a ISR o al momento de la lectura, no a un cambio de contenido. Lo que sí reproduzco es lo que importa: 200 con 0 `42501` y 0 `42703`.
4. **La transición `PGRST202 → 42501` que reportó el Arquitecto para las RPC no se puede comprobar por HTTP.** El Líder ya lo corrigió: PostgREST no expone funciones que el rol no puede ejecutar, así que ese código no distingue «no existe» de «no puedes». El discriminador válido es `has_function_privilege` sobre `pg_proc`, y eso no lo medí yo.
5. **H-1 tiene una decisión de producto dentro, pero el veredicto no depende de ella.** Si Juan decidiera que el anfitrión **no** debe volver a ofrecer una habitación desde esta pantalla —solo desde el editor—, el bloqueo sería deliberado. Aun así, el texto seguiría siendo falso y habría que corregirlo, y el comentario `:155-156` seguiría afirmando algo que el código no hace. Lo que sostiene el FAIL no es la preferencia, es la **contradicción entre lo que el código documenta y lo que hace**, más una capacidad que existía en `8fdf160` y ya no.
6. **Este informe estaba mal en su primera versión y lo corregí antes de firmarlo.** Decía «PASS con una condición» y «H-1 medio». La causa: comparé `HEAD` contra sí mismo y contra la ficha, no contra la pantalla anterior. Fue `git show 8fdf160:components/PanelPublicacion.tsx` lo que reveló el botón desaparecido. Lo dejo escrito porque un auditor que corrige su propio veredicto hacia arriba tiene que decir por qué, y porque el error fue de método, no de lectura.
