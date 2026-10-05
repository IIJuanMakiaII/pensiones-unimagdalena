import type { GeneroHabitacion, Habitacion, Pension, TipoHabitacion } from "@/types";

/**
 * Número central de WhatsApp del marketplace (variable de entorno).
 *
 * Se normaliza a solo dígitos, de modo que los formatos habituales de un
 * `.env.local` ("+57 300 123 4567", "57-300-1234567") funcionen igual. Si tras
 * normalizar sigue siendo inválido se avisa por consola en desarrollo, en lugar
 * de romper el enlace de reserva en silencio.
 */
const NUMERO_CRUDO = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

/**
 * «Definida pero vacía» no es lo mismo que «definida».
 *
 * `??` solo cubre `null` y `undefined`, así que un
 * `NEXT_PUBLIC_WHATSAPP_NUMBER=` en el panel del despliegue pasaba por
 * configurado. Cuando la variable viene del panel y no del `.env.local` de una
 * máquina, ese caso es el habitual, no una rareza.
 */
export const WHATSAPP_CONFIGURADO =
  typeof NUMERO_CRUDO === "string" && NUMERO_CRUDO.trim() !== "";

/** El valor tal como llegó, para poder decir en el error qué se recibió. */
export const WHATSAPP_NUMERO_CRUDO = NUMERO_CRUDO ?? "";

/** Número de ejemplo: solo para desarrollo, nunca para una compilación de producción. */
export const NUMERO_DE_EJEMPLO = "573001234567";

export function normalizarNumeroWhatsApp(valor: string): string {
  return valor.replace(/[^\d]/g, "");
}

export const WHATSAPP_NUMERO = normalizarNumeroWhatsApp(
  WHATSAPP_CONFIGURADO ? WHATSAPP_NUMERO_CRUDO : NUMERO_DE_EJEMPLO
);

/** El formato esperado es de 10 a 15 dígitos, con el código de país incluido. */
export function numeroWhatsAppValido(numero: string = WHATSAPP_NUMERO): boolean {
  return /^\d{10,15}$/.test(numero);
}

if (process.env.NODE_ENV !== "production") {
  if (!WHATSAPP_CONFIGURADO) {
    console.warn(
      "[WhatsApp] NEXT_PUBLIC_WHATSAPP_NUMBER no está configurado: los botones de reserva " +
        `usan el número de ejemplo ${NUMERO_DE_EJEMPLO}. Defínelo en .env.local.`
    );
  } else if (!numeroWhatsAppValido()) {
    console.warn(
      `[WhatsApp] NEXT_PUBLIC_WHATSAPP_NUMBER no es válido: "${WHATSAPP_NUMERO_CRUDO}". ` +
        "Debe tener entre 10 y 15 dígitos con el código de país (ej. 573001234567): " +
        "los botones de reserva no funcionarán hasta corregirlo en .env.local."
    );
  }
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
      `Hola 👋, vi en Nido la ${pension.titulo}` +
      `${ubicacion} y me interesa el alquiler${precio}. ¿Está disponible?`
    );
  }

  const alimentacion = habitacion.alimentacion_incluida
    ? " con alimentación incluida"
    : " sin alimentación";
  return (
    `Hola 👋, vi en Nido la ${pension.titulo}` +
    `${ubicacion} y me interesa la habitación ${etiquetaTipo(habitacion.tipo)} · ` +
    `${etiquetaGenero(habitacion.genero)} a ${formatearCOP(
      habitacion.precio_mensual_cop
    )}/mes${alimentacion}. ¿Está disponible?`
  );
}

/**
 * Número que abre el botón de reserva: **el de la plataforma**.
 *
 * Antes cada anuncio podía llevar el número de su dueño y el enlace lo prefería.
 * Desde el cambio de modelo del 2026-10-02 la plataforma maneja el contacto y la
 * reserva del primer mes, así que el número del anfitrión **no se publica en
 * ninguna parte**: ni en el enlace, ni en la ficha, ni en los metadatos, ni en
 * los datos estructurados.
 *
 * No recibe la pensión a propósito: no hay nada que decidir. Y los anuncios
 * antiguos que todavía tienen un número guardado en la base no pueden desviar el
 * contacto, porque ese dato ya no forma parte de lo que la aplicación conoce
 * (ver `lib/supabase/mapeo.ts`).
 */
export function numeroDeReserva(): string {
  return WHATSAPP_NUMERO;
}

/** Enlace wa.me con el mensaje prellenado, listo para abrir en pestaña nueva. */
export function enlaceWhatsApp(pension: Pension, habitacion?: Habitacion): string {
  return `https://wa.me/${numeroDeReserva()}?text=${encodeURIComponent(
    mensajeWhatsApp(pension, habitacion)
  )}`;
}
