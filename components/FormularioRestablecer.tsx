"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/utils/supabase/client";
import { mensajeDeError } from "@/lib/auth-mensajes";

interface Props {
  /** Hay sesión: el enlace del correo se canjeó correctamente. */
  conSesion: boolean;
}

/**
 * Paso 2 de la recuperación: fijar la contraseña nueva.
 *
 * Sin sesión no hay nada que hacer aquí, y se dice con claridad en lugar de
 * mostrar un formulario que fallaría al enviarlo (el caso típico es abrir el
 * enlace caducado o desde otro navegador).
 */
export default function FormularioRestablecer({ conSesion }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (!conSesion) {
    return (
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card ring-1 ring-neutro-200 md:p-8">
        <h1 className="font-display text-2xl font-extrabold text-neutro-900">
          El enlace ya no sirve
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutro-600">
          Los enlaces de recuperación caducan por seguridad y solo se pueden usar una vez desde el
          mismo navegador donde los pediste. Pide uno nuevo y ábrelo enseguida.
        </p>
        <Link
          href="/recuperar"
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary-600 px-4 text-[15px] font-bold text-white transition hover:bg-primary-700"
        >
          Pedir otro enlace
        </Link>
        <p className="mt-3 text-center text-sm text-neutro-600">
          <Link href="/login" className="font-bold text-primary-700 hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    );
  }

  if (listo) {
    return (
      <div
        role="status"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card ring-1 ring-neutro-200 md:p-8"
      >
        <h1 className="font-display text-2xl font-extrabold text-neutro-900">
          Contraseña actualizada
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutro-600">
          Ya puedes entrar con tu contraseña nueva. Tu sesión sigue abierta en este dispositivo.
        </p>
        <button
          type="button"
          onClick={() => {
            router.push("/publicar");
            router.refresh();
          }}
          className="mt-5 h-12 w-full rounded-xl bg-primary-600 px-4 text-[15px] font-bold text-white transition hover:bg-primary-700"
        >
          Ir a mis publicaciones
        </button>
      </div>
    );
  }

  const guardar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError(null);

    // Se avisa antes de enviar: el requisito del servidor es más largo que el
    // mínimo de 6 de Supabase, así que conviene decirlo aquí.
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== repetir) {
      setError("Las dos contraseñas no coinciden. Escríbelas otra vez.");
      return;
    }

    setEnviando(true);
    const supabase = crearClienteNavegador();
    const { error: errorAuth } = await supabase.auth.updateUser({ password });
    setEnviando(false);

    if (errorAuth) {
      setError(mensajeDeError(errorAuth.message));
      return;
    }

    setListo(true);
  };

  return (
    <form
      onSubmit={guardar}
      className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card ring-1 ring-neutro-200 md:p-8"
    >
      <h1 className="font-display text-2xl font-extrabold text-neutro-900">
        Crea tu contraseña nueva
      </h1>
      <p className="mt-1 text-sm text-neutro-600">
        Elige una contraseña que puedas recordar y que no uses en otro sitio.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-confianza-danger/30 bg-confianza-danger/10 px-3 py-2 text-sm font-semibold text-confianza-danger"
        >
          {error}
        </p>
      )}

      <div className="mt-5">
        <label htmlFor="password" className="block text-sm font-semibold text-neutro-700">
          Contraseña nueva
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(evento) => setPassword(evento.target.value)}
          className="mt-1 h-12 w-full rounded-xl border border-neutro-300 bg-neutro-50 px-3 text-neutro-900 outline-none transition focus:border-primary-600 focus:bg-white"
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      <div className="mt-4">
        <label htmlFor="repetir" className="block text-sm font-semibold text-neutro-700">
          Repite la contraseña
        </label>
        <input
          id="repetir"
          name="repetir"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={repetir}
          onChange={(evento) => setRepetir(evento.target.value)}
          className="mt-1 h-12 w-full rounded-xl border border-neutro-300 bg-neutro-50 px-3 text-neutro-900 outline-none transition focus:border-primary-600 focus:bg-white"
          placeholder="Escríbela otra vez"
        />
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="mt-6 h-12 w-full rounded-xl bg-primary-600 px-4 text-[15px] font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
