"use client";

import L from "leaflet";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Coordenadas del campus de la Universidad del Magdalena
 * (Carrera 32 #22-08, Sector San Pedro Alejandrino, Santa Marta).
 * Fuente: es.wikipedia.org/wiki/Universidad_del_Magdalena (11°13′18″N 74°11′10″O)
 */
export const CAMPUS: [number, number] = [11.22157, -74.1862];

/** Velocidad de caminata urbana: ~4,5 km/h ≈ 75 metros por minuto. */
const METROS_POR_MINUTO = 75;

interface Props {
  titulo: string;
  barrio: string;
  minutos: number;
  /** Coordenadas exactas, cuando el anfitrión las haya indicado. */
  latitud?: number | null;
  longitud?: number | null;
}

/** Pin propio con estilos en línea: evita el problema clásico del icono roto de Leaflet. */
function pin(color: string, texto: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:${color};color:#fff;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)">${texto}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export default function MapaLeaflet({ titulo, barrio, minutos, latitud, longitud }: Props) {
  const tieneCoordenadas = typeof latitud === "number" && typeof longitud === "number";
  const puntoPension: [number, number] = tieneCoordenadas
    ? [latitud as number, longitud as number]
    : CAMPUS;

  const centro: [number, number] = tieneCoordenadas
    ? [(CAMPUS[0] + puntoPension[0]) / 2, (CAMPUS[1] + puntoPension[1]) / 2]
    : CAMPUS;

  const radioMetros = Math.max(150, Math.round(minutos * METROS_POR_MINUTO));

  return (
    <MapContainer
      center={centro}
      zoom={tieneCoordenadas ? 14 : 15}
      scrollWheelZoom={false}
      className="h-72 w-full rounded-2xl"
      aria-label={`Mapa de ubicación de ${titulo} respecto a la Universidad del Magdalena`}
    >
      <TileLayer
        attribution='&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Marker position={CAMPUS} icon={pin("#325334", "U")}>
        <Popup>Universidad del Magdalena — campus principal</Popup>
      </Marker>

      {tieneCoordenadas ? (
        <>
          <Marker position={puntoPension} icon={pin("#E16118", "P")}>
            <Popup>
              {titulo} — {barrio}
            </Popup>
          </Marker>
          <Polyline
            positions={[CAMPUS, puntoPension]}
            pathOptions={{ color: "#325334", weight: 3, dashArray: "6 8" }}
          />
        </>
      ) : (
        <Circle
          center={CAMPUS}
          radius={radioMetros}
          pathOptions={{ color: "#E16118", weight: 2, fillColor: "#E16118", fillOpacity: 0.12 }}
        >
          <Popup>
            Zona a ~{minutos} minutos a pie del campus (≈ {radioMetros} m). La dirección
            exacta la confirma el anfitrión.
          </Popup>
        </Circle>
      )}
    </MapContainer>
  );
}
