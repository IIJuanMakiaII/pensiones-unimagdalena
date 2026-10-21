import type { GeneroHabitacion, Habitacion, PensionSinContacto, TipoHabitacion } from "@/types";

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

/**
 * ¿Se puede ofrecer WhatsApp de verdad? (tarea #59)
 *
 * `WHATSAPP_CONFIGURADO` responde a «¿llegó un valor?», que no es lo mismo que
 * «¿ese valor sirve?». Faltaba la segunda pregunta, y su ausencia era el
 * agujero: con la variable ausente, vacía o con el número de ejemplo,
 * `WHATSAPP_NUMERO` devolvía un número **inexistente** y los botones de contacto
 * lo usaban sin que nada lo dijera. El canal único de captación quedaba
 * apuntando a la nada.
 *
 * En un despliegue de Vercel eso no llega a ocurrir —`app/layout.tsx` detiene la
 * compilación—, pero el resto de los entornos sí lo permitía. Y aquel guardián
 * protege el despliegue, no al visitante: esto completa la comprobación dentro
 * de la aplicación, que es donde el fallo se convierte en un estudiante que
 * escribe y no le contesta nadie.
 *
 * No cambia `WHATSAPP_NUMERO` a propósito. Ese valor sigue cayendo al número de
 * ejemplo, porque el guardián de `app/layout.tsx` decide si detiene una
 * compilación comparándolo con `NUMERO_DE_EJEMPLO`: si aquí se devolviera una
 * cadena vacía, la protección del despliegue dejaría de dispararse.
 */
export type MotivoSinWhatsApp = "sin_configurar" | "invalido" | "ejemplo";

export interface EstadoCanalWhatsApp {
  /** Solo `true` si hay un número real al que escribir. */
  disponible: boolean;
  /** Por qué no está disponible. `null` cuando sí lo está. */
  motivo: MotivoSinWhatsApp | null;
}

/**
 * La decisión, como función pura.
 *
 * Recibe el valor crudo en lugar de leerlo del entorno para que se pueda probar
 * entera. Una variable de entorno se lee una sola vez, al cargar el módulo, así
 * que sin esto los cuatro casos —ausente, vacía, inválida y de ejemplo— quedarían
 * fuera de las pruebas, que es justo donde vivía el fallo.
 */
export function estadoDelCanalWhatsApp(crudo: string | null | undefined): EstadoCanalWhatsApp {
  if (typeof crudo !== "string" || crudo.trim() === "") {
    return { disponible: false, motivo: "sin_configurar" };
  }
  const normalizado = normalizarNumeroWhatsApp(crudo);
  if (!numeroWhatsAppValido(normalizado)) return { disponible: false, motivo: "invalido" };
  if (normalizado === NUMERO_DE_EJEMPLO) return { disponible: false, motivo: "ejemplo" };
  return { disponible: true, motivo: null };
}

/** Estado del canal con el valor real de este despliegue. */
export const ESTADO_WHATSAPP = estadoDelCanalWhatsApp(NUMERO_CRUDO);

/**
 * El canal sirve o no sirve. Todo lo que dibuje un botón de contacto tiene que
 * preguntar esto antes y ofrecer el respaldo cuando sea `false`.
 */
export const WHATSAPP_DISPONIBLE = ESTADO_WHATSAPP.disponible;

/**
 * El número tal como se lee en pantalla: «+57 302 642 9730» (tarea #125).
 *
 * Existe para que la tarjeta «Quién está detrás» pueda enseñar el WhatsApp de la
 * plataforma como texto del enlace y no solo como una palabra. Sigue saliendo de
 * la variable de entorno: aquí no hay ningún número escrito a mano.
 *
 * Devuelve `null` cuando el canal no sirve —variable ausente, inválida o el número
 * de ejemplo—, para que quien llame dibuje el formulario de respaldo en lugar de
 * publicar un número al que no contesta nadie. No cae al número de ejemplo a
 * propósito, por lo mismo que `WHATSAPP_DISPONIBLE`.
 */
export function numeroWhatsAppVisible(): string | null {
  if (!WHATSAPP_DISPONIBLE) return null;
  return `+${WHATSAPP_NUMERO.replace(/^(\d{1,3})(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3 $4")}`;
}

/** Formulario de respaldo. Una sola constante: la comparten la app y las pruebas. */
export const RUTA_CONTACTO = "/contacto";

/**
 * Correo de respaldo del canal de contacto (tarea #59). Opcional.
 *
 * Si nadie lo configura, la página simplemente no ofrece esa vía; no se deja un
 * correo escrito en el código. Sería exactamente el error que esta tarea corrige
 * con el número de WhatsApp: un dato del negocio dentro del programa, que cambia
 * sin que el código cambie y que nadie encuentra el día que hay que cambiarlo.
 */
export const CORREO_CONTACTO = (process.env.NEXT_PUBLIC_CORREO_CONTACTO ?? "").trim();

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

/**
 * Formatea la fecha de una reserva tal como la devuelve la base
 * (`marcar_habitacion_reservada` → `timestamptz`): «21 de octubre de 2026, 4:12 p. m.».
 *
 * POR QUÉ LLEVA LA HORA
 * ---------------------
 * Una reserva se decide el mismo día en que se confirma el pago por fuera de la
 * plataforma. Con solo el día, dos reservas del mismo día son indistinguibles y no
 * se puede reconstruir el orden en que llegaron. La hora es el dato que hace la
 * fecha utilizable cuando hay que resolver un cruce.
 *
 * ZONA HORARIA
 * ------------
 * `America/Bogota`, por lo mismo que el sello de verificación (`lib/sello.ts`): la
 * columna es `timestamptz` y se guarda en UTC, así que una reserva de las 20:00 en
 * Santa Marta ya es el día siguiente en UTC. Formatear con la zona del servidor
 * —que en Vercel es UTC— mostraría un día que no es el de nadie.
 *
 * FALLA CERRADO
 * -------------
 * Solo acepta un `Date` o una cadena ISO no vacía. Cualquier otra cosa devuelve
 * `null`, que significa «no hay fecha que enseñar». Una fecha inventada al lado de
 * una habitación reservada es peor que ninguna: el maestro la leería como un hecho.
 */
export function formatearFechaReserva(valor: unknown): string | null {
  const fecha =
    valor instanceof Date
      ? valor
      : typeof valor === "string" && valor.trim() !== ""
        ? new Date(valor)
        : null;

  if (fecha === null || Number.isNaN(fecha.getTime())) return null;

  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(fecha);
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
export function mensajeWhatsApp(pension: PensionSinContacto, habitacion?: Habitacion): string {
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

/**
 * El enlace de contacto, por el canal que hoy funciona.
 *
 * Con WhatsApp disponible devuelve el `wa.me` de siempre, idéntico al de antes.
 * Sin él **no devuelve un `wa.me` al número de ejemplo**: devuelve la ruta del
 * formulario de respaldo, llevándose en la consulta el anuncio que la persona
 * estaba mirando para que no tenga que volver a explicarlo.
 *
 * La decisión vive aquí, y no en cada botón, por un motivo concreto: los botones
 * de contacto los dibujan tres componentes distintos y solo dos son de esta
 * tarea. Repetir la condición en cada uno habría dejado sin arreglar justo el
 * que quedara fuera. Esta es la única puerta.
 */
function enlaceDeContacto(mensaje: string, contexto: Record<string, string>): string {
  if (WHATSAPP_DISPONIBLE) {
    return `https://wa.me/${numeroDeReserva()}?text=${encodeURIComponent(mensaje)}`;
  }
  const consulta = new URLSearchParams({
    motivo: ESTADO_WHATSAPP.motivo ?? "sin_configurar",
    ...contexto,
  });
  return `${RUTA_CONTACTO}?${consulta.toString()}`;
}

/** Enlace de contacto de un anuncio: WhatsApp si sirve, formulario de respaldo si no. */
export function enlaceWhatsApp(pension: PensionSinContacto, habitacion?: Habitacion): string {
  return enlaceDeContacto(mensajeWhatsApp(pension, habitacion), {
    pension: pension.slug,
    ...(habitacion ? { habitacion: habitacion.id } : {}),
  });
}

/**
 * Enlace de contacto general, sin anuncio (el del pie de página).
 *
 * Existe para que el pie deje de componer su propio `wa.me` a mano: dos sitios
 * construyendo el mismo enlace es exactamente la forma en que el número de
 * ejemplo se quedaba vivo en uno de los dos.
 */
export function enlaceWhatsAppPlataforma(
  mensaje: string = "Hola, quiero información sobre Nido."
): string {
  return enlaceDeContacto(mensaje, { origen: "pie" });
}

/**
 * Los atributos de apertura que corresponden a un enlace de contacto.
 *
 * Los botones abren WhatsApp en una pestaña nueva desde siempre. El día que el
 * canal falla, ese mismo `target="_blank"` se queda puesto sobre una página del
 * propio sitio, y abrir Nido en otra pestaña sin avisar desconcierta a quien
 * navega con lector de pantalla. Aquí se decide por el enlace y no por el botón,
 * que es el único sitio desde el que se puede decidir bien.
 */
export function atributosDeContacto(href: string): { target?: string; rel?: string } {
  return /^https?:\/\//i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {};
}
