import { revalidatePath } from "next/cache";
import { RUTAS_DEL_CATALOGO } from "@/lib/cache-catalogo";

/**
 * Descarta la caché de todo lo que muestra el catálogo.
 *
 * La lista de rutas vive en `lib/cache-catalogo.ts` —para que las pruebas puedan
 * comprobar que ninguna página que lee el catálogo se queda fuera—, pero **esta**
 * función no puede vivir en un módulo `"use server"`: esos solo pueden exportar
 * funciones asíncronas, y `revalidatePath` es síncrona. Tampoco puede vivir en
 * `lib/cache-catalogo.ts`, que importan las pruebas en Node y no debe arrastrar
 * `next/cache`.
 *
 * Por eso vive aquí, en un módulo propio, desde la tarea #34: la usan las acciones
 * del anfitrión y las del perfil maestro, y antes era una copia privada dentro de
 * `app/actions/pensiones.ts` que nadie más podía reutilizar.
 *
 * En las rutas dinámicas el tipo es obligatorio: sin él, `revalidatePath` no
 * invalida ninguna de sus direcciones.
 */
export function revalidarCatalogo(): void {
  for (const { ruta, tipo } of RUTAS_DEL_CATALOGO) {
    if (tipo) revalidatePath(ruta, tipo);
    else revalidatePath(ruta);
  }
}
