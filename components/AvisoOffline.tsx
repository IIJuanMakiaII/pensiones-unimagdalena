"use client";

import { useEffect, useState } from "react";

/**
 * Aviso de "Sin conexión": el service worker sirve la interfaz desde la caché
 * (fuentes, estilos e imágenes ya visitadas), así que en lugar de un error del
 * navegador el estudiante ve la app con este aviso.
 */
export default function AvisoOffline() {
  const [sinConexion, setSinConexion] = useState(false);

  useEffect(() => {
    const actualizar = () => setSinConexion(!navigator.onLine);

    actualizar();
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);

    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  if (!sinConexion) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-secondary-900 px-4 py-2 text-center text-xs font-semibold text-secondary-50"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
        <path d="M3 3l18 18" />
        <path d="M8.5 16.5a5 5 0 0 1 7 0" />
        <path d="M5 12.9a10 10 0 0 1 3.5-2.2" />
        <path d="M15.5 10.7A10 10 0 0 1 19 12.9" />
        <path d="M12 20h.01" />
      </svg>
      Sin conexión: estás viendo la última versión guardada
    </div>
  );
}
