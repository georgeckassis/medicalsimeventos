import type { DatoResultado } from "./ejercicios/tipos";

/**
 * Últimos resultados, guardados en el navegador. Cuando lleguen las métricas
 * se van a guardar en la base, asociados al residente.
 */
export interface ResultadoGuardado {
  ejercicio: string;
  fecha: string;
  segundos: number;
  datos: DatoResultado[];
}

const CLAVE = "simulador.historial";
const MAXIMO = 30;

export function leerHistorial(): ResultadoGuardado[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? "[]") as ResultadoGuardado[];
  } catch {
    return [];
  }
}

export function guardarResultado(r: ResultadoGuardado): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify([r, ...leerHistorial()].slice(0, MAXIMO)));
  } catch {
    // Sin almacenamiento el resultado se ve igual en pantalla, solo no queda en la lista.
  }
}
