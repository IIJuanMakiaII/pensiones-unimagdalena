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
