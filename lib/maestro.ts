import type { SupabaseClient } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/utils/supabase/server";

/**
 * El perfil maestro dentro de la aplicación (tarea #34).
 *
 * La base ya sabe quién es maestro —`public.es_maestro()`, aplicada y verificada
 * en la tarea #33—, así que aquí **no se duplica la regla: se pregunta**. La
 * alternativa tentadora sería leer el rol de `user_metadata`, y sería un agujero:
 * esos metadatos los escribe el propio usuario, así que cualquiera podría
 * ponerse `rol: "maestro"` sin tocar la base.
 *
 * Todo lo de este módulo está escrito para **fallar cerrado**. Si la comprobación
 * no se puede completar —sin sesión, red caída, función ausente—, la respuesta es
 * «no es maestro»: lo que protege este módulo son el panel y el borrado.
 */

/** Pregunta a la base si el usuario de esta sesión tiene el perfil maestro. */
export async function esMaestroConCliente(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("es_maestro");

    if (error) {
      console.error("No se pudo comprobar el perfil maestro:", error.message);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error("Fallo comprobando el perfil maestro:", error);
    return false;
  }
}

/**
 * Lo mismo, creando el cliente con la sesión de la petición.
 *
 * Se ofrece aparte porque quien ya tiene un cliente —las acciones de servidor lo
 * crean para leer la identidad— no debería crear un segundo solo para preguntar
 * esto.
 */
export async function sesionEsMaestro(): Promise<boolean> {
  try {
    return await esMaestroConCliente(await crearClienteServidor());
  } catch (error) {
    console.error("Fallo creando el cliente para comprobar el perfil maestro:", error);
    return false;
  }
}

/*
 * Aquí vivían `PALABRA_DE_BORRADO` y `confirmacionDeBorradoValida()`. Se movieron
 * a `lib/borrado.ts` al escribir el panel del maestro: este módulo importa el
 * cliente de servidor de Supabase —que usa `cookies()`—, así que un componente de
 * cliente que solo quisiera mostrar la palabra habría arrastrado todo esto al
 * navegador. La palabra vive ahora en un archivo sin dependencias, compartida por
 * las dos orillas.
 */
