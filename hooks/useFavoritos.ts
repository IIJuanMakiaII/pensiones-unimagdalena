"use client";

import { useCallback, useEffect, useState } from "react";
import { alternarFavorito, EVENTO_FAVORITOS, leerFavoritos } from "@/lib/favoritos";

interface Resultado {
  favoritos: string[];
  esFavorito: (id: string) => boolean;
  alternar: (id: string) => void;
  total: number;
}

/**
 * Estado compartido de favoritos. Escucha el evento `favoritos-cambiaron` para
 * que todas las tarjetas visibles se actualicen a la vez (y también entre
 * pestañas abiertas, mediante el evento `storage`).
 */
export function useFavoritos(): Resultado {
  const [favoritos, setFavoritos] = useState<string[]>([]);

  useEffect(() => {
    const sincronizar = () => setFavoritos(leerFavoritos());

    sincronizar();
    window.addEventListener(EVENTO_FAVORITOS, sincronizar);
    window.addEventListener("storage", sincronizar);

    return () => {
      window.removeEventListener(EVENTO_FAVORITOS, sincronizar);
      window.removeEventListener("storage", sincronizar);
    };
  }, []);

  const alternar = useCallback((id: string) => {
    setFavoritos(alternarFavorito(id));
  }, []);

  const esFavorito = useCallback((id: string) => favoritos.includes(id), [favoritos]);

  return { favoritos, esFavorito, alternar, total: favoritos.length };
}
