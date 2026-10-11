/**
 * Validación del formulario de respaldo del contacto (tarea #59).
 *
 * Vive fuera del componente por la misma razón que `lib/sello.ts`: el ejecutor
 * de pruebas del proyecto no puede importar un `.tsx` (Node no entiende JSX), y
 * aquí la mitad que importa es justo la que no se ve —qué se rechaza—. Si esta
 * lógica estuviera dentro del formulario, «sin autorización no se envía» quedaría
 * sin comprobar.
 *
 * No valida «antes de enviar» en el navegador: valida **en el servidor**, que es
 * donde una petición hecha a mano no puede saltarse la regla. Lo que el navegador
 * aporta (`required`) es comodidad, no la garantía.
 */

export const LIMITE_NOMBRE = 80;
export const LIMITE_CONTACTO = 120;
export const LIMITE_MENSAJE = 1200;

export interface EntradaContacto {
  nombre: string;
  contacto: string;
  mensaje: string;
  consentimiento: boolean;
}

export type CampoContacto = keyof EntradaContacto;

/**
 * Lo que llega del formulario, sin dar por hecho su forma.
 *
 * Los campos entran como `unknown` a propósito: un `FormData` puede traer un
 * fichero donde se espera texto, y `String(fichero)` devolvería algo plausible
 * en lugar de fallar. Aquí se mira el tipo antes de usarlo.
 */
export interface EntradaContactoCruda {
  nombre?: unknown;
  contacto?: unknown;
  mensaje?: unknown;
  consentimiento?: unknown;
}

export interface ValidacionContacto {
  valido: boolean;
  errores: Partial<Record<CampoContacto, string>>;
  /** El texto ya limpio, que es lo que se guarda y lo que se cuenta como longitud. */
  datos: EntradaContacto;
}

/** Una línea: sin saltos, sin espacios repetidos y sin espacios en los extremos. */
export function limpiarLinea(valor: unknown): string {
  return typeof valor === "string" ? valor.replace(/\s+/g, " ").trim() : "";
}

/**
 * Un mensaje: se conservan los párrafos.
 *
 * Colapsar todo el espacio convertiría un mensaje de tres párrafos en una línea
 * larga. Solo se normalizan los saltos de Windows y se evita la ristra de líneas
 * en blanco, que es lo que deja pegado un texto copiado de otro sitio.
 */
export function limpiarMensaje(valor: unknown): string {
  if (typeof valor !== "string") return "";
  return valor.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * ¿Parece un correo?
 *
 * No pretende validar el estándar entero —ninguna expresión corta lo hace—, sino
 * descartar lo que seguro no lo es: sin arroba, sin dominio, con espacios o con
 * un dominio que no tiene punto. Basta para no guardar un contacto con el que no
 * se puede responder.
 */
export function esCorreoValido(valor: string): boolean {
  return valor.length <= LIMITE_CONTACTO && /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(valor);
}

/**
 * ¿Parece un teléfono?
 *
 * Se cuentan los dígitos y se exige que no haya letras: así `+57 300 123 4567`,
 * `300-1234567` y `(57) 3001234567` pasan, y `+57 300 12 tres` no. El rango de 7
 * a 15 dígitos es el de la recomendación E.164; un número colombiano con el
 * código de país cae en 12.
 */
export function esTelefonoValido(valor: string): boolean {
  if (valor.length > LIMITE_CONTACTO || /[A-Za-z]/.test(valor)) return false;
  return /^\d{7,15}$/.test(valor.replace(/\D/g, ""));
}

export function esContactoValido(valor: string): boolean {
  return esCorreoValido(valor) || esTelefonoValido(valor);
}

/**
 * La regla completa, en un solo sitio.
 *
 * `consentimiento` se compara contra `true` y no contra la veracidad del valor,
 * por lo mismo que `mostrarSello`: una autorización que se cuela sola no es una
 * autorización. Un `"false"` llegado de un formulario manipulado no la concede.
 */
/**
 * Cómo se lee un fallo al guardar (tarea #63).
 *
 * La escritura ya no va contra la tabla sino contra `registrar_contacto_respaldo`,
 * y eso cambia **qué códigos significan «falta aplicar la migración»**. Antes era
 * uno solo (`PGRST205`, tabla ausente); ahora el mismo problema se puede
 * manifestar por cinco vías distintas según qué parte de la migración falte:
 *
 *   · `PGRST202` — PostgREST no encuentra la función en su caché de esquema.
 *   · `42883`    — Postgres: `undefined_function`.
 *   · `PGRST205` — PostgREST no encuentra la tabla.
 *   · `42P01`    — Postgres: `undefined_table`.
 *   · `42501`    — `insufficient_privilege`: la migración corrió pero los permisos
 *                  o las políticas no quedaron como deben.
 *
 * Los cinco los arregla quien despliega, ninguno se arregla reintentando. Por eso
 * van juntos en un mismo resultado y no repartidos entre «avería» y «otra cosa»:
 * lo que el visitante necesita saber es lo mismo en los cinco casos —que use
 * WhatsApp—, y lo que necesita quien despliega es el código exacto, que queda en
 * el registro del servidor.
 */
const CODIGOS_DE_BASE_SIN_PREPARAR = new Set(["PGRST202", "42883", "PGRST205", "42P01", "42501"]);

export type ResultadoDeGuardado = "sin_migracion" | "guardado";

export function clasificarFalloDeGuardado(codigo: string | null | undefined): ResultadoDeGuardado {
  return CODIGOS_DE_BASE_SIN_PREPARAR.has(codigo ?? "") ? "sin_migracion" : "guardado";
}

export function validarSolicitudContacto(entrada: EntradaContactoCruda): ValidacionContacto {
  const datos: EntradaContacto = {
    nombre: limpiarLinea(entrada.nombre),
    contacto: limpiarLinea(entrada.contacto),
    mensaje: limpiarMensaje(entrada.mensaje),
    consentimiento: entrada.consentimiento === true,
  };

  const errores: Partial<Record<CampoContacto, string>> = {};

  if (datos.nombre.length < 2) {
    errores.nombre = "Escribe tu nombre (al menos 2 letras).";
  } else if (datos.nombre.length > LIMITE_NOMBRE) {
    errores.nombre = `El nombre no puede pasar de ${LIMITE_NOMBRE} caracteres.`;
  }

  if (datos.contacto === "") {
    errores.contacto = "Déjanos un correo o un teléfono para poder responderte.";
  } else if (!esContactoValido(datos.contacto)) {
    errores.contacto = "Ese correo o teléfono no parece válido. Revísalo, por favor.";
  }

  if (datos.mensaje.length > LIMITE_MENSAJE) {
    errores.mensaje = `El mensaje no puede pasar de ${LIMITE_MENSAJE} caracteres.`;
  }

  if (!datos.consentimiento) {
    errores.consentimiento = "Necesitamos tu autorización para tratar tus datos.";
  }

  return { valido: Object.keys(errores).length === 0, errores, datos };
}
