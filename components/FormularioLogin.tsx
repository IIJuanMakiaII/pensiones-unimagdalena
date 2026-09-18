"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/utils/supabase/client";
import { mensajeDeError } from "@/lib/auth-mensajes";

interface Props {
  destino: string;
  configurado: boolean;
}

/** Formulario de acceso de anfitriones (Supabase Auth). */
export default function FormularioLogin({ destino, configurado }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    configurado ? null : "Supabase aún no está configurado: falta agregar las credenciales en .env.local."
  );
  const [enviando, setEnviando] = useState(false);

  const ingresar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!configurado) return;

    setError(null);
    setEnviando(true);

    const supabase = crearClienteNavegador();
    const { error: errorAuth } = await supabase.auth.signInWithPassword({ email, password });

    if (errorAuth) {
      setError(mensajeDeError(errorAuth.message));
      setEnviando(false);
      return;
    }

    router.push(destino);
    router.refresh();
  };

  return (
    <form onSubmit={ingresar} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card ring-1 ring-neutro-200 md:p-8">
      <h1 className="font-display text-2xl font-extrabold text-neutro-900">Acceso anfitriones</h1>
      <p className="mt-1 text-sm text-neutro-600">
        Publica y administra tus pensiones o habitaciones.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-confianza-danger/30 bg-confianza-danger/10 px-3 py-2 text-sm font-semibold text-confianza-danger">
          {error}
        </p>
      )}

      <div className="mt-5">
        <label htmlFor="email" className="block text-sm font-semibold text-neutro-700">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 h-12 w-full rounded-xl border border-neutro-300 bg-neutro-50 px-3 text-neutro-900 outline-none transition focus:border-primary-600 focus:bg-white"
          placeholder="tucorreo@ejemplo.com"
        />
      </div>

      <div className="mt-4">
        <label htmlFor="password" className="block text-sm font-semibold text-neutro-700">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 h-12 w-full rounded-xl border border-neutro-300 bg-neutro-50 px-3 text-neutro-900 outline-none transition focus:border-primary-600 focus:bg-white"
          placeholder="Mínimo 6 caracteres"
        />
      </div>

      <button
        type="submit"
        disabled={enviando || !configurado}
        className="mt-6 h-12 w-full rounded-xl bg-primary-600 px-4 text-[15px] font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? "Ingresando…" : "Iniciar sesión"}
      </button>

      <p className="mt-4 text-center text-sm text-neutro-600">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="font-bold text-primary-700 hover:underline">
          Registra tu pensión
        </Link>
      </p>
    </form>
  );
}
