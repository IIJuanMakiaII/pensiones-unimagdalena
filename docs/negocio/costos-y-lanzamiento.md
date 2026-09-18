# Cuánto cuesta mantenerla en línea y qué falta para abrirla

> **Fecha:** 2026-09-18 · Precios de proveedores consultados el mismo día (fuentes al final).
> **Consumo medido en el sistema ese día:** base de datos **11 MB**, **0 fotos**
> almacenadas, **1 anuncio**, **1 anfitrión**.

---

## 1. Cuánto cuesta hoy, con lo que hay

| Concepto | Costo | Estado real medido |
|---|---|---|
| Base de datos y autenticación (Supabase) | **$0 / mes** | Plan gratuito: 500 MB de base y 50.000 usuarios activos. **Usamos 11 MB** (2,2%). |
| Almacenamiento de fotos | **$0 / mes** | Ya existe el contenedor `fotos-pensiones` con **5 MB por foto**. **0 archivos** guardados. |
| Hosting de la web | **$0 / mes** en plan gratuito | — |
| Dominio propio | **≈ $10,46 / año** | **≈ $0,87 / mes** (Cloudflare, a precio de costo) |
| **Total real hoy** | **≈ $1 / mes** | Prácticamente todo el gasto es el dominio |

**Conclusión honesta: mantenerla en línea hoy cuesta alrededor de un dólar al mes.**
El sistema está a dos órdenes de magnitud de cualquier límite de los planes gratuitos.
El problema del negocio **no es el costo de infraestructura**: es el tráfico y el
inventario, que hoy son 1 anuncio y 0 estudiantes.

### 1.1 Dos advertencias que sí importan

1. **El plan gratuito de hosting suele ser para uso personal, no comercial.** Cuando
   esto sea un negocio, hay que pasar al plan de pago: **~$20 / mes**. Conviene
   confirmarlo en las condiciones del proveedor antes de facturar, para no construir
   sobre un plan que no lo permite.
2. **Aún no hay despliegue configurado.** El repositorio no tiene configuración de
   despliegue ni dominio declarado (`NEXT_PUBLIC_SITE_URL` está vacío y el código cae
   a un dominio por defecto). **Antes de publicar hay que fijar el dominio real**,
   porque de él dependen las direcciones canónicas, los datos estructurados y los
   enlaces de compartir.

---

## 2. Cuánto costaría cuando crezca

Escenario con tracción real (unos **200 anuncios**, ~**1.000 fotos**, miles de visitas
al mes):

| Concepto | Costo | Por qué |
|---|---|---|
| Supabase (plan Pro) | **$25 / mes** | Cuando la base pase de 500 MB o las fotos de 1 GB. Con 1.000 fotos (~300 MB) seguiríamos en el plan gratuito. |
| Hosting comercial | **$20 / mes** | Plan de pago por uso comercial. |
| Dominio | **≈ $1 / mes** | Igual. |
| **Total** | **≈ $46 / mes** | Cifra de trabajo para el análisis financiero |

**Lo importante para el financiero:** el costo variable por anuncio adicional es
**prácticamente cero** hasta romper los límites de los planes gratuitos. Si la
comisión planteada es de **$50.000–$100.000 COP por cliente cerrado**, **un solo
cierre al mes cubre toda la infraestructura del escenario de crecimiento**, y unos
**dos cierres** cubrirían el escenario completo con hosting de pago. El costo de
infraestructura no es el que decide si el negocio funciona: lo decide la captación.

---

## 3. Lo que falta pulir para subirla

Ordenado por lo que **impide** abrir, no por dificultad técnica.

### 3.1 Bloqueantes (sin esto no se abre al público)

| # | Qué | Por qué bloquea |
|---|---|---|
| 1 | **Apagar el catálogo de demostración** | Hoy el sistema sirve contenido de ejemplo bajo ciertas condiciones de configuración. Un estudiante que vea una habitación que no existe **no vuelve**, y lo cuenta. Es el fallo más caro que puede tener un marketplace en su primer día. |
| 2 | **Correo de confirmación real** | Para publicar hace falta confirmar el correo. Si se usa el servicio de correo integrado del proveedor —pensado para pruebas— los envíos se cortan por límite y **un anfitrión no podrá terminar de registrarse**. Hay que verificar el cupo y, si es bajo, conectar un proveedor propio (Resend, SendGrid, Brevo; hay planes gratuitos suficientes para empezar). |
| 3 | **Dominio real declarado** | Sin él, los enlaces de confirmación, las canónicas y todo lo que se comparte apuntan a otro sitio. Afecta directamente al boca a boca, que es el canal principal. |
| 4 | **Analítica y buscadores** | Hoy **no hay ninguna forma de medir visitas, filtros usados ni contactos generados**, ni `sitemap` para Google. Sin esto se lanza a ciegas y no se puede decidir nada con datos después. |
| 5 | **Inventario real** | **Este es el bloqueante de negocio, no de código.** Con 1 anuncio no hay nada que filtrar ni motivo para volver. Hay que captar oferta antes de abrir: decenas de pensiones alrededor del campus. Es trabajo de campo, no de desarrollo. |
| 6 | **Direcciones compartibles** | Hoy el sistema mezcla dos formatos de identificador en las direcciones de los anuncios. Un enlace que no se puede compartir limpio rompe el canal por el que crece este mercado. |

### 3.2 Importante antes de crecer

7. **Textos legales y datos personales:** condiciones del servicio y política de
   tratamiento de datos (Ley 1581 de 2012), con autorización del anfitrión para
   publicar su número de WhatsApp.
8. **Criterio del sello «Verificado» escrito y sostenido.** Hoy se otorga a mano; si
   el criterio no es explícito, el sello deja de significar algo.
9. **Moderación de fotos y anuncios**, aunque sea manual al principio.
10. **Copias de seguridad y monitorización de errores:** hoy no hay ninguna de las
    dos. La primera pérdida de datos sin copia es la que no se perdona.
11. **Integración continua y pruebas automatizadas:** el proyecto ya tiene git y una
    batería de verificadores ejecutables; falta que se ejecuten solos en cada cambio.

### 3.3 Después del lanzamiento

12. Reseñas de estudiantes (prueba social generada por usuarios).
13. Cobro de la comisión (§5 del dosier de negocio: cómo cobrar sin poder observar el
    cierre es la decisión pendiente).
14. Destacados y visibilidad, cuando haya más anuncios que posiciones.
15. Segunda ciudad o campus.

---

## 4. La respuesta en una frase

**Mantenerla en línea cuesta hoy alrededor de un dólar al mes y unos 46 dólares en el
escenario de crecimiento: la infraestructura nunca será el freno.** Lo que falta para
abrirla no es sobre todo código: son **cinco cosas de configuración y contenido**
—apagar la demo, correo real, dominio, medición y, sobre todo, **inventario**— y de
ellas la única que no se resuelve tecleando es conseguir las primeras pensiones.

---

## Fuentes de precios (consultadas 2026-09-18)

- **Supabase:** [supabase.com/pricing](https://supabase.com/pricing) — gratuito $0 (500 MB, 50.000 usuarios activos); Pro $25/mes (8 GB, incluye $10 de crédito de cómputo).
- **Vercel:** [vercel.com/docs/plans/hobby](https://vercel.com/docs/plans/hobby) y [vercel.com/pricing](https://vercel.com/pricing) — plan Hobby gratuito para uso personal; Pro desde **$20 por asiento/mes**.
- **Dominio:** [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) — registro y renovación a precio de costo; `.com` **≈ $10,46/año**.
- **Consumo propio:** medido en la base de datos del proyecto el 2026-09-18
  (`supabase/pruebas/consumo-real.sql`, reproducible).
