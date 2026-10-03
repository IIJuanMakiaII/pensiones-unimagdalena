"use client";

import { track } from "@vercel/analytics";

/**
 * Medición del embudo, centralizada y tolerante a fallos.
 *
 * **Decisión: Vercel Analytics**, y el motivo es concreto — **no usa cookies ni
 * almacenamiento en el dispositivo**, así que mide sin banner de consentimiento
 * y sin tratar datos personales: solo se envía el identificador del anuncio, que
 * no identifica a ninguna persona. Cualquier alternativa con cookies habría
 * obligado a un aviso previo y a bloquear la medición hasta aceptarlo, justo en
 * el primer día de uso.
 *
 * No necesita ninguna clave del proyecto: se activa al desplegar en Vercel. Fuera
 * de Vercel no envía nada, y la alternativa (Cloudflare Web Analytics, que sí
 * pide un token) está documentada en `docs/medicion-y-buscadores.md`.
 */

/** Envoltorio: la medición nunca puede interrumpir a un estudiante navegando. */
function enviar(evento: string, datos: Record<string, string | number | boolean>) {
  try {
    track(evento, datos);
  } catch {
    /* silencio a propósito */
  }
}

/** Filtros usados en el catálogo: el inicio del embudo. */
export function medirFiltros(datos: {
  precio_maximo: number;
  genero: string;
  distancia: string;
  alimentacion: boolean;
  solo_verificadas: boolean;
  solo_favoritas: boolean;
  /** Criterio de orden elegido (M-24). Saber si se usa dice si el control sirve. */
  orden?: string;
  /** Habitaciones reservables con los filtros puestos: la oferta real que vio. */
  habitaciones_libres?: number;
  resultados: number;
}) {
  enviar("filtros_aplicados", datos);
}

/** Visita a la ficha de un anuncio. */
export function medirVerFicha(datos: { pension: string; tiene_libres: boolean }) {
  enviar("ver_ficha", datos);
}

/**
 * Contacto generado: el clic que abre WhatsApp.
 *
 * El evento se llamaba `contacto_whatsapp` y llevaba un campo `propio` que
 * distinguía si el mensaje iba al dueño del anuncio o al respaldo de la
 * plataforma. Desde el cambio de modelo del 2026-10-02 **todos los contactos los
 * atiende la plataforma**, así que esa distinción ya no existe: el embudo se
 * conserva con los mismos pasos, sin el campo que dejó de significar algo.
 */
export function medirContacto(datos: {
  pension: string;
  origen: "tarjeta" | "ficha" | "barra_movil";
  con_habitacion: boolean;
}) {
  enviar("contacto_plataforma", datos);
}

/** Un anfitrión publicó un anuncio nuevo. */
export function medirPublicacion(datos: { habitaciones: number; fotos: number }) {
  enviar("publicacion_creada", datos);
}
