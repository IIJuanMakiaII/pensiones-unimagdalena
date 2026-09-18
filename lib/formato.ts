import type { GeneroHabitacion, Habitacion, Pension, TipoHabitacion } from "@/types";

/**
 * Número central de WhatsApp del marketplace (variable de entorno).
 *
 * Se normaliza a solo dígitos, de modo que los formatos habituales de un
 * `.env.local` ("+57 300 123 4567", "57-300-1234567") funcionen igual. Si tras
 * normalizar sigue siendo inválido se avisa por consola en desarrollo, en lugar
 * de romper el enlace de reserva en silencio.
 */
const NUMERO_CRUDO = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "573001234567";

export function normalizarNumeroWhatsApp(valor: string): string {
  return valor.replace(/[^\d]/g, "");
}

export const WHATSAPP_NUMERO = normalizarNumeroWhatsApp(NUMERO_CRUDO);

/** El formato esperado es de 10 a 15 dígitos, con el código de país incluido. */
export function numeroWhatsAppValido(numero: string = WHATSAPP_NUMERO): boolean {
  return /^\d{10,15}$/.test(numero);
}

if (process.env.NODE_ENV !== "production" && !numeroWhatsAppValido()) {
  console.warn(
    `[WhatsApp] NEXT_PUBLIC_WHATSAPP_NUMBER no es válido: "${NUMERO_CRUDO}". ` +
      "Debe tener entre 10 y 15 dígitos con el código de país (ej. 573001234567): " +
      "los botones de reserva no funcionarán hasta corregirlo en .env.local."
  );
}

/** Formatea un valor COP entero como "$1.200.000" (responsabilidad de presentación). */
export function formatearCOP(valor: number): string {
  return "$" + valor.toLocaleString("es-CO");
}

export const ETIQUETA_TIPO: Record<TipoHabitacion, string> = {
  individual: "Individual",
  compartida: "Compartida",
  matrimonial: "Matrimonial",
};

export const ETIQUETA_GENERO: Record<GeneroHabitacion, string> = {
  mixto: "Mixto",
  femenino: "Femenino",
  masculino: "Masculino",
};

export function etiquetaTipo(tipo: TipoHabitacion): string {
  return ETIQUETA_TIPO[tipo];
}

export function etiquetaGenero(genero: GeneroHabitacion): string {
  return ETIQUETA_GENERO[genero];
}

/**
 * Mensaje prellenado de WhatsApp parametrizado según la plantilla canónica
 * del Agente 1 (§5.3): pensión, barrio, tipo, género, precio y alimentación.
 */
export function mensajeWhatsApp(pension: Pension, habitacion?: Habitacion): string {
  const ubicacion = pension.barrio ? ` (${pension.barrio})` : "";

  // Pensión publicada sin habitaciones: mensaje general con su precio de referencia.
  if (!habitacion) {
    const precio = pension.precioMensual > 0 ? ` a ${formatearCOP(pension.precioMensual)}/mes` : "";
    return (
      `Hola 👋, vi en el Marketplace de Pensiones Unimagdalena la ${pension.titulo}` +
      `${ubicacion} y me interesa el alquiler${precio}. ¿Está disponible?`
    );
  }

  const alimentacion = habitacion.alimentacion_incluida
    ? " con alimentación incluida"
    : " sin alimentación";
  return (
    `Hola 👋, vi en el Marketplace de Pensiones Unimagdalena la ${pension.titulo}` +
    `${ubicacion} y me interesa la habitación ${etiquetaTipo(habitacion.tipo)} · ` +
    `${etiquetaGenero(habitacion.genero)} a ${formatearCOP(
      habitacion.precio_mensual_cop
    )}/mes${alimentacion}. ¿Está disponible?`
  );
}

/** Enlace wa.me con el mensaje prellenado, listo para abrir en pestaña nueva. */
export function enlaceWhatsApp(pension: Pension, habitacion?: Habitacion): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
    mensajeWhatsApp(pension, habitacion)
  )}`;
}
