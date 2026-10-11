import { enlaceWhatsAppPlataforma } from "@/lib/formato";

/**
 * Estado de la portada cuando la lectura de la base **falla** (tarea #68).
 *
 * ## El defecto que este bloque cierra
 *
 * La portada decidía con la longitud de la lista. Un corte de la base y un catálogo
 * legítimamente vacío devuelven lo mismo —cero anuncios—, así que las dos se leían
 * con la misma frase: «Todavía no hay pensiones publicadas». Esa frase es cierta
 * sobre el negocio y falsa sobre el sistema cuando lo que ocurrió fue una avería:
 * el visitante se va creyendo que Nido no tiene nada, cuando en realidad Nido no
 * pudo preguntar. La tarea #67 hizo que el motivo llegue hasta aquí; esto es lo que
 * el visitante lee cuando el motivo dice que fue un fallo.
 *
 * ## Tres decisiones que no son de estilo
 *
 *   1. **El `<main id="resultados">`.** Lo aporta `CatalogoInteractivo` dentro de su
 *      propio render, así que cualquier rama que no dibuje el catálogo se queda sin
 *      landmark principal y el enlace «Saltar al contenido» —`app/layout.tsx`— deja
 *      de llevar a ningún sitio. Aquí se vuelve a declarar, igual que en
 *      `ListaDeEspera.tsx`. El ancla del botón del hero apunta al mismo id.
 *   2. **El título no reutiliza «Todavía no hay pensiones publicadas».** Ese texto lo
 *      escribe también el bloque de catálogo vacío de `CatalogoInteractivo.tsx`, y si
 *      el estado de avería lo repitiera, las dos situaciones seguirían siendo
 *      indistinguibles: para el visitante, para una captura de pantalla y para
 *      cualquier verificador que busque la cadena.
 *   3. **El enlace de reintento es un `<a>` normal, no un botón con JavaScript.** La
 *      portada se revalida cada 60 s (`revalidate` en `app/page.tsx`), así que volver
 *      a cargar antes de esa ventana puede servir la página ya guardada. Por eso el
 *      texto pide «un par de minutos» en lugar de prometer que el siguiente intento
 *      funcionará: es lo que el comportamiento real sostiene.
 *
 * ## Lo que este bloque **no** hace
 *
 * No ofrece la lista de espera. «Déjanos tu WhatsApp y te avisamos» es la promesa del
 * estado sin inventario, y hacerla aquí sería decirle al estudiante que vigile una
 * alerta cuando el problema es que la base no respondió. Tampoco dibuja la puerta del
 * propietario: en una avería, al anfitrión no le corresponde nada.
 */

/**
 * Lo que viaja en la URL del contacto.
 *
 * Deliberadamente no dice «avísenme cuando haya habitaciones»: quien escribe desde
 * este estado no está pidiendo una alerta, está avisando de que la página no cargó.
 * Si el mensaje y el motivo no coinciden, quien lo recibe responde lo que no era.
 */
const MENSAJE_SOPORTE =
  "Hola, entré a Nido y la página no me mostró las pensiones. ¿Me pueden ayudar?";

export default function ErrorCatalogo() {
  return (
    <main id="resultados" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <section
        aria-labelledby="error-catalogo-titulo"
        className="rounded-2xl border border-neutro-300 bg-white px-6 py-12 text-center"
      >
        <span
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        </span>

        <h2
          id="error-catalogo-titulo"
          className="mt-4 font-display text-lg font-bold text-neutro-800"
        >
          No pudimos cargar las pensiones
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-base leading-relaxed text-neutro-600">
          Tuvimos un problema al consultar las pensiones disponibles. Es una falla temporal
          de nuestro lado: <strong className="font-semibold text-neutro-800">no quiere decir
          que no haya habitaciones publicadas</strong>. Vuelve a intentarlo en un par de
          minutos.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {/* Recarga completa de la portada. El `href="/"` es intencionalmente un enlace
              y no un botón: funciona sin JavaScript y no depende de que el cliente
              hidrate nada. */}
          <a
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-airbnb-rausch-hover px-6 text-base font-semibold text-white transition hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
          >
            Volver a intentarlo
          </a>
          {/* El rótulo es «Escríbenos» y no «Escríbenos por WhatsApp» a propósito: la
              puerta del canal —`lib/formato.ts`— decide entre WhatsApp y el formulario
              de respaldo según lo que esté configurado hoy, así que un rótulo que
              nombre una sola vía puede acabar apuntando a la otra. */}
          <a
            href={enlaceWhatsAppPlataforma(MENSAJE_SOPORTE)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-primary-600 bg-white px-6 text-base font-bold text-primary-700 transition hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            Escríbenos
          </a>
        </div>
      </section>
    </main>
  );
}
