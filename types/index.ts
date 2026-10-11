// Contrato de datos v2 — integración dinámica con Supabase.
//
// Amplía el contrato del Agente 1 con el modelo de usuario y los campos del
// esquema solicitado. Se conservan los campos de experiencia que el catálogo,
// los filtros y los sellos de confianza ya utilizan (distancia a pie,
// calificación, verificación, barrio, normas): quitarlos rompería funciones
// que el producto ya ofrece.

export type TipoHabitacion = "individual" | "compartida" | "matrimonial";

export type GeneroHabitacion = "mixto" | "femenino" | "masculino";

/**
 * Perfiles de la plataforma.
 *
 * `maestro` es el perfil de administración (tarea #34): ve todas las
 * publicaciones —retiradas incluidas—, cambia su disponibilidad, edita su
 * contenido y las borra. Lo concede la base por SQL (`update public.usuarios set
 * rol = 'maestro'`); el registro público solo admite `estudiante` y `anfitrion`.
 */
export type RolUsuario = "estudiante" | "anfitrion" | "maestro";

/** Usuario de la plataforma. `id` es el mismo de `auth.users`. */
export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  creado_en: Date;
}

export interface Pension {
  // --- Esquema solicitado (fuente de verdad en la base de datos) ---
  /** Clave primaria (UUID). Identidad interna e inmutable. */
  id: string;
  /**
   * Dirección pública del anuncio: `/pensiones/<slug>`, en minúsculas y sin
   * acentos (`residencia-makia`).
   *
   * Es única, legible y **estable**: no cambia al editar el título, porque una
   * URL ya compartida por WhatsApp no puede morir porque el dueño corrija el
   * nombre. Se asigna una sola vez, al publicar (disparador
   * `antes_de_asignar_slug`), y el anfitrión no puede escribirla.
   *
   * En la semilla de demostración coincide con el `id`, que ya era legible.
   */
  slug: string;
  anfitrion_id: string; // FK -> usuarios.id (auth.users.id)
  titulo: string;
  descripcion: string;
  precioMensual: number; // COP entero; precio de referencia si no hay habitaciones
  direccion: string;
  servicios: string[];
  imagenes: string[]; // la primera es la imagen principal
  activa: boolean;
  creada_en: Date;

  // --- Campos de experiencia que la interfaz ya usa ---
  barrio: string;
  distancia_a_pie_minutos: number;
  normas: string[];
  /**
   * Puntaje INTERNO del equipo (0–5, un decimal), resultante de la inspección
   * presencial. NO son reseñas de usuarios: por eso nunca se declara como
   * `aggregateRating` en el JSON-LD (ver app/pensiones/[id]/page.tsx).
   * Cuando existan reseñas reales, se añadirá un campo aparte (p. ej. `resenas`).
   */
  calificacion: number;
  verificado: boolean;
  /**
   * Cuándo la plataforma REGISTRÓ la verificación (Oleada 13, tarea #61).
   *
   * Lo sella la base, no la interfaz: el disparador `sellar_fecha_verificacion`
   * escribe el instante en que `verificado` pasa a `true`, y lo borra cuando el
   * sello se retira. Ningún llamante puede enviar una fecha —ni el anfitrión ni
   * el maestro—, así que una fecha aquí es siempre una fecha registrada de
   * verdad.
   *
   * Opcional y anulable a propósito, y las dos cosas significan algo distinto:
   *   · `null` es «verificado, pero sin constancia de cuándo». Es el estado
   *     honesto de los anuncios que ya estaban verificados antes de que esta
   *     columna existiera, y NO se rellena con una fecha inventada. Antes un
   *     sello sin fecha que una fecha falsa. La interfaz debe decir «Verificado
   *     por Nido ✓» a secas, no un guion ni «fecha desconocida».
   *   · Opcional para que la semilla de demostración y cualquier objeto literal
   *     sigan compilando sin declararlo. Ninguna pantalla puede dar por hecho
   *     que venga informado.
   *
   * Se llama `verificado_en` y no `verificadoEn` por coherencia con el resto de
   * este contrato y con la interfaz que ya lo consume: los campos que vienen de
   * la base conservan aquí su nombre de columna (`creada_en`, `anfitrion_id`,
   * `distancia_a_pie_minutos`), y `components/CardPension.tsx` ya lee
   * `pension.verificado_en`. Un nombre en camelCase habría compilado igual y el
   * dato no habría llegado nunca al sello, en silencio: es justo el fallo que
   * esta tarea existe para evitar.
   */
  verificado_en?: Date | null;
  /*
   * Aquí vivían `whatsapp` (el número del dueño) y `autorizacion_contacto_en`
   * (la fecha en que autorizó publicarlo). Se retiraron el 2026-10-02, cuando el
   * contacto pasó a la plataforma: el número del anfitrión ya no se publica y
   * **no debe existir en el modelo de la aplicación**.
   *
   * Retirarlos del tipo no es cosmética: es lo que impide que el número vuelva a
   * viajar al navegador. Todo anuncio que se pase a un componente de cliente se
   * serializa en el HTML de la página, así que un campo que existe acaba
   * publicado aunque nadie lo pinte. Sin campo, no hay nada que serializar.
   *
   * La columna sigue en la base —hay anuncios antiguos con número—, pero la
   * aplicación ya no la lee ni la escribe.
   */

  // --- Ubicación exacta (opcional): si existe, el mapa muestra el pin real ---
  latitud?: number | null;
  longitud?: number | null;
}

export interface Habitacion {
  id: string;
  pension_id: string;
  tipo: TipoHabitacion;
  genero: GeneroHabitacion;
  precio_mensual_cop: number; // COP entero, ej. 850000
  alimentacion_incluida: boolean;
  disponible: boolean;
}

/** Pensión con sus habitaciones: formato que consumen catálogo y filtros. */
export interface PensionConHabitaciones extends Pension {
  habitaciones: Habitacion[];
}

export interface Filtros {
  precioMaximoCop: number; // 0 = sin tope
  genero: GeneroHabitacion | "todos";
  soloConAlimentacion: boolean;
  soloVerificadas: boolean;
}

/**
 * Tramos de distancia a pie.
 *
 * Cuatro tramos que **parten el rango sin huecos ni solapes**: `≤5` · `6–10` ·
 * `11–15` · `>15`. Antes eran tres y el último cerraba en 15, así que cualquier
 * anuncio a más de quince minutos no encajaba en ningún tramo concreto: elegir
 * distancia dejaba fuera lo que el propio catálogo admite (el formulario acepta
 * hasta 60 min). El tramo abierto final cierra ese agujero.
 *
 * POR QUÉ LA FRONTERA DEL 5 CAMBIÓ (ronda de auditoría)
 * ----------------------------------------------------
 * Los rótulos anteriores eran `< 5` y `5–10`, y quien los leía no tenía forma de
 * saber de quién era el 5: el tramo se llamaba «5–10» pero su frontera inferior era
 * un 4, y el primero se llamaba `<5` excluyendo justo el 5 que anunciaba el
 * siguiente. Ahora cada rótulo dice **el rango que de verdad aplica**: `≤ 5` (el 5
 * pertenece al primero) y `6–10` (empieza en 6). Con eso se lee sin conocer el
 * motor, que es de lo que se trata.
 *
 * Consecuencia asumida y dicha en voz alta: **el minuto 5 pasó del segundo tramo al
 * primero**. Es un cambio de comportamiento, no solo de rótulo.
 *
 * EL NOMBRE VIAJA EN LA DIRECCIÓN (`?dist=…`)
 * ------------------------------------------
 * Los valores son ASCII y seguros en una cadena de consulta. Un `>` se codifica
 * como `%3E` al serializar y se lee igual sin codificar; un `≤` obligaría a llevar
 * `%E2%89%A4` en la barra de direcciones. Lo que **no** puede aparecer es un `+`: se
 * decodifica como espacio (`new URLSearchParams("dist=15+").get("dist")` devuelve
 * `"15 "`), de modo que un enlace escrito a mano perdería el filtro en silencio.
 */
export type RangoDistancia = "cualquiera" | "hasta5" | "6-10" | "11-15" | "mas15";

/**
 * Habitación tal como la captura el editor antes de guardarse.
 *
 * No lleva `id` ni `pension_id`: los asigna la base de datos al crear la
 * pensión con sus habitaciones en una sola transacción.
 */
export interface EntradaHabitacion {
  tipo: TipoHabitacion;
  genero: GeneroHabitacion;
  precio_mensual_cop: number;
  alimentacion_incluida: boolean;
  disponible: boolean;
}

/**
 * Habitación capturada al **editar** un anuncio ya publicado.
 *
 * Conserva el `id` de la habitación existente (ausente si es nueva), que es lo
 * que permite actualizarla en lugar de borrarla y volver a crearla: así no se
 * pierde su estado de disponibilidad.
 */
export interface EntradaHabitacionEditada extends EntradaHabitacion {
  id?: string;
}

/**
 * Datos que captura el formulario de publicación (server action).
 *
 * No incluye `precioMensual`: el precio de la pensión se deriva de la
 * habitación disponible más barata (`sincronizar_precio_pension`), para que la
 * tarjeta del catálogo y el filtro de precio nunca se contradigan.
 */
export interface EntradaPension {
  titulo: string;
  descripcion: string;
  direccion: string;
  barrio: string;
  distanciaAPieMinutos: number;
  servicios: string[];
  normas: string[];
  imagenes: string[];
  /** Al menos una; los estudiantes filtran por tipo, género y alimentación. */
  habitaciones: EntradaHabitacion[];
}
