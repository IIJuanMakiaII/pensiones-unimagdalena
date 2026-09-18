"use client";

import dynamic from "next/dynamic";

/**
 * Envoltorio del mapa: Leaflet necesita `window`, así que se carga solo en el
 * navegador (`ssr: false`) y no bloquea el render del servidor. Mientras carga,
 * se muestra un bloque con `animate-pulse` para no dejar hueco en blanco.
 */
const Mapa = dynamic(() => import("@/components/MapaLeaflet"), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-2xl bg-neutro-200" />,
});

interface Props {
  titulo: string;
  barrio: string;
  minutos: number;
  latitud?: number | null;
  longitud?: number | null;
}

export default function MapaUbicacion(props: Props) {
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-neutro-200">
      <Mapa {...props} />
    </div>
  );
}
