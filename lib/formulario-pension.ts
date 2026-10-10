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

/**
 * El marcador de «mi barrio no está en la lista».
 *
 * No es un barrio y no debe guardarse como tal: quien lo elige escribe el nombre
 * verdadero en un campo aparte, y es ese nombre el que se guarda, el que se ve en
 * la tarjeta y el que da dirección a `/barrios/…`. Guardar la palabra «Otro»
 * crearía una página de barrio para un marcador de posición.
 */
export const BARRIO_OTRO = "Otro";

/**
 * Sectores de Santa Marta cercanos a la Universidad del Magdalena.
 *
 * La lista anterior tenía ocho entradas y varias fuera de lugar —«Zaragoza» y
 * «Los Troncos» están en el otro extremo de la ciudad, a más de media hora en
 * bus—, así que el anfitrión elegía por descarte y el estudiante buscaba por
 * barrios que no le servían. Estos son los sectores realmente próximos al campus.
 *
 * **El orden es deliberado** —de más cerca a más lejos— y no alfabético: quien
 * publica reconoce su sector por cercanía, y quien busca lee primero lo que está a
 * un paseo. «Otro» va al final por ser la salida, no una opción más.
 *
 * La ortografía importa más de lo que parece: `slugDeBarrio()` deriva de cada
 * nombre la dirección pública de su página (`El Piñón` → `/barrios/el-pinon`), así
 * que corregir una tilde cambia la dirección de esa página.
 */
export const BARRIOS = [
  "El Piñón",
  "Portal Universitario",
  "Villa Marbella",
  "Ciudad del Sol",
  "La Lucha",
  "Portal de las Avenidas",
  "Mirador de la Sierra",
  "Ciudadela",
  "Urbanización Canarias",
  "El Mayor",
  "Urbanización El Río",
  "El Pando",
  "Villas del Mayor",
  "Ciudad Campestre El Nogal",
  "Silvia Rosa",
  "Bavaria",
  "Villas de Alejandría",
  "La Capilla",
  "La 30",
  "Los Almendros",
  "Mamatoco",
  "Parque Central BCH",
  "Cundí",
  "17 de Diciembre",
  "Ondas del Caribe",
  "Las Malvinas",
  BARRIO_OTRO,
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
