"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/utils/supabase/client";
import { mensajeDeError } from "@/lib/auth-mensajes";

interface Props {
  configurado: boolean;
}

/** Registro de anfitriones (Supabase Auth + perfil en la tabla `usuarios`). */
export default function FormularioRegistro({ configurado }: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    configurado ? null : "Supabase aún no está configurado: falta agregar las credenciales en .env.local."
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const registrar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!configurado) return;

    setError(null);
    setAviso(null);
    setEnviando(true);

    const supabase = crearClienteNavegador();
    const { data, error: errorAuth } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // El trigger `crear_perfil_usuario` toma estos datos para la tabla usuarios.
        data: { nombre, rol: "anfitrion" },
        emailRedirectTo: `${window.location.origin}/publicar`,
      },
    });

    setEnviando(false);

    if (errorAuth) {
      setError(mensajeDeError(errorAuth.message));
      return;
    }

    // Si el proyecto exige confirmación por correo, no hay sesión todavía.
    if (!data.session) {
      setAviso(
        "Cuenta creada. Te enviamos un correo para confirmarla: ábrelo y luego inicia sesión."
      );
      return;
    }

    router.push("/publicar");
    router.refresh();
  };

  return (
    <form onSubmit={registrar} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card ring-1 ring-neutro-200 md:p-8">
      <h1 className="font-display text-2xl font-extrabold text-neutro-900">Publica tu pensión</h1>
      <p className="mt-1 text-sm text-neutro-600">
        Crea tu cuenta de anfitrión y sube tu pensión al catálogo.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-confianza-danger/30 bg-confianza-danger/10 px-3 py-2 text-sm font-semibold text-confianza-danger">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="mt-4 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-800">
          {aviso}
        </p>
      )}

      <div className="mt-5">
        <label htmlFor="nombre" className="block text-sm font-semibold text-neutro-700">
          Nombre o razón social
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          minLength={3}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="mt-1 h-12 w-full rounded-xl border border-neutro-300 bg-neutro-50 px-3 text-neutro-900 outline-none transition focus:border-primary-600 focus:bg-white"
          placeholder="Ej.: Residencias La Marina"
        />
      </div>

      <div className="mt-4">
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
          autoComplete="new-password"
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
        className="mt-6 h-12 w-full rounded-xl bg-accent-700 px-4 text-[15px] font-bold text-white transition hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? "Creando cuenta…" : "Crear cuenta de anfitrión"}
      </button>

      <p className="mt-4 text-center text-sm text-neutro-600">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-bold text-primary-700 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
