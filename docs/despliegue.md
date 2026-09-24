# Despliegue en producción

Guía para poner el sitio en línea por primera vez. Se puede seguir de arriba abajo.

> **Resumen en una línea:** el sitio va en **Vercel**, no en GitHub Pages. GitHub
> queda como casa del código y de las comprobaciones automáticas.

---

## 1. Por qué no GitHub Pages

Si activaste Pages y viste el `README.md` como página, eso es exactamente lo que
hace Pages cuando la raíz del repositorio no tiene `index.html`: ejecuta Jekyll y
publica el `README.md` como portada. No es un fallo de tu despliegue — **es el host
equivocado**, y forzarlo daría un sitio peor que no tener nada.

Este proyecto **necesita servidor**. Lo que se perdería en un alojamiento estático,
comprobado sobre el código:

| Qué | Dónde vive | Qué pasa sin servidor |
|---|---|---|
| Redirección de las direcciones antiguas | `middleware.ts` | Los enlaces ya repartidos (UUID) dejan de llevar a su anuncio |
| El 404 de verdad | `middleware.ts` | Vuelve el 404 blando: una dirección inexistente responde 200 con el texto «no encontrada» |
| Entrar, registrarse, recuperar contraseña, publicar | `app/login`, `app/registro`, `app/recuperar`, `app/publicar`, `app/auth/confirmar` | **Nadie puede registrarse ni publicar.** El producto deja de existir |
| Cabeceras de seguridad | `next.config.mjs` → `headers()` | Sin CSP, sin HSTS, sin `frame-ancestors`. Es justo el terreno donde este proyecto no puede retroceder |
| Optimización de imágenes | `next/image` | Las fotos se sirven sin optimizar |
| Que un anuncio nuevo aparezca sin recompilar | ISR / `revalidate` | Habría que volver a desplegar cada vez que alguien publica |

En resumen: en GitHub Pages tendrías una **vitrina en la que nadie puede publicar**.
Por eso la decisión es Vercel, que además es lo que la aplicación ya espera (analítica
de Vercel integrada y comprobaciones pensadas para ese entorno).

**Hazlo una vez:** en GitHub, *Settings → Pages → Source: None* para que la portada
deje de mostrar el `README.md`. Si prefieres dejarlo, no estorba: el dominio público
será otro.

---

## 2. Antes de desplegar: variables de entorno

En Vercel: *Project → Settings → Environment Variables*. Se configuran **una vez por
entorno** (Production, Preview, Development).

| Variable | Valor | Qué pasa si falta |
|---|---|---|
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Tu número con código de país: `573001234567` o `+57 300 123 4567` | **La compilación falla a propósito.** Es una salvaguarda: sin número válido, todos los botones de reserva apuntarían a un número inexistente |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → *Project Settings → API → Project URL* | **No hay catálogo.** Ni anuncios, ni páginas de barrio, y el sitemap sale casi vacío. Y ocurre **en silencio**: el sitio parece funcionar, pero está vacío |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Misma pantalla → clave `anon` `public` | Lo mismo que arriba |
| `NEXT_PUBLIC_SITE_URL` | Tu dominio real, **sin barra final** | Las direcciones canónicas, el Open Graph y el sitemap apuntan al dominio de respaldo |

### Dos reglas que no se saltan

**Nunca añadas `SUPABASE_SERVICE_ROLE_KEY`.** Esa clave salta todas las políticas de
la base de datos. Nada del sitio la necesita: todo funciona con la clave pública, que
es la que ya viaja al navegador.

**Nunca pongas `NEXT_PUBLIC_MOSTRAR_DEMO=1` en Production.** En producción la
demostración está **apagada por defecto**, y así debe quedarse. Si la activaras, el
catálogo de ejemplo pasaría a ser público —justo lo que hay que evitar antes del
lanzamiento— y las direcciones de tus despliegues de vista previa son alcanzables
por cualquiera que las tenga.

---

## 3. El caso concreto: enseñar la demostración a los profesores

La demostración se necesita para enseñarla, pero no puede acabar publicada. La forma
limpia, que separa las dos cosas:

1. En Vercel, añade `NEXT_PUBLIC_MOSTRAR_DEMO=1` **solo con el alcance Preview**, no
   Production. Production se queda sin la variable.
2. Cada *pull request* genera una dirección de vista previa con la demostración
   encendida, y el dominio de producción sigue sin ella.
3. **Antes de repartir el enlace, comprueba que no se indexa:**
   ```bash
   curl -I https://tu-despliegue-de-vista-previa.vercel.app | findstr /I "x-robots-tag"
   ```
   Si no aparece un `noindex`, no lo repartas todavía: pide que se proteja el
   despliegue de vista previa.
4. Además, y por diseño, el `sitemap.xml` **no anuncia nunca** las fichas de ejemplo:
   sale de las publicaciones reales de la base. Así que aunque alguien llegue a la
   vista previa, la demostración no se propaga por los buscadores.

---

## 4. Puesta en marcha

1. En Vercel: *Add New → Project* e importa el repositorio
   `IIJuanMakiaII/pensiones-unimagdalena`. La rama de producción es `main`.
2. Framework: **Next.js** (se detecta solo). No cambies el comando de compilación:
   el proyecto espera `npm run build`.
3. Añade las cuatro variables del apartado 2 con alcance **Production**.
4. *Deploy*. La primera compilación tarda unos minutos.
5. Cuando termine, conecta tu dominio en *Settings → Domains*, y **vuelve a
   desplegar** después de cambiarlo: las direcciones canónicas y el sitemap se
   generan con `NEXT_PUBLIC_SITE_URL` y no se corrigen solos en un despliegue ya
   hecho.

---

## 5. Comprobación después de desplegar

Ninguna de estas comprobaciones es opcional: son las que distinguen «está en línea» de
«está bien». Sustituye `https://tudominio.com` por el tuyo.

```bash
# La portada responde y las cabeceras de seguridad están puestas
curl -I https://tudominio.com
#   -> 200, y deben aparecer Content-Security-Policy, Strict-Transport-Security,
#      X-Content-Type-Options, Referrer-Policy, X-Frame-Options

# El sitemap anuncia solo publicaciones reales, y ninguna de la demostración
curl https://tudominio.com/sitemap.xml

# Los buscadores pueden entrar al catálogo, pero no a las zonas privadas
curl https://tudominio.com/robots.txt

# Un anuncio responde por su dirección legible
curl -I https://tudominio.com/pensiones/<slug-real>
#   -> 200

# Un enlace antiguo (UUID) lleva a la dirección legible
curl -I https://tudominio.com/pensiones/<uuid-real>
#   -> 308 con Location: /pensiones/<slug-real>

# Una dirección que no existe NO puede responder 200
curl -I https://tudominio.com/pensiones/no-existe-esta-pension
#   -> 404
```

Y a mano, en el navegador del teléfono:

- [ ] El botón de WhatsApp abre una conversación **con el número que configuraste**.
- [ ] Registrarse llega al correo de confirmación y el enlace vuelve al sitio correcto.
- [ ] «Olvidé mi contraseña» envía el correo y el enlace permite poner una nueva.
- [ ] Publicar un anuncio lo deja visible en el catálogo **sin volver a desplegar**.
- [ ] La ficha de un anuncio se comparte por WhatsApp con la dirección legible.

---

## 6. Si algo sale mal

Vercel guarda todos los despliegues. *Deployments → elegir el anterior → Promote to
Production* devuelve el sitio a la versión que funcionaba, sin tocar el código.

---

## 7. Lo que aún no funciona aunque despliegues

Dos cosas dependen de pasos fuera del despliegue, y conviene saberlo antes de
prometer nada:

- **Borrar un anuncio.** La migración `supabase/oleada-7.sql` **no está aplicada**. Hay
  que pegarla en el editor SQL del proyecto de Supabase, junto con su archivo de
  pruebas (`supabase/pruebas/oleada-7.sql`). Mientras no se aplique, la función no
  existe. Lo mismo con los índices de `supabase/oleada-8.sql`.
- **Los textos legales.** Las páginas se publican con los datos del responsable
  marcados como «PENDIENTE». No las des a conocer al público hasta que estén
  completas y el abogado haya respondido la sección A de
  `docs/legales/preguntas-para-el-abogado.md`.
