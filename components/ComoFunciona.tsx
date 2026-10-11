import Link from "next/link";
import EtiquetaVerificado from "@/components/EtiquetaVerificado";

interface Paso {
  titulo: string;
  detalle: string;
}

/**
 * Los cuatro pasos, en el orden en que ocurren de verdad.
 *
 * Esta sección sustituye a la banda «Por qué familias y estudiantes eligen Nido»
 * (tarea #57). El motivo no es de redacción: el botón del hero dice «Conoce cómo
 * funciona» y apuntaba a esa banda, que enumeraba **motivos** donde se habían
 * prometido **pasos**; y el mismo mensaje de confianza aparecía además en los tres
 * sellos del hero y en el bloque del pie —cuatro veces en la misma pantalla—.
 *
 * Aquí queda una sola vez, y con lo que el botón promete: el recorrido. Las cuatro
 * ideas de la banda anterior no se pierden, se reparten donde se entienden:
 * «precios mensuales claros» vive en el paso 4, «reserva acompañada» en el paso 2 y
 * «soporte para estudiantes y padres» en la entradilla.
 */
const PASOS: Paso[] = [
  {
    titulo: "Busca por barrio y precio",
    detalle:
      "Filtra por barrio, precio y tipo de habitación. Cada anuncio dice a cuántos minutos a pie está del campus.",
  },
  {
    titulo: "Escríbenos por WhatsApp",
    detalle:
      "Nos cuentas qué buscas y te respondemos con lo que hay disponible. El contacto lo atiende el equipo de Nido, no un intermediario.",
  },
  {
    titulo: "Visitamos y sellamos",
    detalle:
      "Si visitamos el inmueble en sitio y cumple, recibe el sello «Verificado por Nido ✓». Abajo contamos qué comprobamos.",
  },
  {
    titulo: "Reserva el primer mes",
    detalle:
      "Reservas en línea y el cupo queda bloqueado a tu nombre. Antes de pagar ves el desglose: el anticipo que se gira al propietario y la tarifa de servicio de Nido.",
  },
];

/**
 * Banda única de confianza de la portada: los pasos y la verificación.
 *
 * Lo que se comprueba en la visita está copiado de la sección 6.2 de las
 * Condiciones de uso —donde ya está publicado y es exigible— y no de una promesa
 * nueva inventada para la portada. Esa sección garantiza tres cosas: que un
 * representante de Nido estuvo físicamente, que las fotos corresponden al estado
 * real y que se constataron las condiciones básicas y los servicios (agua,
 * energía, wifi, ventilación o aire).
 *
 * Enunciarlas aquí es lo que convierte «visitamos e inspeccionamos» en algo
 * comprobable: quien lee puede cotejar el anuncio contra la lista.
 *
 * Ancla `#como-funciona`, que es a donde apunta el botón del hero.
 */
export default function ComoFunciona() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-titulo"
      className="border-b border-neutro-200 bg-white"
    >
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-12">
        <h2
          id="como-funciona-titulo"
          className="text-center font-display text-xl font-extrabold text-neutro-800 md:text-2xl"
        >
          Cómo funciona Nido
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-base leading-relaxed text-neutro-600">
          Buscas, escribes por WhatsApp y reservas el primer mes con el equipo de Nido
          acompañándote en cada paso. Soporte para estudiantes y padres antes y después de
          reservar.
        </p>

        <ol className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map((paso, indice) => (
            <li
              key={paso.titulo}
              className="flex flex-col items-start gap-3 rounded-2xl bg-neutro-50 p-5 ring-1 ring-neutro-200"
            >
              {/* Número en lugar de icono: en una lista de pasos, el orden es la
                  información, y un icono obliga a deducirlo del dibujo. */}
              <span
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 font-display text-lg font-extrabold text-white shadow-sm"
              >
                {indice + 1}
              </span>
              <h3 className="font-display text-base font-bold leading-snug text-neutro-800">
                {paso.titulo}
              </h3>
              <p className="text-base leading-relaxed text-neutro-600">{paso.detalle}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-2xl border border-neutro-200 bg-neutro-50 p-5 md:p-6">
          <h3 className="font-display text-base font-bold text-neutro-800 md:text-lg">
            Cómo verificamos cada anuncio
          </h3>
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-neutro-600">
            Este es el sello que llevan las fichas visitadas: <EtiquetaVerificado />. No se
            pide ni se compra — lo otorga el equipo de Nido desde el panel, y ningún
            anunciante puede ponérselo por su cuenta. Lo recibe un inmueble después de una
            visita en la que comprobamos tres cosas:
          </p>

          <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <li className="rounded-xl bg-white p-4 text-base leading-relaxed text-neutro-600 ring-1 ring-neutro-200">
              <strong className="font-semibold text-neutro-800">Un representante</strong> de
              Nido estuvo físicamente en el inmueble.
            </li>
            <li className="rounded-xl bg-white p-4 text-base leading-relaxed text-neutro-600 ring-1 ring-neutro-200">
              Las <strong className="font-semibold text-neutro-800">fotos del anuncio</strong>{" "}
              corresponden al estado real que encontramos en la visita.
            </li>
            <li className="rounded-xl bg-white p-4 text-base leading-relaxed text-neutro-600 ring-1 ring-neutro-200">
              Funcionan las{" "}
              <strong className="font-semibold text-neutro-800">
                condiciones básicas y los servicios
              </strong>{" "}
              ofrecidos: agua, energía, wifi y ventilación o aire.
            </li>
          </ul>

          <p className="mt-4 max-w-3xl text-base leading-relaxed text-neutro-600">
            Un anuncio <strong className="font-semibold text-neutro-800">sin el sello</strong>{" "}
            no es un anuncio fraudulento: significa que todavía no lo hemos visitado.{" "}
            <Link
              href="/legal/condiciones"
              className="font-semibold text-primary-700 underline underline-offset-2 hover:text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              Está en las Condiciones de uso, sección 6
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
