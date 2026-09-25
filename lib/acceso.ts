import { ErrorApi } from "@/lib/api";
import { obtenerEvento } from "@/lib/db/eventos";
import { obtenerUsuario } from "@/lib/db/usuarios";
import type { Evento, Usuario } from "@/lib/db/types";

/**
 * El representante ve los eventos de su institución y los que tiene
 * asignados a cargo; el resto de los roles ve todos.
 */
export function puedeVerEvento(usuario: Usuario, evento: { institucionId: number | null; representanteId: number | null }): boolean {
  if (usuario.rol !== "representante") return true;
  if (evento.representanteId === usuario.id) return true;
  return usuario.institucionId !== null && evento.institucionId === usuario.institucionId;
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
