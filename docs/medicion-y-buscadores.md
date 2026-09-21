# Encontrarte en Google y medir qué pasa (M-19)

Tarea #24. Aquí está **qué se implementó**, **qué tienes que activar tú** y **cómo comprobarlo**. Nada de lo que aparece abajo necesita que inventes credenciales: donde hace falta un valor, está escrito tal cual hay que pegarlo.

---

## 1. Qué existe ya en el código

| Pieza | Ruta | Qué hace |
|---|---|---|
| `robots.txt` | `app/robots.ts` → `/robots.txt` | Permite el catálogo y excluye las zonas privadas |
| `sitemap.xml` | `app/sitemap.ts` → `/sitemap.xml` | Anuncia la portada y **solo los anuncios reales** |
| Medición | `lib/medicion.ts` + `<Analytics />` en `app/layout.tsx` | Registra el embudo sin cookies |

### La regla que gobierna el sitemap

**Solo URLs que existen de verdad.** El sitemap se alimenta de
`obtenerPensionesReales()` (`lib/datos.ts`), que **nunca** devuelve la semilla de
demostración y devuelve lista vacía si la base no responde.

El motivo es que un sitemap es una promesa pública a Google: lo que entra, se
indexa. Si anunciara las fichas de ejemplo, tu demostración para los profesores
acabaría en los resultados de búsqueda y, el día que la apagues, quedarían URLs
fantasma apuntando a la nada. **La demo sigue encendida y Google no la verá.**

---

## 2. La medición elegida, y por qué

**Vercel Analytics**, por un motivo concreto y comprobable: **no usa cookies ni
almacenamiento en el dispositivo**, así que mide desde la primera visita, sin
banner de consentimiento y sin tratar datos personales. La alternativa con
cookies habría obligado a bloquear la medición hasta que cada estudiante
aceptara el aviso — justo en el primer día, que es cuando más falta hace mirar.

Los eventos que se registran (todos con el identificador del anuncio, que no
identifica a ninguna persona):

| Evento | Cuándo | Para qué sirve |
|---|---|---|
| `filtros_aplicados` | 1,5 s después del último cambio de filtro | Saber precio, género, distancia y alimentación que **de verdad** se usan, y con cuántos resultados se quedó |
| `ver_ficha` | Al abrir la ficha de un anuncio | Cuántos pasan del catálogo al detalle |
| `contacto_whatsapp` | Al pulsar un CTA de reserva | **El contacto generado**, con su origen (tarjeta, ficha o barra del móvil) y si fue al número del dueño o al de la plataforma |
| `publicacion_creada` | Al publicar un anuncio | Oferta nueva que entra |

El embudo queda así: **visita → filtros → ficha → contacto**. Es exactamente lo
que hace falta para saber si se puede cobrar por un contacto y cuánto vale.

---

## 3. Lo que tienes que hacer tú

### 3.1 El dominio real (5 minutos, y es requisito de #25)

Hoy `NEXT_PUBLIC_SITE_URL` está vacío y el código usa
`https://pensiones-unimagdalena.vercel.app` como respaldo. Mientras siga así, las
canónicas, los datos estructurados, el `sitemap.xml` y **los enlaces de los
correos** apuntan a un dominio que quizá no sea el tuyo.

Cuando tengas el dominio, abre `.env.local` (o las variables de entorno del
despliegue) y pega **exactamente** esto, sustituyendo el dominio:

```
NEXT_PUBLIC_SITE_URL=https://tudominio.com
```

Sin barra final. Si algún día cambias de dominio, esta es la única línea que hay
que tocar.

Y en Supabase, para que los enlaces de los correos vuelvan a tu web:
**Authentication → URL Configuration → Site URL** → el mismo dominio.

### 3.2 Activar la medición (2 minutos, solo si despliegas en Vercel)

1. Despliega el proyecto en Vercel.
2. En el proyecto: pestaña **Analytics** → **Enable**.
3. Navega por la web y comprueba en **Analytics → Events** que aparecen
   `filtros_aplicados`, `ver_ficha` y `contacto_whatsapp`.

No hay ninguna clave que pegar: el paquete ya está integrado y no envía nada en
local.

### 3.3 Si NO despliegas en Vercel

Vercel Analytics solo mide en su plataforma. La alternativa que también funciona
sin cookies es **Cloudflare Web Analytics**, y ahí sí hace falta un **token** que
solo puedes generar tú:

1. Cloudflare → **Analytics & Logs → Web Analytics** → añadir el sitio.
2. Copia el token del beacon.
3. Pega en las variables de entorno del despliegue:

```
NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN=<el token que te da Cloudflare>
```

**Hueco declarado a propósito:** ese token no existe todavía y no se ha inventado.
Si eliges esta vía, dímelo y conecto el script en el layout; hoy el código no lo
referencia para no dejar una etiqueta vacía rompiendo la página.

### 3.4 Buscadores (cuando el dominio esté listo)

1. **Google Search Console** → añadir la propiedad con el dominio real.
2. Enviar el sitemap: `https://tudominio.com/sitemap.xml`.
3. Esperar unos días y revisar *Cobertura*: deben aparecer la portada y las
   fichas reales, y **ninguna** URL de demostración.

---

## 4. Cómo comprobarlo sin desplegar

Con la app compilada (`npm run build`):

```bash
npm start
curl http://localhost:3000/robots.txt
curl http://localhost:3000/sitemap.xml
```

Qué debe verse:

- `robots.txt`: `Allow: /`, y `Disallow` para `/publicar`, `/login`, `/registro`,
  `/recuperar`, `/restablecer`, `/auth/`, `/offline`, más la línea `Sitemap:`.
- `sitemap.xml`: la portada y **una entrada por anuncio real**. Si ves un slug de
  la semilla (por ejemplo `pension-mamatoyco-1`) o una URL que devuelve 404, es un
  fallo: avísame.

También está automatizado en la batería del proyecto:

```bash
node scripts/verificar-seo.mjs
```

que ahora comprueba ambos archivos sobre el build, incluido que la demo no se
cuele en el sitemap.
