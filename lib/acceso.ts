import { ErrorApi } from "@/lib/api";
import { obtenerEvento } from "@/lib/db/eventos";
import type { Evento, Usuario } from "@/lib/db/types";

/** El representante solo ve los eventos de su institución; el resto de los roles ve todos. */
export function puedeVerEvento(usuario: Usuario, evento: { institucionId: number | null }): boolean {
  if (usuario.rol !== "representante") return true;
  return usuario.institucionId !== null && evento.institucionId === usuario.institucionId;
}

export async function eventoVisible(usuario: Usuario, eventoId: number): Promise<Evento> {
  const evento = await obtenerEvento(eventoId);
  if (!evento || !puedeVerEvento(usuario, evento)) throw new ErrorApi(404, "Evento no encontrado.");
  return evento;
}
