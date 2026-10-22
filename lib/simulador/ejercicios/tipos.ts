import type * as THREE from "three";
import type { Lado } from "../configuracion";
import type { Escena } from "../escena/escena";
import type { BusEventos } from "../eventos/bus";
import type { Instrumento } from "../instrumentos/instrumento";
import type { LimitesTeleoperacion } from "../teleoperacion/teleoperacion";

export interface ContextoEjercicio {
  escena: Escena;
  instrumentos: Record<Lado, Instrumento>;
  bus: BusEventos;
}

export interface EstadoEjercicio {
  instruccion: string;
  progreso: string;
  /** Mensaje corto y momentáneo (ej. "Ese tramo es con la otra pinza"). */
  aviso?: string;
  completo: boolean;
  /** Objetivo actual, para señalarlo con una flecha si está fuera de la vista. */
  objetivo?: THREE.Vector3;
}

export interface DatoResultado {
  etiqueta: string;
  valor: string;
}

/**
 * Un ejercicio arma su escenario, define por dónde entran los instrumentos y
 * hasta dónde llegan, aplica sus reglas cuadro a cuadro y resume el resultado.
 */
export interface Ejercicio {
  readonly limites: LimitesTeleoperacion;
  readonly camaraInicial: { posicion: THREE.Vector3; mira: THREE.Vector3 };
  readonly trocares: Record<Lado, THREE.Vector3>;
  readonly puntasIniciales: Record<Lado, THREE.Vector3>;
  /** Agrega sus objetos a la escena (una sola vez). */
  montar(ctx: ContextoEjercicio): void;
  /** Vuelve al estado de partida para un nuevo intento. */
  reiniciar(): void;
  /** Después de mover los instrumentos. `enCurso`: si el intento está corriendo (si no, solo animaciones). */
  actualizar(dt: number, enCurso: boolean): void;
  estado(): EstadoEjercicio;
  resultados(): DatoResultado[];
}

export interface DefinicionEjercicio {
  id: string;
  nombre: string;
  descripcion: string;
  habilidades: string;
  crear: () => Ejercicio;
}
