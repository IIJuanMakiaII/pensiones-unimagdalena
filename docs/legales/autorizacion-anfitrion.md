# Autorización del anfitrión para publicar su número de WhatsApp

> **BORRADOR — NO PUBLICAR TODAVÍA.** Pendiente de revisión jurídica.
> Este documento es la fuente que debe copiarse al sitio (tarea #30). El texto de la
> casilla está redactado para ir **tal cual** en la interfaz.

---

## 1. Por qué existe este documento

El número de WhatsApp de un anfitrión **es un dato personal suyo**, y en este sitio
queda **a la vista de cualquiera** que abra la ficha — y también de cualquiera que
consulte la base de datos del sitio sin tener cuenta.

Una autorización que nadie pidió no es una autorización. Por eso:

- se pide **de forma expresa y separada** de las demás casillas del formulario;
- **no viene premarcada** (una casilla que ya está marcada no es una manifestación
  de voluntad);
- **no se puede publicar sin ella**, ni desde el formulario ni enviando la petición
  por otra vía;
- **queda registrada** con fecha, para poder demostrarla después.

## 2. Texto de la casilla (copiar tal cual al formulario)

Debe ir junto al campo donde se escribe el número, no al final del formulario
perdida entre otras casillas.

---

**Autorizo que mi número de WhatsApp quede publicado en este anuncio**

Entiendo que ese número **quedará visible para cualquier persona** que abra la
página de mi pensión, y que también podrá verlo quien consulte los datos del sitio
directamente, aunque no tenga cuenta.

Entiendo que el contacto se hará por WhatsApp, **fuera de la plataforma**, y que la
plataforma no lee, no guarda ni controla esas conversaciones.

Entiendo que **puedo retirar esta autorización cuando quiera**, retirando el anuncio
o pidiendo que se cambie mi número, y que desde ese momento dejará de ser público.

Puedo leer el [aviso de privacidad](../legales/aviso-de-privacidad.md) antes de
decidir.

---

### Texto corto para el registro (si el formulario solo admite una línea)

> Autorizo publicar mi número de WhatsApp; entiendo que será visible para
> cualquiera y que puedo retirarlo cuando quiera.

## 3. Cómo debe capturarse (requisitos para la tarea #30)

1. **Casilla sin premarcar**, obligatoria para publicar. No es opcional ni implícita.
2. **Registro con fecha.** Debe guardarse que se autorizó **y cuándo**. Una
   autorización sin fecha ni prueba no sirve para demostrar nada.
3. **Barrera en la base, no solo en el formulario.** Un envío directo a la API se
   salta el formulario: la base debe rechazar un anuncio con número publicado sin
   autorización, igual que ya rechaza un número que no tenga diez dígitos.
4. **Aviso al anfitrión cuando el número ya estaba puesto** de antes. Las
   publicaciones que existen hoy se hicieron **sin** esta autorización. No se puede
   inventar un consentimiento retroactivo: a esos anfitriones hay que pedírselo
   **de nuevo**, desde el editor, antes de dar la autorización por buena.
5. **Retirarla es tan fácil como darla.** Si el anfitrión quita el número, deja de
   publicarse en el momento.
6. **No mezclar con otras autorizaciones.** No puede ir en la misma casilla que los
   términos y condiciones: son dos cosas distintas y deben poder aceptarse por
   separado.

## 4. Lo que el sitio debe decir junto al campo del número

Hoy el campo dice «Tu WhatsApp para esta pensión» y muestra cuántos dígitos llevas.
**Falta decir la parte importante**: que ese número se va a publicar.

Propuesta de texto de ayuda, sustituyendo el actual:

> Este número aparecerá **en tu anuncio, a la vista de cualquiera**. Es a donde
> escribirán los estudiantes.

## 5. Lo que NO debe hacer el sitio

- **No publicar el número del anfitrión como si fuera el teléfono del negocio** en
  datos estructurados ni en metadatos. Ya se decidió así en las tareas #19 y #22 y
  sigue vigente: es el número de una persona, no del inmueble.
- **No usar este número para fines distintos**, ni cederlo ni venderlo. El aviso de
  privacidad lo afirma; el aviso y la práctica tienen que coincidir.
- **No contactar al anfitrión por ese número para asuntos ajenos** al servicio.

## 6. Pendiente de definir con el abogado

- Si la autorización debe recogerse con **más detalle** del aquí propuesto (por
  ejemplo, finalidades específicas asociadas a la autorización).
- Si conviene además un **documento aparte firmado** para anfitriones que publican
  como actividad económica.
- Cómo tratar los anuncios que existen hoy sin autorización previa: la vía correcta
  es pedirla de nuevo, pero el plazo y la comunicación deben definirse.
