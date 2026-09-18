/**
 * Traduce los mensajes de error de Supabase Auth al español, sin exponer
 * detalles técnicos al usuario final.
 */
export function mensajeDeError(mensaje: string): string {
  const texto = mensaje.toLowerCase();

  if (texto.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.";
  }
  if (texto.includes("email not confirmed")) {
    return "Debes confirmar tu correo antes de ingresar. Revisa tu bandeja de entrada.";
  }
  if (texto.includes("user already registered")) {
    return "Ese correo ya tiene una cuenta. Inicia sesión en lugar de registrarte.";
  }
  if (texto.includes("password should be at least")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (texto.includes("unable to validate email") || texto.includes("invalid email")) {
    return "El correo no tiene un formato válido.";
  }
  if (texto.includes("rate limit") || texto.includes("too many requests")) {
    return "Demasiados intentos seguidos. Espera un minuto e inténtalo otra vez.";
  }
  if (texto.includes("fetch") || texto.includes("network")) {
    return "No pudimos conectar con el servidor. Revisa tu conexión a internet.";
  }
  return "No pudimos completar la operación. Inténtalo de nuevo en unos segundos.";
}
