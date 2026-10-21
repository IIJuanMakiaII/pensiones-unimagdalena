# Aviso de privacidad y tratamiento de datos personales

> **En una frase.** Este aviso explica qué datos guarda Nido, para qué los usa, quién
> puede verlos y cómo pedir que se corrijan o se borren.

---

## 1. Quién responde por tus datos

**Juan Sebastián Otero Cerchar**, persona natural que actúa bajo la denominación
comercial **«Nido»**, identificado con **C.C. 1004364753**, con domicilio en **Santa
Marta - Magdalena - Colombia** y correo para asuntos de datos personales
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
| **Número de WhatsApp del propietario** | Propietario | Al publicar un anuncio | Base de datos, tabla `contacto_anfitrion`. **Privada**: solo la leen el propio propietario y el equipo de Nido; no es pública en ninguna página |
| Nombre, dato de contacto y mensaje del formulario de respaldo | Quien consulta | Al enviar el formulario de respaldo, cuando WhatsApp no está disponible | Base de datos, tabla `contactos_respaldo`. **Privada**: sin acceso público |
| Constancia de aceptación de los textos legales, con su fecha | Quien crea cuenta | Al registrarse | Metadatos de la cuenta. No se publica |
| Fecha de creación de la cuenta | Quien crea cuenta | Al registrarse | Base de datos |

**El número de WhatsApp del anfitrión no se publica, pero sí se pide.** Se solicita en
el formulario al publicar el anuncio, porque es la vía por la que el equipo de Nido
escribe al propietario para coordinar visitas y reservas. Se guarda en una tabla aparte
(`contacto_anfitrion`) con reglas por fila de **dos lectores**: el propio propietario y el
equipo de Nido. **No se muestra en el anuncio, no viaja a la página y no es legible sin
sesión.**

La columna heredada de versiones anteriores sigue existiendo en la tabla de anuncios, pero
está sin uso y cerrada a la lectura pública. Si hubiera quedado algún valor guardado de
entonces, se elimina a petición por el canal de la sección 7.

### 2.2 Lo que se añade con la reserva y el pago

Estas categorías **todavía no se recogen**, porque el cobro en línea no está
construido y la reserva se coordina hoy por WhatsApp, fuera de la plataforma. Se declaran
aquí para que el aviso esté completo el día que se active:

| Dato | De quién | Para qué | Dónde queda |
|---|---|---|---|
| Nombre y datos de contacto del estudiante | Quien reserva | Identificar la reserva y poder atenderla | Base de datos |
| Habitación reservada, fechas y valores | Quien reserva | Sostener la reserva y el reparto del dinero | Base de datos |
| Resultado del pago: referencia, monto, estado y fecha | Quien reserva | Acreditar el pago y resolver reclamaciones | Base de datos y pasarela de pagos |
| **Datos de tarjeta o cuenta de pago** | Quien reserva | Procesar el cobro | **Solo en la pasarela de pagos.** Ver 2.3 |
| Datos de cobro del propietario (a dónde se le gira el anticipo) | Propietario | Entregarle el anticipo que se cobró en su nombre | Los recibe la plataforma del propietario por canal privado |

La lista exacta de campos del estudiante se cerrará al habilitar la pantalla de pago, y
con ella el proveedor de pagos. **Hoy no hay ninguno contratado y ninguna de estas
categorías se recoge todavía**; cuando se activen, esta sección se actualizará antes de
empezar a usarlas.

**El estado de una habitación no es un dato personal.** Que una habitación figure libre,
ocupada o reservada —y la fecha en que se marca— describe el anuncio, no a una persona: no
dice quién reservó, ni cuánto pagó, ni cómo contactarle. Marcar una habitación como
reservada **no crea un registro de la reserva**: esa constancia sigue viviendo fuera de la
plataforma mientras el cobro en línea no exista.

### 2.3 Lo que NO guardamos

- **No guardamos datos de tarjeta ni credenciales de pago.** Los procesará la **pasarela
  de pagos** —un tercero con sus propias condiciones, todavía sin contratar—; la
  plataforma recibe el
  resultado de la operación (si se pagó, cuánto y con qué referencia), no el número de
  la tarjeta.
- No pedimos **documento de identidad**, ni fecha de nacimiento, ni datos bancarios del
  estudiante, ni su dirección particular.
- **No se guarda ningún teléfono del propietario para publicarlo.** El que se registra al
  publicar queda en la tabla privada de la sección 2.1 y solo lo ven el propio propietario
  y el equipo de Nido.

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

Esta afirmación se mantiene solo mientras siga siendo cierta. Si la medición cambiara a
una herramienta que use cookies o que identifique personas, esta sección se actualizaría
y se pediría el consentimiento correspondiente **antes** de activarla.

## 6. Cuánto tiempo los conservamos

Los datos del anuncio se conservan **mientras el anuncio siga publicado**. Cuando el
propietario lo retira, se deja de publicar de inmediato y se conserva **sin publicar**
solo el tiempo necesario para atender reclamaciones y por si quiere volver a activarlo;
después se elimina.

Las cuentas se conservan mientras no se pida su eliminación. Los correos electrónicos no
se pueden reciclar mientras la cuenta exista.

**Los datos de una reserva y de su pago se conservan el tiempo que exija la ley contable
y tributaria**, aunque la reserva se cancele o la cuenta se elimine: son el soporte de un
movimiento de dinero. Agotado ese plazo, se eliminan.

## 7. Tus derechos

La Constitución y la Ley 1581 de 2012 amparan estos derechos sobre tus datos:

- **Conocer** qué datos tenemos sobre ti.
- **Actualizarlos y rectificarlos** si están equivocados o incompletos.
- **Suprimirlos** cuando no exista un deber legal de conservarlos.
- **Revocar la autorización** que nos diste.
- **Solicitar prueba de la autorización.**
- **Presentar quejas** ante la Superintendencia de Industria y Comercio.

**Cómo ejercerlos:** escribiendo a **oterojuan15@gmail.com**, indicando qué dato quieres
conocer, corregir o suprimir y quién eres. Respondemos en un plazo máximo de **quince
(15) días hábiles**, ampliable en los términos de la ley.

### Si eres propietario y quieres dejar de recibir cobros en tu nombre

Puedes **retirar el mandato** cuando quieras, retirando tu anuncio. Desde ese momento la
plataforma deja de cobrar en tu nombre, sin afectar a las reservas ya cerradas. Para que
quede constancia por escrito, basta con pedirlo a **oterojuan15@gmail.com** desde el
correo registrado de tu cuenta.

### Sobre el número de WhatsApp que registraste

**No se publica.** Ya no aparece en tu anuncio ni en ninguna página pública, así que no
tienes que pedir nada para eso. El número que registres al publicar vive en la tabla
privada de la sección 2.1, lo leen solo tú y el equipo de Nido, y puedes pedir que se
**borre** —o que se corrija— por el canal de la sección 7.

## 8. Menores de edad

El sitio está pensado para estudiantes universitarios y para propietarios de inmuebles.
**No está dirigido a menores de edad**, y no se pide ningún dato a sabiendas de que lo
sea. Si se detecta una cuenta o una reserva de un menor de edad, **se suspende y se
eliminan los datos asociados**, y quien ejerza su representación puede pedirlo por el
canal de la sección 7.

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

**Última actualización:** 21 de octubre de 2026.
**Versión:** 1.1 — la 1.0 incluía los datos del responsable del tratamiento y el modelo de
reserva del primer mes. La 1.1 corrige la sección 2.1: el número de WhatsApp del
propietario **sí se pide** al publicar y se guarda en la tabla privada `contacto_anfitrion`;
añade el formulario de respaldo y la constancia de aceptación de los textos legales a la
lista de lo que se guarda; y precisa que el estado de una habitación no es un dato personal
ni un registro de la reserva.
