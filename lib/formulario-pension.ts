/**
 * Piezas compartidas por el formulario de publicación y el de edición.
 *
 * Estaban dentro de `FormularioPension.tsx`; al añadir el editor de anuncios
 * pasaron aquí para que las dos pantallas ofrezcan exactamente las mismas
 * opciones (si se añade un servicio, aparece en las dos).
 */

/** Servicios ofrecidos con más frecuencia en Santa Marta. */
export const SERVICIOS = [
  "WiFi de alta velocidad",
  "Aire acondicionado",
  "Lavandería",
  "Cocina compartida",
  "Agua y energía incluidas",
  "3 comidas al día",
  "Zona de estudio",
  "Parqueadero",
];

export const NORMAS = [
  "No fumadores",
  "Silencio después de las 10 p. m.",
  "Visitas hasta las 8 p. m.",
  "Entrada libre 24 h",
  "Cocina compartida con horario",
  "Respetar zonas comunes",
];

export const BARRIOS = [
  "Mamatoco",
  "El Pando",
  "Zaragoza",
  "Gaira",
  "San Fernando",
  "Los Troncos",
  "Centro",
  "Otro",
];

/**
 * Une la lista curada con lo que el anuncio ya tenía.
 *
 * Evita perder datos al editar: si un anuncio se publicó con un servicio o una
 * norma que hoy no está en la lista, se sigue mostrando (y se puede
 * desmarcar), en lugar de desaparecer al guardar.
 */
export function conOpcionesActuales(lista: string[], actuales: string[]): string[] {
  const extra = actuales.filter((valor) => valor && !lista.includes(valor));
  return [...lista, ...extra];
}

export const claseInput =
  "mt-1 w-full rounded-xl border border-neutro-300 bg-neutro-50 px-3 py-3 text-neutro-900 outline-none transition focus:border-primary-600 focus:bg-white";

export const claseEtiqueta = "block text-sm font-semibold text-neutro-700";
