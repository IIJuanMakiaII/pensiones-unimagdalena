/**
 * Datos de contacto escondidos en el texto libre de un anuncio (tarea #77).
 *
 * POR QUÉ EXISTE ESTE MÓDULO
 * -------------------------
 * El WhatsApp del anfitrión pasa a ser un dato **privado** y el contacto lo lleva la
 * plataforma. Pero un campo privado no sirve de nada si el mismo número se puede
 * escribir en la descripción: el que quiera saltarse el servicio tiene una puerta
 * abierta y solo necesita usarla.
 *
 * Por eso el texto libre del anuncio se revisa antes de guardarse, en las **tres**
 * puertas que escriben un anuncio (el alta del anfitrión, su edición y la edición del
 * maestro por la vía de `lib/pension-escritura.ts`). Una regla que solo vive en el
 * formulario se salta con una petición a mano; la que decide es esta.
 *
 * QUÉ SE BUSCA, Y POR QUÉ ESOS TRES
 * --------------------------------
 *  1. **Un teléfono** — en las mil formas en que se escribe uno: `3001234567`,
 *     `300 123 4567`, `300-123-4567`, `+57 300 123 4567`.
 *  2. **Un enlace** — `http…`, `www.…` o un dominio suelto (`algo.com`).
 *  3. **Una invitación** — «escríbeme al…», «llámame», «mi WhatsApp», «mi celular»,
 *     «contáctame». Es la forma más común de las tres, porque no necesita ni dígitos
 *     ni URL: basta con decir «escríbeme al número del anuncio».
 *
 * LO QUE **NO** HACE, DICHO ANTES DE QUE ALGUIEN LO CREA RESUELTO
 * ------------------------------------------------------------
 * **No mira dentro de las fotos.** Que una imagen muestre un número pintado en una
 * pared exige leer texto de una imagen (OCR), y eso no es una validación de
 * formulario: no está aquí, no está en ninguna parte de esta tarea, y fingirlo sería
 * peor que no tenerlo. El informe lo explica con la alternativa viable.
 *
 * LAS DOS TRAMPAS DEL DETECTOR DE TELÉFONOS
 * ----------------------------------------
 * `1.` **Los precios llevan puntos y las direcciones, números.** Un detector que solo
 * cuente dígitos rechazaría «el arriendo es de $1.200.000» (siete dígitos seguidos
 * tras quitar los puntos) o «Calle 30 # 12-45». Por eso no se cuenta una longitud
 * cualquiera: se busca la **forma de un número colombiano** —celular `3` + 9 dígitos,
 * o fijo `60` + 8—, que es la misma forma que exige la base para el dato privado.
 * `1.200.000` no la tiene, y `Calle 30 # 12-45` tampoco.
 *
 * `2.` **El número puede venir partido por espacios, puntos, guiones o paréntesis.**
 * Se quitan **esos** separadores —y solo esos— antes de buscar, para que
 * `300 123 4567` y `300.123.4567` se vean igual que `3001234567`. No se quitan comas
 * ni letras: eso pegaría números que están en frases distintas y el detector acabaría
 * inventando teléfonos donde no hay ninguno.
 */

export type ClaseDeContacto = "telefono" | "enlace" | "invitacion";

export interface Hallazgo {
  clase: ClaseDeContacto;
  /** Lo que se encontró, para que la persona sepa qué borrar. */
  muestra: string;
}

export const AYUDA_SIN_CONTACTO =
  "El contacto con los estudiantes lo lleva Nido: no escribas teléfonos, enlaces ni frases como «escríbeme al…».";

/**
 * Un enlace, en cualquiera de sus formas.
 *
 * El dominio suelto entra a propósito: `wa.me` o `mipension.com` no llevan esquema y
 * son justo la forma en que se escribe un enlace para esquivar un filtro.
 */
const PATRON_ENLACE =
  /https?:\/\/|www\.|\b[\w-]+\.(?:com|co|net|org|me|info|link|xyz|app|store|shop|online|site)\b/i;

/**
 * Una invitación a continuar por fuera.
 *
 * Se exige el posesivo o el verbo en imperativo —«mi WhatsApp», «escríbeme»— y no la
 * palabra suelta. `teléfono` a secas aparece en frases legítimas («no hay teléfono
 * fijo en la casa»), y una regla que rechaza eso enseña al anfitrión a desconfiar de
 * la revisión en lugar de a cumplirla.
 */
const PATRON_INVITACION =
  /escr[íi]beme|escribeme|ll[áa]mame|llamame|cont[áa]ctame|contactame|mi\s+(?:whatsapp|wasap|wpp|celular|cel|tel[eé]fono|n[uú]mero|correo)|te\s+paso\s+mi|te\s+doy\s+mi|@/i;

/** La forma colombiana, la misma que exige `contacto_anfitrion` para el dato privado. */
const PATRON_TELEFONO = /(?:^|\D)(?:57)?(3\d{9}|60\d{8})(?:\D|$)/;

/**
 * Los separadores que sí se pueden quitar sin inventar teléfonos.
 *
 * Espacio, punto, guion y paréntesis son la puntuación con la que se escribe un
 * número. Una coma o un salto de línea separan ideas distintas.
 */
const SEPARADORES_DE_TELEFONO = /[\s.\-()]/g;

const ETIQUETA_DE_CLASE: Record<ClaseDeContacto, string> = {
  telefono: "un número de teléfono",
  enlace: "un enlace",
  invitacion: "una invitación a escribirte por fuera",
};

/** Une una lista en la forma en que se dice en español: «a, b y c». */
function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/**
 * Qué se encontró en un texto.
 *
 * Las tres clases se buscan **siempre**, sin interruptores por campo. La primera
 * versión de este módulo tenía una opción para desactivar el detector de teléfonos
 * en los campos «que llevan cifras» —la dirección, el barrio—, y se retiró al
 * medirla: la dirección se publica, así que apagar ahí el detector dejaba la misma
 * puerta abierta que este módulo existe para cerrar. Y el falso positivo que se
 * temía no aparece, porque no se cuenta una longitud cualquiera: hacen falta **diez
 * dígitos** con la forma colombiana (`3` + 9 o `60` + 8), y eso no lo produce una
 * dirección (`Calle 30 # 12-45`) ni un precio (`$1.200.000`).
 *
 * Una sola regla, además, es una regla que se puede explicar y probar entera.
 */
export function hallazgosDeTextoLibre(texto: string): Hallazgo[] {
  if (!texto) return [];
  const hallazgos: Hallazgo[] = [];

  const compacto = texto.replace(SEPARADORES_DE_TELEFONO, "");
  const numero = PATRON_TELEFONO.exec(compacto);
  if (numero) hallazgos.push({ clase: "telefono", muestra: numero[1] });

  const enlace = PATRON_ENLACE.exec(texto);
  if (enlace) hallazgos.push({ clase: "enlace", muestra: enlace[0] });

  const invitacion = PATRON_INVITACION.exec(texto);
  if (invitacion) hallazgos.push({ clase: "invitacion", muestra: invitacion[0].trim() });

  return hallazgos;
}

/** ¿Hay algo que desvíe el contacto en este texto? */
export function tieneContactoOculto(texto: string): boolean {
  return hallazgosDeTextoLibre(texto).length > 0;
}

/**
 * El mensaje de error de un campo, o nada si el campo está limpio.
 *
 * Se nombra el campo y se enseña **qué** se encontró: un «no se permite» sin decir
 * dónde deja al anfitrión releyendo su texto a ciegas, y lo más probable es que
 * vuelva a enviarlo igual.
 */
export function revisarTextoLibre(nombreDelCampo: string, texto: string): string[] {
  const hallazgos = hallazgosDeTextoLibre(texto);
  if (hallazgos.length === 0) return [];

  const clases = enumerar([...new Set(hallazgos.map((hallazgo) => ETIQUETA_DE_CLASE[hallazgo.clase]))]);
  return [
    `${nombreDelCampo}: contiene ${clases} («${hallazgos[0].muestra}»). ${AYUDA_SIN_CONTACTO}`,
  ];
}
