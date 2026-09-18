# Dosier de negocio para investigación de mercado y análisis financiero

> **Preparado:** 2026-09-18 · **Para:** investigador de mercado y experto financiero
> **Fuente:** el propio sistema en producción (código, base de datos y auditorías del
> repositorio privado `IIJuanMakiaII/pensiones-unimagdalena`).

## Cómo leer este documento

Cada afirmación está marcada según su origen, y la distinción no es decorativa:

| Marca | Significado |
|---|---|
| **[VERIFICADO]** | Medido en el sistema en la fecha del documento (base de datos, compilación o pruebas ejecutadas). Se puede reproducir. |
| **[PLANTEADO]** | Decisión o hipótesis del fundador, aún no validada con datos. |
| **[PENDIENTE]** | Dato que no existe todavía y que hay que obtener. **No hay estimaciones inventadas**: donde falta un número, se dice que falta. |

**La regla de este documento:** un cero medido vale más que una estimación
optimista. Varios ceros de este dosier son, de hecho, el punto de partida real.

---

## 1. El negocio en una página

**Qué es.** Un catálogo web de habitaciones en alquiler para estudiantes de la
Universidad del Magdalena (Santa Marta, Colombia), orientado a que un estudiante
encuentre habitación y hable directamente con el dueño.

**El problema que ataca.** La búsqueda de habitación para estudiantes en Santa Marta
ocurre hoy en grupos de Facebook y en avisos sin estructura, donde el estudiante no
puede filtrar por lo que de verdad decide su elección: **a quién le alquilan** (solo
mujeres, solo hombres, mixto), **si incluye alimentación** y **a cuántos minutos a
pie del campus**. Esas tres variables son el corazón del producto.

**La propuesta de valor, en la voz del producto:**

- Para el **estudiante**: filtrar por género, alimentación y distancia real al campus,
  ver el precio exacto de la habitación que se puede reservar hoy, y contactar por
  WhatsApp en un toque. Sin registro para buscar.
- Para el **anfitrión**: publicar gratis, marcar habitaciones como ocupadas o libres
  cuando cambien, y recibir estudiantes ya filtrados en su propio WhatsApp.

**Estado actual (resumen brutal):** producto funcional, **1 anuncio real**,
**0 estudiantes**, **0 transacciones** y **ningún ingreso**. Todo el análisis
financiero parte de ahí.

---

## 2. Cómo funciona el producto hoy **[VERIFICADO]**

- **Stack:** Next.js 14 (React) + Supabase (PostgreSQL con autenticación y
  almacenamiento). Desplegable en infraestructura serverless (Vercel/Netlify).
- **Sin registro para buscar.** El estudiante entra, filtra y ve fichas sin crear
  cuenta. Solo el anfitrión necesita cuenta.
- **El «reservar» es un mensaje de WhatsApp.** No hay pasarela de pagos, ni
  confirmación de reserva, ni depósito, ni contrato: el botón abre el chat del dueño
  con un mensaje que ya nombra **la habitación concreta y su precio**.
- **Cada anuncio contacta por su propio número** de WhatsApp (10 dígitos). Si un
  anuncio aún no lo tiene, el contacto va al número de la plataforma.
- **Habitaciones como unidad real del inventario.** Un anuncio tiene N habitaciones,
  cada una con tipo (individual / compartida / matrimonial), género (mixto / femenino
  / masculino), precio propio y si incluye alimentación. El precio «desde» que se
  muestra es el de la habitación **libre** más barata; el sistema no puede mostrar un
  precio de algo que no se puede reservar.
- **El anfitrión gestiona su disponibilidad** (marcar ocupada/libre) y puede
  **retirar o republicar** su anuncio.
- **Puede editar** un anuncio ya publicado: nombre, descripción, fotos, ubicación,
  servicios, normas y habitaciones.
- **Sello de verificación** y «puntaje del equipo»: existen en el modelo de datos y
  **los otorga el equipo manualmente**. No hay reseñas de estudiantes.
- **Mobile-first**, con app instalable (PWA) y funcionamiento sin conexión.

---

## 3. Lo que **no** existe (y que un análisis financiero suele dar por hecho)

Esta sección es la más importante del dosier. Son las ausencias que cambian el
análisis, no los matices:

| No existe | Consecuencia directa |
|---|---|
| **Cobro de ningún tipo** — ni comisión, ni suscripción, ni destacados | El ingreso actual es **$0**. La monetización está por construir, no por optimizar. |
| **Pasarela de pagos** integrada | Cualquier cobro sería hoy **manual y fuera de la plataforma**. |
| **Registro de que una transacción ocurrió** | La reserva termina en WhatsApp: **la plataforma no sabe si el estudiante alquiló**, ni por cuánto, ni cuándo. Ver §5. |
| **Analítica de uso** | **No hay ningún dato de tráfico, filtros usados, contactos generados ni conversión.** Cualquier métrica histórica es cero o inexistente. |
| **Reseñas o calificaciones de estudiantes** | El «puntaje» es interno. No hay prueba social generada por usuarios. |
| **Contrato, depósito o garantía** | El estudiante y el dueño acuerdan por fuera; la plataforma no media ni respalda. |
| **Sistema de reportes o moderación a escala** | No hay forma de verificar que un anuncio es real más allá del sello manual. |
| **Varias ciudades** | Está construido para Santa Marta y el campus de Unimagdalena: los filtros, los barrios y las distancias son locales. |

---

## 4. Cifras base verificadas

Los números desde los que se puede empezar a calcular, medidos hoy:

| Dato | Valor | Nota |
|---|---|---|
| Anuncios publicados | **1** | «Residencia Makia» |
| Habitaciones en el sistema | **1** | Individual, mixta, sin alimentación, disponible |
| Precio del anuncio existente | **$600.000 COP / mes** | Precio real publicado |
| Anfitriones registrados | **1** | El propio fundador |
| Estudiantes registrados | **0** | No se registran para buscar |
| Transacciones cerradas | **0** | No hay forma de medirlas hoy |
| Ingresos acumulados | **$0** | Sin mecanismo de cobro |
| Comisiones cobradas | **$0** | — |
| Ciudades / campus | **1** | Santa Marta, Unimagdalena |
| Tamaño del repositorio (código) | ~2,4 MB | Todo el catálogo actual ocupa kilobytes |

---

## 5. Modelo de negocio

### 5.1 Lo planteado por el fundador **[PLANTEADO]**

**Comisión del primer mes por cliente conseguido**, en el rango de **$50.000 a
$100.000 COP**, pagada por el dueño de la pensión cuando la plataforma le consigue el
arrendatario.

Es un modelo conocido en el sector: el anfitrión paga una sola vez, cuando recibe el
beneficio, y no una cuota recurrente. Para el anfitrión es fácil de aceptar porque lo
compara con el primer mes de arriendo que acaba de cobrar.

**Comparación con referencias del sector [VERIFICADO, fuentes en §8]:**

| Referencia | Cómo cobra | Equivalente en un arriendo de $600.000 |
|---|---|---|
| Airbnb (2026) | ~**15,5%** del subtotal por reserva | ~$93.000 por reserva |
| Booking | **14–16%** por reserva | ~$84.000–$96.000 |
| CompartoApto (Colombia) | **Publicar es gratis** | $0 |
| Grupos de Facebook (canal real hoy) | Gratis | $0 |
| **Este negocio (planteado)** | **$50.000–$100.000 una sola vez** | **8%–17% de un mes de arriendo** |

La comisión planteada **cae dentro del rango del mercado internacional** (un 15,5% de
Airbnb equivale a unos $93.000 en este caso) y se cobra **una sola vez, no por mes**,
lo que la hace más barata para el anfitrión que una plataforma global.

### 5.2 Segunda fase planteada: destacados y visibilidad **[PLANTEADO]**

Suscripción o pago por aparecer arriba / por sello de visibilidad, **explícitamente
pospuesto hasta tener volumen**. Es la vía natural de ingreso recurrente, pero hoy no
hay tráfico que vender: **cobra sentido cuando haya más anuncios que posiciones
visibles.**

### 5.3 El problema estructural del modelo, y es de primer orden

**El cierre ocurre fuera de la plataforma.** El botón abre WhatsApp; el arriendo se
acuerda y se paga entre las dos partes, sin que la plataforma intervenga. Las
consecuencias, que el análisis financiero debe resolver antes de proyectar nada:

1. **La plataforma no sabe si cerró el trato.** Sin dato de cierre, no hay base
   facturable: no se puede cobrar por algo que no se puede observar.
2. **No hay palanca de cobro.** El anfitrión no tiene nada en juego si deja de pagar:
   su anuncio sigue visible.
3. **El riesgo del anfitrión es asimétrico:** si la plataforma le consigue el cliente,
   paga; si el estudiante llegó por otro canal, ¿paga igual? El modelo debe definirlo.

**Opciones que el experto financiero debería modelar** (ninguna está implementada):

| Opción | Cómo se cobraría | Ventaja | Riesgo |
|---|---|---|---|
| Comisión reportada | El anfitrión confirma el cierre y paga | Simple, sin desarrollo | Depende de la honestidad y de que recuerde pagar |
| Crédito previo | Paquetes de contactos o publicaciones pagados por adelantado | Cobro garantizado y por adelantado | Fricción alta: hay que pagar antes de ver resultado |
| Suscripción del anfitrión | Cuota mensual por anunciar | Ingreso recurrente y predecible | Solo funciona con demanda demostrada |
| Destacados | Pago por visibilidad | Escala sin fricción de entrada | Necesita mucho tráfico previo |
| Intermediación real | La plataforma gestiona reserva y cobro | Resuelve el problema de raíz | Es otro producto: pasarela, contratos, soporte |

### 5.4 El embudo, tal como está hoy

```
Estudiante entra → filtra → ve fichas → pulsa WhatsApp → (fuera de la plataforma)
                                                              ↓
                                              la plataforma deja de saber qué pasó
```

No hay instrumentación en ningún punto de ese recorrido. **Medir el embudo es
requisito previo a cobrar por él.**

---

## 6. Estructura de costos

### 6.1 Lo que se puede afirmar hoy **[VERIFICADO]**

- **Infraestructura:** base de datos y autenticación en Supabase, más un despliegue
  serverless. El volumen de datos actual —**1 anuncio, 1 habitación**— cabe en
  cualquier plan gratuito con márgenes enormes. El costo de infraestructura **no es
  el problema del negocio hoy**.
- **Sin costos variables:** no hay pasarela de pagos (no hay comisión por
  transacción), ni envío de correos masivos, ni servicios de terceros de pago
  integrados.
- **El costo real es el tiempo del fundador.** Todo el desarrollo es trabajo propio.

### 6.2 Lo que falta y solo el fundador puede aportar **[PENDIENTE]**

1. Facturas reales del dominio y del plan de Supabase (si es de pago).
2. **Horas dedicadas al proyecto** y el valor que se les asigna: es el costo más
   grande y el que decide el punto de equilibrio.
3. Costo de adquisición de anfitriones: ¿se visita, se llama, se pauta? La captación
   de oferta en un marketplace local es intensiva en trabajo humano.
4. Costo de adquisición de estudiantes: hoy es cero en dinero y todo en presencia
   física en el campus (volantes, grupos, voz a voz).

---

## 7. Mercado: datos externos verificados

| Dato | Valor | Fuente |
|---|---|---|
| Estudiantes de la Universidad del Magdalena | **28.227** (2026) | [unimagdalena.edu.co](https://www.unimagdalena.edu.co/) · [Wikipedia](https://es.wikipedia.org/wiki/Universidad_del_Magdalena) |
| Nuevos estudiantes de pregrado presencial, 2026-I | **más de 2.100** | [El Informador (19 ene 2026)](https://www.elinformador.com.co/index.php/el-magdalena/83-departamento/346413-unimagdalena-abre-el-2026-con-nuevas-carreras-y-mas-de-2-100-estudiantes) |
| Habitación amoblada en Santa Marta (avisos publicados) | desde **~$400.000 COP/mes** | [CompartoApto · Santa Marta](https://www.compartoapto.com/magdalena/en-arriendo-santa-marta) |
| Precio del anuncio real de esta plataforma | **$600.000 COP/mes** | Sistema propio |

**Lectura de los datos:** el mercado de estudiantes es grande y se renueva cada
semestre, pero el número que decide el negocio **no es el total de estudiantes** (la
mayoría no está buscando habitación en un semestre dado: vive con su familia, ya
tiene contrato o comparte). El dato que falta es la **rotación real**: cuántos
estudiantes buscan habitación cada semestre. Eso es lo primero que debe estimar el
investigador de mercado, y no lo puede deducir nadie más que él.

**Un dato cualitativo del propio producto:** el único anuncio real está a $600.000,
**por encima** del aviso más barato visto en la competencia (~$400.000). Con una sola
observación no se concluye nada, pero sí orienta la pregunta: ¿el producto debe
posicionarse en el segmento alto (más servicios, más cerca del campus) o en el
volumen?

---

## 8. Competencia y canales

| Competidor / canal | Modelo | Qué implica |
|---|---|---|
| **Grupos de Facebook** («Arriendo Habitaciones Santa Marta») | Gratis, informal | **Es el competidor real hoy.** Sin comisión, con volumen, sin estructura. Pide tiempo de moderación y confianza entre desconocidos. |
| **CompartoApto** | Publicar gratis, +15.000 avisos en Colombia, tiene sección de Santa Marta | Competidor directo nacional con inventario y sin cobro al anfitrión. |
| **MercadoLibre / FincaRaíz / Mitula / Rentola** | Publicación o comisión, orientados a inmuebles completos | No están especializados en habitación de estudiante ni en filtros como género o alimentación. |
| **Airbnb / Booking** | Comisión 14–16% por reserva | No compiten en arriendo mensual estudiantil, pero **fijan la referencia mental de comisión**. |

**La ventaja diferencial está en los filtros, no en el catálogo:** género del
compañero de cuarto, alimentación incluida y minutos a pie del campus son datos que
los canales informales no estructuran. Ese es el activo a defender.

---

## 9. Riesgos y restricciones reales **[VERIFICADO]**

Hallazgos de las auditorías internas del repositorio, ya corregidos o pendientes.
Se incluyen porque afectan al negocio, no solo a la técnica.

1. **Sin analítica ni `sitemap`:** la plataforma no puede medirse ni aparecer en
   buscadores con URLs limpias. Es la deuda más urgente para cualquier decisión con
   datos.
2. **Catálogo de demostración en producción:** hoy se sirve contenido de ejemplo bajo
   ciertas condiciones de configuración. **Para un lanzamiento comercial hay que
   apagarlo**, o un estudiante podría ver una habitación que no existe. Es la lección
   más caras del tipo de marketplace: un catálogo con inventario falso destruye la
   confianza en una sola visita.
3. **Identificadores de anuncio y URL:** el sistema mezcla dos formatos de
   identificador, lo que produce direcciones poco compartibles. Afecta al
   boca a boca, que es el canal principal de este mercado.
4. **Datos personales de terceros:** la plataforma almacena el **número de WhatsApp
   del anfitrión** y la dirección del inmueble. Ese número queda visible para
   visitantes anónimos. **Hay que revisar qué obligaciones aplican** en Colombia al
   tratar datos de contacto de personas naturales (la Ley 1581 de 2012 y la
   autorización del titular son el punto de partida a consultar con un abogado).
5. **Verificación manual:** el sello de confianza lo asigna el equipo a mano. No
   escala y su valor depende de que el criterio se sostenga.
6. **Dependencia de un solo canal de contacto externo** (WhatsApp) para todo el
   cierre de la operación.

---

## 10. Preguntas para el investigador de mercado

Concretas, y en el orden en que bloquean decisiones:

1. **Tamaño y rotación:** ¿cuántos estudiantes de Unimagdalena buscan habitación en
   cada semestre? Desglose por estrato, beca y municipio de origen (quien viene de
   fuera busca habitación; quien es de Santa Marta, mucho menos).
2. **Qué usan hoy:** ¿por dónde buscan realmente? Cuántos de los que buscan pasan por
   grupos de Facebook, y cuántos terminan alquilando por recomendación personal.
3. **Cómo eligen:** ¿cuánto pesa el género del compañero de cuarto, la alimentación
   incluida y los minutos a pie del campus, frente al precio? Es la hipótesis central
   del producto y **nadie la ha validado todavía**.
4. **Precios del mercado:** rango real por tipo de habitación y barrio (Mamatoco,
   Centro, Rodadero, alrededores del campus), con servicios incluidos.
5. **Oferta:** cuántas pensiones hay alrededor del campus, cuántas habitaciones
   libres por semestre y **qué disposición tienen a pagar por conseguir inquilino**
   (el dato que decide si la comisión de $50.000–$100.000 es aceptable).
6. **Estacionalidad:** en qué meses se concentra la búsqueda (¿el pico es el
   semestre 2026-II?).
7. **Confianza:** ¿qué objeción frena a un estudiante y a un padre antes de escribir
   a un desconocido por WhatsApp, y qué necesitaría ver para sentirse seguro?

---

## 11. Preguntas para el experto financiero

1. **Con $50.000–$100.000 por cliente cerrado, ¿cuántos cierres mensuales hacen el
   negocio sostenible?** El cálculo necesita el costo/hora del fundador, que es la
   variable que falta (§6.2).
2. **Cómo cobrar sin poder observar el cierre.** §5.3. Es el problema central: sin
   resolverlo, el modelo no es ejecutable con fiabilidad.
3. **Comparación de las cinco opciones de cobro de §5.3**, con esfuerzo de desarrollo
   y fricción para el anfitrión.
4. **Qué conviene más:** comisión única del primer mes o cuota recurrente. Con una
   rotación semestral, el mismo estudiante no vuelve a generar comisión; el modelo
   debe contemplar el reemplazo de inquilinos.
5. **Orden de ataque:** ¿priorizar más anuncios o más estudiantes? En un marketplace
   local, cuál de los dos lados es más caro de conseguir y cuál desbloquea al otro.
6. **Cuánto invertir en el canal de captación** antes de tener métricas, y qué
   métricas mínimas exige para seguir invirtiendo.

---

## 12. Anexo: dónde está todo

- **Repositorio privado:** `github.com/IIJuanMakiaII/pensiones-unimagdalena`. Incluye
  el código, las migraciones de base de datos y los arneses de verificación.
- **Informes internos de auditoría** (`docs/auditorias/`): seguridad, SEO y
  experiencia de conversión, con cada hallazgo priorizado y su estado.
- **Estado por oleadas** (`docs/oleada-*-implementada.md`): qué se entregó y qué
  evidencia lo respalda.
- **Documentación de producto** (`docs/`): arquitectura, modelo de datos y
  contrato de integración con la base.

> **Nota final sobre rigor.** Las secciones marcadas **[VERIFICADO]** se midieron en
> el sistema el 2026-09-18 y se pueden reproducir. Las marcadas **[PLANTEADO]** son
> hipótesis del fundador que todavía **no** tienen datos detrás. Las **[PENDIENTE]**
> no existen y **no se han estimado a propósito**: un dosier que rellena sus huecos
> con cifras inventadas hace que un análisis financiero parezca completo cuando no lo
> está.
