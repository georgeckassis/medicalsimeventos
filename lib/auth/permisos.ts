import type { Rol } from "@/lib/db/types";

/** Carga y edita eventos, fechas, lista de objetos, inventario, usuarios y tareas. */
export function esGestor(rol: Rol): boolean {
  return rol === "superadmin" || rol === "general";
}

/** Horarios de carga/salida/retiro/devolución, chofer y vehículo. */
export function puedeEditarLogistica(rol: Rol): boolean {
  return esGestor(rol) || rol === "logistica";
}

/** Tildar objetos, sacar la foto y firmar el cierre de una etapa. */
export function puedeTildar(rol: Rol): boolean {
  return esGestor(rol) || rol === "logistica" || rol === "chofer";
}

export function puedeValidarComoRepresentante(rol: Rol): boolean {
  return rol === "representante";
}
