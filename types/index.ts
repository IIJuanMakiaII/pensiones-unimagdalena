// Contrato de datos v2 — integración dinámica con Supabase.
//
// Amplía el contrato del Agente 1 con el modelo de usuario y los campos del
// esquema solicitado. Se conservan los campos de experiencia que el catálogo,
// los filtros y los sellos de confianza ya utilizan (distancia a pie,
// calificación, verificación, barrio, normas): quitarlos rompería funciones
// que el producto ya ofrece.

export type TipoHabitacion = "individual" | "compartida" | "matrimonial";

export type GeneroHabitacion = "mixto" | "femenino" | "masculino";

export type RolUsuario = "estudiante" | "anfitrion";

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
  id: string;
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
   * WhatsApp del anfitrión para esta pensión: **exactamente 10 dígitos**, sin
   * código de país (se añade el 57 al construir el enlace).
   *
   * Opcional a propósito: los anuncios publicados antes de que existiera este
   * campo usan el número de la plataforma como respaldo. Nunca se publica en
   * datos estructurados ni metadatos, solo viaja en el enlace de reserva.
   */
  whatsapp?: string | null;

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
  distanciaMaximaMin: number; // 0 = todas | 5 | 10 | 15
  soloConAlimentacion: boolean;
  soloVerificadas: boolean;
}

export type RangoDistancia = "cualquiera" | "<5" | "5-10" | "10-15";

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
