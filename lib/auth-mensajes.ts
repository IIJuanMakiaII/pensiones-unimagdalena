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
  // Enlaces de correo: el caso más frecuente es abrirlos tarde o reutilizarlos.
  if (
    texto.includes("expired") ||
    texto.includes("invalid token") ||
    texto.includes("otp_expired") ||
    texto.includes("token has expired")
  ) {
    return "Ese enlace ya no sirve: los enlaces caducan por seguridad y solo se pueden usar una vez. Pide uno nuevo y ábrelo enseguida.";
  }
  if (texto.includes("different from the old password")) {
    return "La contraseña nueva tiene que ser distinta de la anterior.";
  }
  if (texto.includes("weak password") || texto.includes("password is too weak")) {
    return "Esa contraseña es demasiado fácil de adivinar. Usa al menos 8 caracteres combinando letras y números.";
  }
  if (texto.includes("fetch") || texto.includes("network")) {
    return "No pudimos conectar con el servidor. Revisa tu conexión a internet.";
  }
  return "No pudimos completar la operación. Inténtalo de nuevo en unos segundos.";
}
