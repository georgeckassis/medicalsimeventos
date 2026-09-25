import { ErrorApi } from "@/lib/api";
import { obtenerEvento } from "@/lib/db/eventos";
import { obtenerUsuario } from "@/lib/db/usuarios";
import type { Evento, Usuario } from "@/lib/db/types";

/**
 * El representante de ventas ve los eventos que tiene a cargo y los de las
 * instituciones que atiende; el resto de los roles ve todos.
 */
export function puedeVerEvento(
  usuario: Usuario,
  evento: { representanteId: number | null; institucionRepresentanteId: number | null },
): boolean {
  if (usuario.rol !== "representante") return true;
  return evento.representanteId === usuario.id || evento.institucionRepresentanteId === usuario.id;
}

export async function eventoVisible(usuario: Usuario, eventoId: number): Promise<Evento> {
  const evento = await obtenerEvento(eventoId);
  if (!evento || !puedeVerEvento(usuario, evento)) throw new ErrorApi(404, "Evento no encontrado.");
  return evento;
}

/** El representante a cargo de un evento tiene que ser un usuario activo con rol representante. */
export async function validarRepresentante(id: number | null): Promise<void> {
  if (id === null) return;
  const usuario = await obtenerUsuario(id);
  if (!usuario || !usuario.activo || usuario.rol !== "representante") {
    throw new ErrorApi(400, "El representante elegido no es válido.");
  }
}
