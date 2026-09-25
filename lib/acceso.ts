import { ErrorApi } from "@/lib/api";
import { obtenerEvento } from "@/lib/db/eventos";
import { obtenerUsuario } from "@/lib/db/usuarios";
import type { Evento, Rol, Usuario } from "@/lib/db/types";

/**
 * Qué eventos ve cada rol (tiene que coincidir con filtroVisibilidad en
 * lib/db/eventos.ts):
 *  - representante de la institución: los de su institución;
 *  - instructor: los que tiene a cargo;
 *  - representante de ventas: los que tiene a cargo y los de las
 *    instituciones que atiende;
 *  - el resto (general, logística, chofer): todos.
 */
export function puedeVerEvento(
  usuario: Usuario,
  evento: { institucionId: number | null; instructorId: number | null; vendedorId: number | null; institucionVendedorId: number | null },
): boolean {
  switch (usuario.rol) {
    case "representante":
      return usuario.institucionId !== null && evento.institucionId === usuario.institucionId;
    case "instructor":
      return evento.instructorId === usuario.id;
    case "vendedor":
      return evento.vendedorId === usuario.id || evento.institucionVendedorId === usuario.id;
    default:
      return true;
  }
}

export async function eventoVisible(usuario: Usuario, eventoId: number): Promise<Evento> {
  const evento = await obtenerEvento(eventoId);
  if (!evento || !puedeVerEvento(usuario, evento)) throw new ErrorApi(404, "Evento no encontrado.");
  return evento;
}

const QUIEN: Partial<Record<Rol, string>> = { instructor: "El instructor", vendedor: "El representante de ventas" };

/** Quien se asigna a cargo de un evento o institución tiene que ser un usuario activo con ese rol. */
export async function validarAsignado(id: number | null, rol: "instructor" | "vendedor"): Promise<void> {
  if (id === null) return;
  const usuario = await obtenerUsuario(id);
  if (!usuario || !usuario.activo || usuario.rol !== rol) {
    throw new ErrorApi(400, `${QUIEN[rol]} elegido no es válido.`);
  }
}
