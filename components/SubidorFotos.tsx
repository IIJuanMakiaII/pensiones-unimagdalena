"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { crearClienteNavegador } from "@/utils/supabase/client";
import {
  AYUDA_IMAGENES,
  BUCKET_FOTOS,
  hostImagenPermitido,
  MAXIMO_FOTOS,
  TAMANO_MAXIMO_FOTO,
} from "@/lib/imagenes";

interface Props {
  /** URLs finales (subidas + pegadas) que se envían al servidor. */
  valor: string[];
  onChange: (urls: string[]) => void;
  maximo?: number;
}

/**
 * Reduce y reconvierte la foto a JPEG en el propio navegador.
 * Una foto de celular de 5–8 MB baja a ~300–600 KB: sube mucho más rápido con
 * datos móviles y la página carga ligera. También convierte HEIC de iPhone.
 */
async function prepararFoto(archivo: File): Promise<Blob> {
  const mapa = await createImageBitmap(archivo);
  const ladoMayor = Math.max(mapa.width, mapa.height);
  const escala = Math.min(1, 1600 / ladoMayor);
  const ancho = Math.round(mapa.width * escala);
  const alto = Math.round(mapa.height * escala);

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;

  const contexto = lienzo.getContext("2d");
  if (!contexto) return archivo;

  contexto.drawImage(mapa, 0, 0, ancho, alto);
  if ("close" in mapa) mapa.close();

  const comprimida = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, "image/jpeg", 0.82)
  );

  return comprimida ?? archivo;
}

/**
 * Subida de fotos desde el dispositivo (computador o celular).
 * Sube directo a Supabase Storage con la sesión del anfitrión; las políticas RLS
 * solo permiten escribir en su propia carpeta.
 */
export default function SubidorFotos({ valor, onChange, maximo = MAXIMO_FOTOS }: Props) {
  const entradaRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enlace, setEnlace] = useState("");

  const disponibles = Math.max(0, maximo - valor.length);

  const subir = async (archivos: File[]) => {
    if (archivos.length === 0) return;
    setError(null);

    if (disponibles === 0) {
      setError(`Ya alcanzaste el máximo de ${maximo} fotos. Quita alguna para subir otra.`);
      return;
    }

    setSubiendo(true);
    const cliente = crearClienteNavegador();
    const { data } = await cliente.auth.getUser();
    const usuario = data.user;

    if (!usuario) {
      setSubiendo(false);
      setError("Tu sesión expiró. Vuelve a iniciar sesión para subir fotos.");
      return;
    }

    const subidas: string[] = [];
    const problemas: string[] = [];
    const lote = archivos.slice(0, disponibles);

    for (const [indice, archivo] of lote.entries()) {
      setProgreso(`Subiendo ${indice + 1} de ${lote.length}…`);
      try {
        const preparada = await prepararFoto(archivo);

        if (preparada.size > TAMANO_MAXIMO_FOTO) {
          problemas.push(`${archivo.name}: supera 5 MB incluso comprimida`);
          continue;
        }

        const ruta = `${usuario.id}/${Date.now()}-${crypto.randomUUID()}.jpg`;
        const { error: errorSubida } = await cliente.storage
          .from(BUCKET_FOTOS)
          .upload(ruta, preparada, { contentType: "image/jpeg", upsert: false });

        if (errorSubida) {
          problemas.push(`${archivo.name}: ${errorSubida.message}`);
          continue;
        }

        const { data: publica } = cliente.storage.from(BUCKET_FOTOS).getPublicUrl(ruta);
        subidas.push(publica.publicUrl);
      } catch {
        problemas.push(`${archivo.name}: no se pudo leer (usa JPG, PNG o WebP)`);
      }
    }

    setSubiendo(false);
    setProgreso("");
    if (subidas.length > 0) onChange([...valor, ...subidas].slice(0, maximo));
    if (problemas.length > 0) setError(problemas.join(" · "));
    if (entradaRef.current) entradaRef.current.value = "";
  };

  const agregarEnlace = () => {
    const url = enlace.trim();
    if (!url) return;

    if (!hostImagenPermitido(url)) {
      setError(`Ese enlace no está permitido. ${AYUDA_IMAGENES}`);
      return;
    }
    if (valor.includes(url)) {
      setEnlace("");
      return;
    }

    onChange([...valor, url].slice(0, maximo));
    setEnlace("");
    setError(null);
  };

  const quitar = (url: string) => onChange(valor.filter((existente) => existente !== url));

  return (
    <div className="mt-1 space-y-3">
      {/* Zona de subida */}
      <div className="rounded-2xl border border-dashed border-neutro-300 bg-neutro-50 p-4 text-center">
        <input
          ref={entradaRef}
          id="archivos-fotos"
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(evento) => subir(Array.from(evento.target.files ?? []))}
        />

        <label
          htmlFor="archivos-fotos"
          className={`inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-bold text-white transition ${
            disponibles === 0 || subiendo
              ? "cursor-not-allowed bg-neutro-400"
              : "bg-primary-600 hover:bg-primary-700"
          }`}
          aria-disabled={disponibles === 0 || subiendo}
        >
          {subiendo ? "Subiendo…" : "📷 Elegir fotos"}
        </label>

        <p className="mt-2 text-xs leading-relaxed text-neutro-600">
          {progreso ||
            `Desde tu computador o celular · JPG, PNG o WebP · hasta ${maximo} fotos (${disponibles} ${
              disponibles === 1 ? "espacio libre" : "espacios libres"
            })`}
        </p>
        <p className="mt-1 text-xs text-neutro-500">
          Las fotos se optimizan automáticamente antes de subirse. La primera será la principal.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-confianza-danger/10 px-3 py-2 text-xs font-semibold text-confianza-danger">
          {error}
        </p>
      )}

      {/* Fotos cargadas */}
      {valor.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {valor.map((url, indice) => (
            <li key={url} className="relative overflow-hidden rounded-xl ring-1 ring-neutro-200">
              <Image
                src={url}
                alt={`Foto ${indice + 1} de la pensión`}
                width={320}
                height={240}
                className="h-24 w-full object-cover"
              />
              {indice === 0 && (
                <span className="absolute left-1 top-1 rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  Principal
                </span>
              )}
              <button
                type="button"
                onClick={() => quitar(url)}
                aria-label={`Quitar la foto ${indice + 1}`}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-sm font-bold text-neutro-700 shadow transition hover:bg-white"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Alternativa: pegar un enlace */}
      <details className="rounded-xl border border-neutro-200 bg-white px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-neutro-600">
          O pega un enlace de foto (opcional)
        </summary>
        <div className="mt-2 flex gap-2">
          <input
            type="url"
            value={enlace}
            onChange={(evento) => setEnlace(evento.target.value)}
            placeholder="https://…"
            className="h-11 flex-1 rounded-lg border border-neutro-300 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <button
            type="button"
            onClick={agregarEnlace}
            className="h-11 rounded-lg border border-primary-600 px-4 text-sm font-bold text-primary-700 transition hover:bg-primary-50"
          >
            Añadir
          </button>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-neutro-500">{AYUDA_IMAGENES}</p>
      </details>
    </div>
  );
}
