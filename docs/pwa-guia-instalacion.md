# Guía PWA — Instalar y probar la app

**Pensiones Unimagdalena** · Next.js 14 App Router

---

## 1. Regla de oro: el service worker necesita HTTPS

El service worker (lo que hace que la app funcione offline) **solo se registra en contexto seguro**:

| Entorno | ¿Funciona el service worker? |
|---|---|
| `http://localhost:3000` | ✅ Sí (localhost es seguro por definición) |
| `https://tu-dominio.com` | ✅ Sí |
| `http://192.168.1.x:3000` (celular en la misma red) | ❌ No — el navegador bloquea el registro |

**Por eso:** para probar la instalación en tu celular necesitas HTTPS. Dos caminos:

1. **Desplegar en Vercel** (recomendado, gratis): conecta el repositorio y tendrás una URL `https://...vercel.app`.
2. **Túnel HTTPS temporal:** `npx localtunnel --port 3000` o `ngrok http 3000` desde otra terminal.

---

## 2. Probar en la computadora (localhost)

```bash
npm run build
npm start          # → http://localhost:3000
```

1. Abre **Chrome** en `http://localhost:3000`.
2. `Ctrl + Shift + I` → pestaña **Application**:
   - **Manifest**: debe mostrar *Pensiones UniMag*, los 4 íconos y `display: standalone`.
   - **Service Workers**: debe aparecer `sw.js` en estado **activated**.
   - **Cache Storage**: verás `pensiones-app-v1`, `pensiones-estaticos-v1`, `pensiones-imagenes-v1`.
3. En la barra de direcciones aparece el ícono de instalar (⊕ / monitor con flecha) → clic en **Instalar**.
4. **Prueba offline:** en *Application* → *Service Workers* marca **Offline** y recarga.
   La app debe seguir funcionando con el catálogo cacheado; una ruta nunca visitada mostrará `/offline`.

**Auditoría automática:** `Ctrl + Shift + I` → **Lighthouse** → categoría *Progressive Web App* (o *Installable* en versiones nuevas) → *Analyze page load*.

---

## 3. Instalar en Android

1. Abre la URL HTTPS en **Chrome**.
2. Aparece el aviso **"Instala Pensiones Unimagdalena"** (o menú ⋮ → **Instalar aplicación**).
3. Toca **Instalar app** → se agrega a la pantalla de inicio y abre sin barra del navegador.
4. El aviso no vuelve a aparecer 14 días si tocas *Ahora no* (se guarda en `localStorage`).

## 4. Instalar en iPhone (iOS)

Apple no permite el prompt automático, por lo que verás las instrucciones manuales:

1. Abre la URL, **obligatoriamente en Safari**.
2. Toca **Compartir** (cuadrado con flecha ↑).
3. Elige **Agregar a pantalla de inicio** → **Agregar**.
4. Se instala con el ícono de la casa verde y abre a pantalla completa.

> Las notificaciones push en iOS solo funcionan con la app ya instalada (iOS 16.4+) y con permiso del usuario.

---

## 5. Qué se cachea y cómo se actualiza

| Recurso | Estrategia | Efecto |
|---|---|---|
| Navegaciones (HTML) | Red primero → caché → `/offline` | Siempre ves la versión más reciente; sin red, la última visitada |
| `/_next/static/*`, `/iconos/*` | Caché primero | Carga instantánea (los archivos llevan hash, son inmutables) |
| Imágenes (Unsplash) | Stale-while-revalidate | Se muestran al instante y se refrescan en segundo plano |

**Al desplegar cambios:** al cambiar los archivos de build, el service worker se actualiza solo
(`skipWaiting` + `clients.claim`). Si necesitas forzar la renovación de la caché, sube `VERSION`
en `public/sw.js` (por ejemplo `"v2"`): al activarse, el SW borra las cachés antiguas.

---

## 6. Checklist antes de publicar

- [ ] `npm run build` sin errores ✅ (verificado)
- [ ] `node scripts/generar-iconos.mjs` ejecutado y `public/iconos/` con los 6 PNG (192, 512, maskable, apple-touch, favicon 32/48)
- [ ] `SITIO_URL` en `lib/sitio.ts` con el dominio real (afecta canonical, OG y JSON-LD)
- [ ] `NEXT_PUBLIC_WHATSAPP_NUMBER` en `.env.local` con el número real
- [ ] Lighthouse: *Installable* en verde y sin errores de consola
- [ ] Probar instalación real en Android y en iPhone tras desplegar en HTTPS

---

## Problema resuelto: la página se quedaba colgada hasta pulsar Ctrl+Shift+R

**Síntoma:** la página no cargaba bien y solo se veía correctamente tras un
recargado forzado.

**Causa:** el service worker se registraba **también en desarrollo**. En dev los
archivos de `/_next/static/` **no llevan hash de contenido**, así que la
estrategia *caché primero* servía JavaScript viejo y la pestaña se quedaba
colgada. `Ctrl+Shift+R` ignora la caché y el service worker, por eso era lo
único que funcionaba.

**Correcciones aplicadas (2026-09-17)**

| Cambio | Dónde |
|---|---|
| El service worker **solo se registra en producción** | `components/InstalarApp.tsx` |
| En desarrollo se **desregistra** cualquier service worker anterior y se vacían sus cachés | `components/InstalarApp.tsx` |
| El aviso de instalación no aparece en desarrollo (sin SW no hay app instalable real) | `components/InstalarApp.tsx` |
| `updateViaCache: "none"` al registrar: el propio `sw.js` nunca se sirve desde la caché HTTP | `components/InstalarApp.tsx` |
| Rutas privadas (`/publicar`, `/login`, `/registro`, `/auth`) **nunca** se cachean | `public/sw.js` |
| Ninguna respuesta se guarda si no es `ok` (antes se podían cachear páginas de error) | `public/sw.js` |
| `worker-src 'self' blob:` en la CSP (el servidor de desarrollo usa workers desde blobs) | `next.config.mjs` |
| Caché del service worker a `v3` (los navegadores descartan la anterior) | `public/sw.js` |

**Si alguna vez vuelve a pasar**, el botón de emergencia manual es:
DevTools (`F12`) → **Application** → **Service Workers** → **Unregister** →
recargar. Y en **Application** → **Storage** → **Clear site data** para vaciar las
cachés.

### Dos avisos importantes

1. **Al arrancar el servidor de desarrollo, la primera carga puede fallar** mientras
   Next compila la ruta en caliente (la petición devuelve 500 y la segunda ya
   funciona). Es comportamiento del servidor de desarrollo, no un fallo de la
   aplicación: recarga una vez y continúa.
2. Al limpiar el service worker viejo, la página que ya estaba abierta puede
   fallar al navegar internamente. Por eso la limpieza de cachés se aplaza a la
   siguiente carga: desregistrar sí (inmediato, corta el problema de raíz),
   borrar cachés solo cuando la página ya no está controlada.

