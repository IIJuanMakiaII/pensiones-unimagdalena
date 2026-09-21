# Correo propio y recuperación de contraseña (tarea #25)

Dos cosas en este documento:

- **Lo que ya funciona en el código** (recuperar contraseña, enlace caducado, contraseña nueva).
- **Lo que solo puedes hacer tú**: activar un servicio de correo propio, porque el que Supabase
  trae por defecto está pensado para pruebas y **se corta por cupo** — y cuando se corta, un
  anfitrión no termina de registrarse y no hay forma de avisarle.

---

## 1. Lo que ya está hecho en la aplicación

| Pantalla | Ruta | Qué hace |
|---|---|---|
| Pedir enlace | `/recuperar` | El anfitrión escribe su correo y recibe un enlace para crear una contraseña nueva |
| Canje del enlace | `/auth/confirmar` | Convierte el código del correo en una sesión válida y lo lleva a `/restablecer` |
| Contraseña nueva | `/restablecer` | Fija la contraseña (mínimo 8 caracteres, doble escritura) |

El enlace **«¿Olvidaste tu contraseña?»** aparece ya en la pantalla de acceso.

Tres detalles que se resolvieron a propósito:

- **Enlace caducado o ya usado:** en lugar de un error técnico, la pantalla lo explica y ofrece
  pedir otro. Es el caso más frecuente (los enlaces caducan y solo sirven una vez).
- **Si el enlace es válido pero se abre sin sesión** (por ejemplo en otro navegador), `/restablecer`
  lo dice y redirige a pedir uno nuevo, en vez de mostrar un formulario que fallaría al enviarlo.
- **El mensaje al pedir el enlace es neutro** («si ese correo tiene cuenta…»), para no revelar qué
  correos están registrados.

---

## 2. Lo que tienes que activar tú: SMTP propio

### 2.1 Requisito previo: un dominio

Para enviar correo en nombre de tu web hace falta un dominio verificado en el proveedor. Si aún no
tienes dominio, este paso va antes que el resto (y es el mismo dominio que necesitas para
`NEXT_PUBLIC_SITE_URL`).

### 2.2 Los valores exactos (proveedor: Resend)

Verificado en la documentación oficial de Resend para su integración con Supabase
(`resend.com/docs/send-with-supabase-smtp`):

| Campo en Supabase | Valor exacto |
|---|---|
| **Host** | `smtp.resend.com` |
| **Port** | `465` |
| **Username** | `resend` |
| **Password** | tu **API key** de Resend (empieza por `re_`) |
| **Sender email** | un correo de **tu dominio verificado**, por ejemplo `no-reply@tudominio.com` |
| **Sender name** | `Pensiones Unimagdalena` |

Dónde se pega: **Supabase → Authentication → Emails → SMTP Settings → Enable Custom SMTP**.

> **No inventes ni reutilices claves en el código.** La API key se pega **solo** en ese panel de
> Supabase: la aplicación no la necesita y no debe tenerla.

Si prefieres otro proveedor (Brevo, SendGrid, Mailgun…), sus valores de host, puerto, usuario y
contraseña los muestra su propio panel en la sección SMTP. La estructura es idéntica: cuatro
valores y un remitente. Dime cuál eliges y te digo dónde queda cada uno.

### 2.3 Direcciones de vuelta (obligatorio, o los enlaces fallan)

**Supabase → Authentication → URL Configuration:**

| Campo | Valor |
|---|---|
| **Site URL** | `https://tudominio.com` |
| **Redirect URLs** | `https://tudominio.com/auth/confirmar` |

Y en tu `.env.local` (o variables del despliegue):

```
NEXT_PUBLIC_SITE_URL=https://tudominio.com
```

Sin estos dos pasos, el correo llega pero el enlace devuelve al sitio equivocado.

### 2.4 Plantillas de correo

**Supabase → Authentication → Email Templates.** Las dos que importan:

- **Confirm signup** — el enlace debe incluir `{{ .ConfirmationURL }}` (es lo que trae por defecto).
- **Reset password** — igual, con `{{ .ConfirmationURL }}`.

La aplicación ya indica a dónde volver (`/publicar` al confirmar la cuenta, `/restablecer` al
recuperar la contraseña), así que **no hay que escribir enlaces a mano en la plantilla**; basta con
que el botón apunte a `{{ .ConfirmationURL }}`.

### 2.5 Cupos de envío

**Supabase → Authentication → Rate Limits.** Revisa ahí el límite de correos por hora. Con el
servicio integrado (sin SMTP propio) el cupo es deliberadamente bajo porque está pensado para
pruebas: si se agota, los registros se quedan a medias **sin que nadie se entere**. Es la razón de
este documento.

---

## 3. Cómo comprobar que quedó bien (5 minutos)

1. **Recuperación:** entra a `/recuperar`, escribe el correo de tu cuenta y revisa la bandeja.
   Abre el enlace → debe llevarte a `/restablecer` con el formulario activo (no al aviso de enlace
   caducado).
2. **Contraseña nueva:** cambia la contraseña y entra con ella.
3. **Enlace caducado:** abre el mismo enlace por segunda vez. Debe decir que ya no sirve y ofrecer
   pedir otro — así sabes que el caso real está cubierto.
4. **Confirmación de cuenta:** registra una cuenta nueva con otro correo y confirma desde el enlace;
   debe dejarte en `/publicar` con la sesión iniciada.

Si en el paso 1 el correo **no llega**: revisa spam, y si tampoco, es el cupo del servicio
integrado — señal de que el SMTP propio es lo que falta.
