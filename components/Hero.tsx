interface Props {
  /**
   * La portada no tiene inventario: el catálogo se sustituye por el estado de lista
   * de espera (ver `lib/lista-espera.ts`).
   *
   * El hero lo necesita porque su botón principal es una promesa literal. Si el
   * catálogo no está y el botón sigue diciendo «Ver habitaciones disponibles», el
   * visitante pulsa para ver algo que no existe. Con el aviso, el botón dice lo que
   * de verdad va a encontrar y lleva al mismo ancla de siempre.
   */
  sinInventario: boolean;
}

/**
 * Hero de la landing: propuesta de valor y las dos salidas de la portada.
 *
 * Los tres microsellos que había aquí —«verificación presencial con sello»,
 * «gestionamos tu reserva», «precios mensuales claros»— se retiraron en la tarea
 * #57: repetían, en una sola pantalla, el mismo mensaje que la banda de confianza
 * y el pie. Su contenido no se pierde, se explica una vez en
 * `components/ComoFunciona.tsx`, que es a donde apunta «Conoce cómo funciona» y a
 * donde el botón decía que llevaba.
 */
export default function Hero({ sinInventario }: Props) {
  return (
    <header className="bg-white text-neutro-800">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary-800">
          Santa Marta · Universidad del Magdalena
        </p>
        <h1 className="max-w-3xl font-display text-3xl font-extrabold leading-tight md:text-5xl">
          Pensiones para estudiantes a minutos de Unimagdalena, en Santa Marta
        </h1>
        {/* Una sola frase. La anterior encadenaba tres ideas en cuatro líneas y
            dejaba la confianza en el aire —«para que tú, estudiante foráneo, y tus
            padres, decidan con tranquilidad»—: eso ahora lo demuestra la sección,
            no lo promete el párrafo. */}
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutro-600 md:text-lg">
          Vive a minutos caminando del campus, con precios mensuales en pesos colombianos y
          reserva acompañada por el equipo de Nido.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="#resultados"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-airbnb-rausch-hover px-6 text-base font-semibold text-white transition hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
          >
            {sinInventario ? "Avísame cuando haya habitaciones" : "Ver habitaciones disponibles"}
          </a>
          <a
            href="#como-funciona"
            className="inline-flex h-12 items-center justify-center rounded-full border border-neutro-200 bg-white px-6 text-base font-semibold text-neutro-800 transition hover:border-neutro-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            Conoce cómo funciona
          </a>
        </div>
      </div>
    </header>
  );
}
