import { formatearCOP } from "@/lib/formato";
import { desgloseReserva } from "@/lib/pension";

interface Props {
  /** Canon mensual de la habitación que el estudiante tiene seleccionada. */
  precioMensual: number;
  /**
   * Cómo se llama esa habitación («Individual · mixta»). Se muestra porque el
   * bloque va antes de la lista: sin decir a qué habitación corresponden, los
   * importes no se entenderían y al cambiar de selección parecerían bailar solos.
   */
  etiquetaHabitacion?: string;
}

/**
 * Qué paga el estudiante al reservar, antes del paso de reserva (tarea #46).
 *
 * El fundador pidió que el desglose se explique «de forma gráfica y concisa antes
 * del botón de pago, para evitar confusiones o reclamos». Las cifras salen del
 * **precio real de la habitación elegida** —nunca escritas a mano aquí—, y los
 * nombres de los rubros son los de las tablas legales, que son las que mandan.
 *
 * Lo que este bloque **no** hace, a propósito: no hay botón de pago. El cobro en
 * línea todavía no existe, así que prometer que se puede pagar aquí sería peor que
 * no ofrecerlo. La reserva se cierra como hasta ahora —por WhatsApp con la
 * plataforma— y este bloque solo explica qué se paga y a quién.
 */
export default function DesgloseReserva({ precioMensual, etiquetaHabitacion }: Props) {
  const { canon, deposito, tarifaServicio, sena, saldoAlLlegar } = desgloseReserva(precioMensual);

  // Sin precio no hay nada que desglosar (y no se muestra un depósito de $0).
  if (canon <= 0) return null;

  return (
    <section
      aria-labelledby="titulo-desglose-reserva"
      className="mt-5 rounded-2xl border border-neutro-200 bg-white p-4"
    >
      <h3
        id="titulo-desglose-reserva"
        className="font-display text-base font-bold text-neutro-800"
      >
        Qué pagas al reservar
      </h3>
      {etiquetaHabitacion && (
        <p className="mt-1.5 inline-flex rounded-full bg-primary-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary-800 ring-1 ring-primary-100">
          Habitación {etiquetaHabitacion}
        </p>
      )}
      <p className="mt-2 text-base leading-relaxed text-neutro-600">
        El primer mes son <strong className="text-neutro-800">{formatearCOP(canon)}</strong> y se
        paga en dos momentos: la reserva ahora y el saldo cuando llegues.
      </p>

      {/* Los dos rubros de la reserva. Se leen como en la tabla del contrato:
          concepto, monto y a quién va el dinero. */}
      <dl className="mt-3 text-sm">
        <Fila
          etiqueta="Tarifa de Servicio de la Plataforma"
          monto={tarifaServicio}
          destino="Remuneración de la plataforma"
        />
        <Fila
          etiqueta="Seña / Anticipo del primer mes"
          monto={sena}
          destino="Al propietario, abonado al primer mes"
        />
      </dl>

      {/* Los dos momentos del pago, separados del detalle por una línea. */}
      <dl className="mt-1 border-t border-neutro-200 pt-1 text-sm">
        <Fila
          etiqueta="Total a pagar hoy"
          monto={deposito}
          destino="Al cerrar la reserva con nosotros"
          fuerte
        />
        <Fila
          etiqueta="Saldo al llegar a la pensión"
          monto={saldoAlLlegar}
          destino="Directo al propietario, contra entrega de llaves"
          fuerte
        />
      </dl>

      <p className="mt-3 rounded-xl bg-neutro-50 px-3 py-2.5 text-xs leading-relaxed text-neutro-600">
        El dinero de hoy <strong className="text-neutro-700">no es el arriendo</strong>: son dos
        rubros distintos —la tarifa de la plataforma y la seña, que va al propietario y se abona al
        primer mes—. La reserva se cierra con nosotros por WhatsApp.
      </p>
    </section>
  );
}

/** Una línea del desglose: concepto, monto y a quién va el dinero. */
function Fila({
  etiqueta,
  monto,
  destino,
  fuerte = false,
}: {
  etiqueta: string;
  monto: number;
  destino: string;
  fuerte?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-neutro-100 py-2.5 last:border-b-0">
      <dt className={`pr-2 ${fuerte ? "font-bold text-neutro-800" : "text-neutro-700"}`}>
        {etiqueta}
      </dt>
      <dd
        className={`precio shrink-0 font-bold ${
          fuerte ? "font-display text-base text-accent-700" : "text-neutro-800"
        }`}
      >
        {formatearCOP(monto)}
      </dd>
      <dd className="w-full text-xs leading-snug text-neutro-500">{destino}</dd>
    </div>
  );
}
