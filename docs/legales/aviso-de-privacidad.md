# Aviso de privacidad y tratamiento de datos personales

> **BORRADOR — NO PUBLICAR TODAVÍA.**
> Este documento es un borrador fundamentado en lo que la plataforma realmente guarda
> (verificado contra el esquema y las políticas de la base de datos) y en el modelo de
> cobro definido por el fundador el **2026-10-04**. Debe ser revisado por un abogado
> antes de publicarse. Ver [preguntas-para-el-abogado.md](preguntas-para-el-abogado.md).
>
> **Datos del responsable: definidos.** El operador, su número de identificación, el
> domicilio y el correo de contacto se declaran en la sección 1.
>
> **Qué cambió en esta versión:** la plataforma **ya no publica el número de WhatsApp
> del anfitrión** y pasa a **gestionar la reserva del primer mes**, con cobro en línea
> del Depósito de Reserva. Eso añade categorías de datos nuevas, que se declaran abajo
> distinguiendo lo que **ya se guarda hoy** de lo que **se guardará cuando se active el
> cobro**.

---

## 1. Quién responde por tus datos

**Juan Sebastián Otero Cerchar**, persona natural que actúa bajo la denominación
comercial **«Nido»**, identificado con **C.C. 1004364753**, con domicilio en **Santa
Marta / Ciénaga, Magdalena (Colombia)** y correo para asuntos de datos personales
**oterojuan15@gmail.com**, es el responsable del tratamiento de los datos que se recogen
en este sitio.

El sitio es un servicio de la Universidad del Magdalena y su área de influencia en
Santa Marta, Magdalena (Colombia).

## 2. Qué datos guardamos

### 2.1 Lo que ya se guarda hoy

Esta no es una lista genérica: es exactamente lo que el sitio guarda hoy.

| Dato | De quién | Cuándo se pide | Dónde queda |
|---|---|---|---|
| Correo electrónico | Quien crea cuenta | Al registrarse | Base de datos, tabla `usuarios` |
| Contraseña | Quien crea cuenta | Al registrarse | Cifrada por el proveedor de identidad. **Nadie del equipo puede leerla** |
| Nombre o razón comercial | Quien crea cuenta | Al registrarse | Base de datos, tabla `usuarios` |
| Título del anuncio | Propietario | Al publicar | Base de datos, tabla `pensiones` |
| Dirección y barrio | Propietario | Al publicar | Base de datos, tabla `pensiones` |
| Minutos a pie de la universidad | Propietario | Al publicar | Base de datos, tabla `pensiones` |
| Descripción, servicios y normas | Propietario | Al publicar | Base de datos, tabla `pensiones` |
| Fotos del inmueble | Propietario | Al publicar | Almacenamiento de archivos |
| Habitaciones: tipo, género, precio, si dan comida, si están libres | Propietario | Al publicar | Base de datos, tabla `habitaciones` |
| Fecha de creación de la cuenta | Quien crea cuenta | Al registrarse | Base de datos |

**El número de WhatsApp del anfitrión ya no se pide ni se guarda para publicarse.** El
campo existe todavía en la tabla por razones históricas, pero **no se solicita, no se
muestra y no viaja a la página**. **[PENDIENTE: eliminar los valores que quedaran
guardados y retirar el campo — ver [preguntas-para-el-abogado.md](preguntas-para-el-abogado.md).]**

### 2.2 Lo que se añade con la reserva y el pago

Estas categorías **todavía no se recogen**, porque el cobro en línea no está
construido. Se declaran aquí para que el aviso esté completo el día que se active:

| Dato | De quién | Para qué | Dónde queda |
|---|---|---|---|
| Nombre y datos de contacto del estudiante | Quien reserva | Identificar la reserva y poder atenderla | Base de datos |
| Habitación reservada, fechas y valores | Quien reserva | Sostener la reserva y el reparto del dinero | Base de datos |
| Resultado del pago: referencia, monto, estado y fecha | Quien reserva | Acreditar el pago y resolver reclamaciones | Base de datos y pasarela de pagos |
| **Datos de tarjeta o cuenta de pago** | Quien reserva | Procesar el cobro | **Solo en la pasarela de pagos.** Ver 2.3 |
| Datos de cobro del propietario (a dónde se le gira el anticipo) | Propietario | Entregarle el anticipo que se cobró en su nombre | Los recibe la plataforma del propietario por canal privado |

**[PENDIENTE: la lista exacta de campos del estudiante se cierra cuando se construya la
pantalla de pago, y el proveedor de pagos cuando se contrate —a la fecha **no hay
ninguno contratado**. Mientras no esté cerrada, este aviso no se publica.]**

### 2.3 Lo que NO guardamos

- **No guardamos datos de tarjeta ni credenciales de pago.** Los procesará la **pasarela
  de pagos** —un tercero con sus propias condiciones, todavía sin contratar—; la
  plataforma recibe el
  resultado de la operación (si se pagó, cuánto y con qué referencia), no el número de
  la tarjeta.
- No pedimos **documento de identidad**, ni fecha de nacimiento, ni datos bancarios del
  estudiante, ni su dirección particular.
- **Ya no se guarda ningún teléfono del propietario para publicarlo.**

## 3. Qué es visible sin haber iniciado sesión

- **Toda la ficha del anuncio activo es pública**: título, descripción, dirección,
  barrio, servicios, normas, fotos y las habitaciones con sus precios.
- **El número de WhatsApp del propietario NO es público y ya no se publica.** No
  aparece en la ficha, ni en los datos que viajan a la página, ni en los datos
  estructurados para buscadores. El contacto lo atiende la plataforma.
- **Los correos electrónicos y los nombres de las cuentas NO son públicos.** Cada
  persona solo puede ver su propio perfil.
- **Las fotos quedan en un espacio de lectura pública.** Cualquiera que tenga el enlace
  puede verlas, aunque el enlace sea difícil de adivinar.
- **Los datos de cobro del propietario y los del pago no son públicos en ningún caso**,
  ni siquiera para el estudiante que reserva.

## 4. Para qué usamos los datos

- **Para publicar el anuncio y que un estudiante pueda encontrarlo.**
- **Para gestionar la reserva del primer mes**: atender el contacto, cerrar la reserva
  y sostener el compromiso entre el estudiante y el propietario.
- **Para cobrar el Depósito de Reserva** —la tarifa de servicio y el anticipo— y para
  **entregar el anticipo al propietario**.
- **Para administrar las cuentas:** entrar, confirmar el correo y recuperar la
  contraseña.
- **Para moderar:** revisar publicaciones y retirar las que incumplan las condiciones
  de uso.
- **Para atender reclamaciones y devoluciones**, incluidas las derivadas de una
  cancelación.
- **Para saber cómo se usa el sitio y mejorarlo** (ver la sección 5).

**No usamos los datos para nada más.** En particular: **no vendemos ni cedemos datos
personales a terceros** y **no enviamos publicidad de terceros**.

## 5. Medición de uso

El sitio mide su uso con una herramienta que **no usa cookies** y que **no identifica a
personas**: registra de forma agregada cuántas veces se aplican filtros, cuántas veces
se abre una ficha y cuántas veces se pulsa el botón de contacto.

No se guarda ahí ningún dato personal — ni correo, ni nombre, ni número de teléfono, ni
nada del pago — y por eso **el sitio no muestra el aviso de cookies** que sí necesitarían
otras herramientas de medición.

**[PENDIENTE: confirmar con el proveedor las condiciones del plan contratado y
conservar esta afirmación solo mientras siga siendo cierta.]**

## 6. Cuánto tiempo los conservamos

**[PENDIENTE: definir el plazo.]** Los datos del anuncio se conservan mientras el
anuncio siga publicado. Cuando un propietario retira su anuncio, se propone conservarlo
**sin publicar** durante **[PENDIENTE]** por si quiere volver a activarlo, y borrarlo
definitivamente después.

Las cuentas se conservan mientras no se pida su eliminación. Los correos electrónicos no
se pueden reciclar mientras la cuenta exista.

**Los datos de una reserva y de su pago se conservan el tiempo que exija la ley
contable y tributaria**, aunque la reserva se cancele o la cuenta se elimine: son el
soporte de un movimiento de dinero. **[PENDIENTE: fijar el plazo con el abogado.]**

## 7. Tus derechos

La Constitución y la Ley 1581 de 2012 amparan estos derechos sobre tus datos:

- **Conocer** qué datos tenemos sobre ti.
- **Actualizarlos y rectificarlos** si están equivocados o incompletos.
- **Suprimirlos** cuando no exista un deber legal de conservarlos.
- **Revocar la autorización** que nos diste.
- **Solicitar prueba de la autorización.**
- **Presentar quejas** ante la Superintendencia de Industria y Comercio.

**Cómo ejercerlos: [PENDIENTE: canal de contacto y plazo de respuesta.]** Se propone un
correo dedicado a estos asuntos y un plazo de respuesta de quince (15) días hábiles,
ampliable en los términos de la ley. **[PENDIENTE: confirmar con el abogado.]**

### Si eres propietario y quieres dejar de recibir cobros en tu nombre

Puedes **retirar el mandato** cuando quieras, retirando tu anuncio. Desde ese momento la
plataforma deja de cobrar en tu nombre, sin afectar a las reservas ya cerradas.
**[PENDIENTE: definir el canal formal por escrito para que quede constancia.]**

### Si retiraste tu número de WhatsApp

**Se te retiró solo.** Con el modelo nuevo el número no se publica, así que no tienes
que pedir nada. Si quieres además que se **borre** cualquier valor que hubiera quedado
guardado de antes, pídelo por el canal de la sección 7 y se elimina.

## 8. Menores de edad

El sitio está pensado para estudiantes universitarios y para propietarios de inmuebles.
**No está dirigido a menores de edad**, y no se pide ningún dato a sabiendas de que lo
sea. **[PENDIENTE: definir con el abogado qué hacer si se detecta una cuenta o una
reserva de un menor — y si una reserva con pago en línea exige comprobación de edad.]**

## 9. Seguridad

Las contraseñas se guardan cifradas y nadie del equipo puede leerlas. El acceso a la
base de datos está restringido por reglas por fila: cada propietario solo puede
modificar sus propias publicaciones, y no puede alterar el sello de verificación ni la
calificación ni el precio por su cuenta.

**Ninguna medida es infalible.** Si ocurriera un incidente que afecte tus datos, se
informará a las personas afectadas por los canales disponibles.

## 10. Cambios a este aviso

Si este aviso cambia, se publicará en esta misma página con la fecha de la última
actualización y se avisará a los propietarios por el correo registrado.

---

**Última actualización:** [PENDIENTE — no publicar sin fecha]
**Versión:** borrador 2 — incorpora el modelo de cobro del 2026-10-04, sin revisión
jurídica
