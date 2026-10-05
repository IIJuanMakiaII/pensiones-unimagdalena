# Autorización y mandato de cobro del propietario

> **BORRADOR — NO PUBLICAR TODAVÍA.** Pendiente de revisión jurídica.
>
> **Este documento SUSTITUYE por completo al anterior.** La versión previa era una
> autorización para **publicar el número de WhatsApp del anfitrión**. Esa autorización
> **queda retirada y sin objeto**: con el modelo nuevo el número **no se pide, no se
> publica y no viaja a la página**. **Nada de aquel documento debe copiarse al sitio**
> ni pedirse de nuevo a los propietarios.

---

## 1. Por qué existe este documento

La plataforma **recauda dinero por cuenta del propietario**. Eso no se puede hacer sin
su autorización expresa: es un **mandato de cobro**.

Dentro de lo que paga el estudiante hay **dos cosas distintas**, y mezclarlas sería el
error más caro de este documento:

| Rubro | De quién es el dinero | Qué hace la plataforma |
|---|---|---|
| **Tarifa de Servicio** | **De la plataforma** — es su remuneración | Lo retiene |
| **Seña / Anticipo** | **Del propietario** | Lo cobra **en su nombre** y se lo entrega |

La plataforma **no puede** tratar la seña como dinero propio, ni usar la tarifa
retenida como excusa para retener la seña.

## 2. Lo que el propietario tiene que entender antes de firmar

**Cuánto recibe, con números.** Es la parte que un propietario descubre tarde si no se
le dice antes:

> De un canon pactado de **$1.000.000**, el estudiante paga en la web **$200.000** y
> **$800.000** al recibir las llaves. **El propietario recibe $900.000**: $100.000 de
> seña por la plataforma y $800.000 directamente del estudiante.

Es decir: **el propietario recibe el 90 % del primer mes.** La tarifa de servicio se
**recauda** del estudiante, pero el 10 % sale del primer mes del propietario.
**[PENDIENTE: confirmar la vía elegida — ver la comprobación de aritmética en
[condiciones-de-uso.md](condiciones-de-uso.md) §3.1.]**

**Y que el número ya no se publica.** El propietario debe saber que su teléfono **no
va a aparecer** en el anuncio, para que no lo espere ni lo reclame después.

## 3. Texto de la casilla (copiar tal cual al formulario)

Debe ir junto a los datos de cobro, no al final del formulario perdida entre otras
casillas.

---

**Autorizo a la plataforma a cobrar la seña en mi nombre y a entregármela**

Entiendo y acepto que:

- La plataforma publica mi habitación, **atiende el contacto** y **cierra con el
  estudiante la reserva del primer mes**. Es ella quien negocia con el estudiante, no
  yo por mi cuenta.
- De lo que paga el estudiante en la web, **la plataforma retiene su Tarifa de
  Servicio** y **me entrega a mí la seña**, que se descuenta del primer mes de
  arriendo. El saldo de ese primer mes me lo paga el estudiante directamente al
  entregar las llaves.
- **Conozco cuánto voy a recibir** por el primer mes: el 90 % del canon pactado, según
  el ejemplo de la sección 2 de este documento. No recibiré el canon completo.
- **Mi número de WhatsApp no se publica** en el anuncio. El contacto lo lleva la
  plataforma.
- **Mantengo la reserva que la plataforma cierre**: si la habitación se reserva, la
  dejo disponible para ese estudiante y al precio que publiqué.
- Si no pongo la habitación a disposición en las condiciones descritas, o cancelo la
  reserva, **el estudiante tiene derecho a la devolución del 100 %** y la plataforma
  puede retirarme del sistema.
- Puedo **retirar este mandato cuando quiera**, retirando mi anuncio. Desde ese momento
  la plataforma deja de cobrar en mi nombre, sin afectar a las reservas ya cerradas.

Puedo leer el [aviso de privacidad](../legales/aviso-de-privacidad.md) y las
[condiciones de uso](../legales/condiciones-de-uso.md) antes de decidir.

---

### Texto corto para el registro (si el formulario solo admite una línea)

> Autorizo a la plataforma a cobrar la seña en mi nombre y a entregármela, y entiendo
> que mi número no se publica.

## 4. Cómo debe capturarse (requisitos para el desarrollo)

1. **Casilla sin premarcar**, obligatoria para publicar. No es opcional ni implícita.
2. **Registro con fecha.** Debe guardarse que se autorizó **y cuándo**. Una
   autorización sin fecha ni prueba no sirve para demostrar nada.
3. **Barrera en la base, no solo en el formulario.** Un envío directo a la API se salta
   el formulario: la base debe rechazar un anuncio sin mandato registrado.
4. **Los anuncios que existen hoy no lo tienen.** Se publicaron bajo el modelo
   anterior. No se puede inventar un consentimiento retroactivo: hay que presentarles
   este documento **de nuevo** desde el editor antes de dar el mandato por bueno. **[Y
   hay que decirles, en ese mismo momento, que pasarán a recibir el 90 % del primer
   mes — es un cambio de condiciones, no un detalle.]**
5. **Retirarlo es tan fácil como darlo.** Si el propietario retira su anuncio, deja de
   cobrarse en su nombre.
6. **No mezclar con otras autorizaciones.** No puede ir en la misma casilla que los
   términos y condiciones: son dos cosas distintas y deben poder aceptarse por
   separado.

## 5. Lo que el sitio debe decir junto a este documento

Hoy no hay ninguna pantalla que explique el reparto del dinero. Cuando se construya el
pago, **antes del botón** y con el desglose a la vista:

| Concepto | Monto | Destino |
|---|---|---|
| Tarifa de Servicio de la Plataforma | $100.000 | Remuneración de la plataforma |
| Abono al primer mes (seña) | $100.000 | Va al propietario, asegura tu cupo |
| **Total hoy en la web** | **$200.000** | Procesado por la pasarela de pagos |
| **Saldo al llegar a la pensión** | **$800.000** | Directo al propietario, contra entrega de llaves |

**Qué NO puede decir esa pantalla:** que el propietario recibe el canon completo, ni
presentar el total como «el arriendo». El dinero que se paga hoy **no es el arriendo**:
es un depósito de reserva compuesto por dos rubros distintos.

## 6. Lo que NO debe hacer el sitio

- **No publicar el número del propietario** en datos estructurados ni en metadatos. Ya
  se decidió así antes y sigue vigente: es el número de una persona, no del inmueble.
- **No tratar la seña como dinero de la plataforma.** Va al propietario, aunque se
  recaude desde la misma cuenta.
- **No retener la seña** por una disputa sobre la tarifa de servicio: son rubros
  distintos y el propietario no tiene por qué asumir el riesgo del cobro de la tarifa.
- **No usar los datos de cobro del propietario para fines distintos** del giro de la
  seña.

## 7. Pendiente de definir con el abogado

- Si la figura correcta es la **«arras de confirmación»** o una seña simple, y con qué
  redacción exacta.
- Cómo se formaliza el **mandato de cobro**: si basta la aceptación electrónica o hace
  falta documento aparte firmado.
- Si la plataforma necesita **registro o habilitación** para recaudar dinero de
  terceros.
- El **mecanismo de giro** de la seña al propietario y los datos que hay que pedirle
  para eso (ver [preguntas-para-el-abogado.md](preguntas-para-el-abogado.md)).
- Cómo tratar los **anuncios que existen hoy** bajo el modelo anterior, y el plazo y la
  comunicación para presentarles el mandato nuevo.
