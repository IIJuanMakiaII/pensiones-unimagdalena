import type { Habitacion, Pension } from "@/types";

/**
 * Catálogo semilla (MODO DEMO).
 *
 * Se usa únicamente cuando Supabase no está configurado, para que el sitio
 * nunca quede vacío ni roto. Con credenciales válidas, los datos provienen de
 * la base de datos (ver lib/datos.ts).
 *
 * 6 pensiones en barrios cercanos a la Universidad del Magdalena (Santa Marta),
 * distancias a pie de 4 a 15 minutos. Imágenes de Unsplash verificadas.
 */

const img = (id: string, w = 900, crop = "entropy") =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80&crop=${crop}`;

/** Anfitrión ficticio que agrupa las publicaciones de ejemplo. */
export const ANFITRION_DEMO = "00000000-0000-0000-0000-000000000001";

export const PENSIONES_SEMILLA: Pension[] = [
  {
    id: "pension-costa-verde",
    anfitrion_id: ANFITRION_DEMO,
    titulo: "Pensión Costa Verde",
    descripcion:
      "Habitaciones amobladas en Mamatoco, a 7 minutos a pie del campus. WiFi de alta velocidad, aire acondicionado y lavandería; agua y energía incluidas. Ambiente de estudio y sin fumadores.",
    precioMensual: 550000,
    direccion: "Barrio Mamatoco, Santa Marta",
    servicios: ["WiFi de alta velocidad", "Aire acondicionado", "Lavandería", "Agua y energía incluidas"],
    imagenes: [
      img("photo-1522708323590-d24dbb6b0267"),
      img("photo-1505693416388-ac5ce068fe85"),
      img("photo-1560185007-cde436f6a4d0"),
    ],
    activa: true,
    creada_en: new Date("2026-02-10T09:00:00Z"),
    barrio: "Mamatoco",
    distancia_a_pie_minutos: 7,
    normas: ["No fumadores", "Silencio después de las 10 p. m.", "Visitas hasta las 8 p. m."],
    calificacion: 4.7,
    verificado: true,
  },
  {
    id: "residencia-el-pando",
    anfitrion_id: ANFITRION_DEMO,
    titulo: "Residencia El Pando",
    descripcion:
      "La opción más cercana al campus: 4 minutos a pie. Cocina compartida con horario, lavandería y servicios incluidos. Habitaciones individuales, compartidas y matrimoniales.",
    precioMensual: 480000,
    direccion: "Barrio El Pando, Santa Marta",
    servicios: ["WiFi", "Cocina compartida", "Lavandería", "Agua y energía incluidas"],
    imagenes: [
      img("photo-1512918728675-ed5a9ecdebfd"),
      img("photo-1586023492125-27b2c045efd7"),
      img("photo-1616486338812-3dadae4b4ace"),
    ],
    activa: true,
    creada_en: new Date("2026-02-12T09:00:00Z"),
    barrio: "El Pando",
    distancia_a_pie_minutos: 4,
    normas: ["No fumadores", "Cocina compartida con horario"],
    calificacion: 4.5,
    verificado: true,
  },
  {
    id: "hogar-santa-marta",
    anfitrion_id: ANFITRION_DEMO,
    titulo: "Hogar Santa Marta",
    descripcion:
      "Alojamiento femenino en Zaragoza, a 10 minutos del campus. Entrada libre 24 horas, lavandería y servicios incluidos. Opción económica en habitación compartida.",
    precioMensual: 450000,
    direccion: "Barrio Zaragoza, Santa Marta",
    servicios: ["WiFi", "Lavandería", "Agua y energía incluidas"],
    imagenes: [img("photo-1560448204-e02f11c3d0e2"), img("photo-1615873968403-89e068629265")],
    activa: true,
    creada_en: new Date("2026-02-15T09:00:00Z"),
    barrio: "Zaragoza",
    distancia_a_pie_minutos: 10,
    normas: ["No fumadores", "Entrada libre 24 h"],
    calificacion: 4.2,
    verificado: false,
  },
  {
    id: "pension-la-marina",
    anfitrion_id: ANFITRION_DEMO,
    titulo: "Pensión La Marina",
    descripcion:
      "En Gaira, a 12 minutos a pie del campus, con tres comidas al día y horario fijo. Aire acondicionado, WiFi de alta velocidad y lavandería. Servicios y alimentación incluidos.",
    precioMensual: 1050000,
    direccion: "Barrio Gaira, Santa Marta",
    servicios: [
      "WiFi de alta velocidad",
      "Aire acondicionado",
      "3 comidas al día",
      "Lavandería",
      "Agua y energía incluidas",
    ],
    imagenes: [
      img("photo-1571508601891-ca5e7a713859"),
      img("photo-1631049307264-da0ec9d70304"),
      img("photo-1505693416388-ac5ce068fe85"),
    ],
    activa: true,
    creada_en: new Date("2026-02-18T09:00:00Z"),
    barrio: "Gaira",
    distancia_a_pie_minutos: 12,
    normas: ["No fumadores", "Horario de comidas fijo", "Visitas los fines de semana"],
    calificacion: 4.8,
    verificado: true,
  },
  {
    id: "casa-estudiantil-san-fernando",
    anfitrion_id: ANFITRION_DEMO,
    titulo: "Casa Estudiantil San Fernando",
    descripcion:
      "Casa de estudiantes en San Fernando, a 8 minutos caminando. Habitaciones para hombres con servicios incluidos y zonas comunes para estudiar.",
    precioMensual: 500000,
    direccion: "Barrio San Fernando, Santa Marta",
    servicios: ["WiFi", "Agua y energía incluidas"],
    imagenes: [
      img("photo-1586023492125-27b2c045efd7"),
      img("photo-1616486338812-3dadae4b4ace"),
      img("photo-1615873968403-89e068629265"),
    ],
    activa: true,
    creada_en: new Date("2026-02-20T09:00:00Z"),
    barrio: "San Fernando",
    distancia_a_pie_minutos: 8,
    normas: ["No fumadores", "Respetar zonas comunes"],
    calificacion: 4.0,
    verificado: false,
  },
  {
    id: "residencias-los-troncos",
    anfitrion_id: ANFITRION_DEMO,
    titulo: "Residencias Los Troncos",
    descripcion:
      "Residencia en Los Troncos, a 15 minutos a pie y bien conectada por transporte. Cocina compartida, lavandería y WiFi de alta velocidad; silencio después de las 11 p. m.",
    precioMensual: 520000,
    direccion: "Barrio Los Troncos, Santa Marta",
    servicios: ["WiFi de alta velocidad", "Lavandería", "Cocina compartida", "Agua y energía incluidas"],
    imagenes: [
      img("photo-1560185007-cde436f6a4d0"),
      img("photo-1631049307264-da0ec9d70304"),
      img("photo-1590490360182-c33d57733427"),
    ],
    activa: true,
    creada_en: new Date("2026-02-22T09:00:00Z"),
    barrio: "Los Troncos",
    distancia_a_pie_minutos: 15,
    normas: ["No fumadores", "Silencio después de las 11 p. m."],
    calificacion: 4.6,
    verificado: true,
  },
];

export const HABITACIONES_SEMILLA: Habitacion[] = [
  // Pensión Costa Verde (Mamatoco)
  { id: "costa-verde-individual-femenino", pension_id: "pension-costa-verde", tipo: "individual", genero: "femenino", precio_mensual_cop: 950000, alimentacion_incluida: true, disponible: true },
  { id: "costa-verde-individual-mixto", pension_id: "pension-costa-verde", tipo: "individual", genero: "mixto", precio_mensual_cop: 850000, alimentacion_incluida: true, disponible: true },
  { id: "costa-verde-compartida-femenino", pension_id: "pension-costa-verde", tipo: "compartida", genero: "femenino", precio_mensual_cop: 550000, alimentacion_incluida: false, disponible: true },
  // Residencia El Pando
  { id: "el-pando-individual-masculino", pension_id: "residencia-el-pando", tipo: "individual", genero: "masculino", precio_mensual_cop: 900000, alimentacion_incluida: false, disponible: true },
  { id: "el-pando-compartida-mixto", pension_id: "residencia-el-pando", tipo: "compartida", genero: "mixto", precio_mensual_cop: 480000, alimentacion_incluida: false, disponible: true },
  { id: "el-pando-matrimonial-mixto", pension_id: "residencia-el-pando", tipo: "matrimonial", genero: "mixto", precio_mensual_cop: 1200000, alimentacion_incluida: true, disponible: true },
  // Hogar Santa Marta (Zaragoza)
  { id: "hogar-santa-marta-individual-femenino", pension_id: "hogar-santa-marta", tipo: "individual", genero: "femenino", precio_mensual_cop: 700000, alimentacion_incluida: false, disponible: true },
  { id: "hogar-santa-marta-compartida-femenino", pension_id: "hogar-santa-marta", tipo: "compartida", genero: "femenino", precio_mensual_cop: 450000, alimentacion_incluida: false, disponible: true },
  // Pensión La Marina (Gaira)
  { id: "la-marina-individual-femenino", pension_id: "pension-la-marina", tipo: "individual", genero: "femenino", precio_mensual_cop: 1100000, alimentacion_incluida: true, disponible: true },
  { id: "la-marina-individual-masculino", pension_id: "pension-la-marina", tipo: "individual", genero: "masculino", precio_mensual_cop: 1050000, alimentacion_incluida: true, disponible: true },
  { id: "la-marina-matrimonial-mixto", pension_id: "pension-la-marina", tipo: "matrimonial", genero: "mixto", precio_mensual_cop: 1350000, alimentacion_incluida: true, disponible: false },
  // Casa Estudiantil San Fernando
  { id: "san-fernando-compartida-masculino", pension_id: "casa-estudiantil-san-fernando", tipo: "compartida", genero: "masculino", precio_mensual_cop: 500000, alimentacion_incluida: false, disponible: true },
  { id: "san-fernando-individual-masculino", pension_id: "casa-estudiantil-san-fernando", tipo: "individual", genero: "masculino", precio_mensual_cop: 780000, alimentacion_incluida: false, disponible: true },
  // Residencias Los Troncos
  { id: "los-troncos-individual-mixto", pension_id: "residencias-los-troncos", tipo: "individual", genero: "mixto", precio_mensual_cop: 820000, alimentacion_incluida: true, disponible: true },
  { id: "los-troncos-compartida-femenino", pension_id: "residencias-los-troncos", tipo: "compartida", genero: "femenino", precio_mensual_cop: 520000, alimentacion_incluida: false, disponible: true },
  { id: "los-troncos-individual-femenino", pension_id: "residencias-los-troncos", tipo: "individual", genero: "femenino", precio_mensual_cop: 880000, alimentacion_incluida: false, disponible: false },
];
