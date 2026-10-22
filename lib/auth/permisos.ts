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

/**
 * Datos personales de los alumnos (DNI, mail, teléfono): solo quien los
 * necesita. Logística y el chofer ven la cantidad, no la lista.
 */
export function puedeVerAlumnos(rol: Rol): boolean {
  return esGestor(rol) || rol === "instructor" || rol === "vendedor" || rol === "representante";
}

/** Simulador de cirugía robótica: por ahora solo para probarlo internamente. */
export function puedeUsarSimulador(rol: Rol): boolean {
  return esGestor(rol);
}
