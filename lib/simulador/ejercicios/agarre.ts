import * as THREE from "three";
import { LADOS, type Lado } from "../configuracion";
import type { BusEventos } from "../eventos/bus";
import type { Instrumento } from "../instrumentos/instrumento";

/**
 * Agarre sin motor de física: un objeto se agarra si la pinza se cierra con
 * la punta cerca de él, y desde ahí sigue a la punta. Si lo agarra la otra
 * pinza mientras la primera lo sostiene, es una transferencia.
 */
export class Agarrable {
  /** Pinzas que lo sostienen; la última es la que lo lleva. */
  sostenidoPor: Lado[] = [];
  private desfase = new THREE.Matrix4();

  constructor(
    readonly id: string,
    readonly objeto: THREE.Object3D,
    /** Distancia de un punto (en el mundo) a la parte agarrable del objeto. */
    readonly distancia: (punto: THREE.Vector3) => number,
    readonly alcance: number,
  ) {}

  get sostenido(): boolean {
    return this.sostenidoPor.length > 0;
  }

  get portador(): Lado | null {
    return this.sostenidoPor.at(-1) ?? null;
  }

  tomar(lado: Lado, inst: Instrumento): void {
    this.sostenidoPor = [...this.sostenidoPor.filter((l) => l !== lado), lado];
    this.objeto.updateMatrix();
    this.desfase.copy(inst.matrizPunta().invert().multiply(this.objeto.matrix));
  }

  dejar(lado: Lado): void {
    this.sostenidoPor = this.sostenidoPor.filter((l) => l !== lado);
  }

  /** Pose a la que lo lleva su portador. */
  poseDeseada(inst: Instrumento): { posicion: THREE.Vector3; orientacion: THREE.Quaternion } {
    const m = inst.matrizPunta().multiply(this.desfase);
    const posicion = new THREE.Vector3();
    const orientacion = new THREE.Quaternion();
    m.decompose(posicion, orientacion, new THREE.Vector3());
    return { posicion, orientacion };
  }
}

export interface ReglasAgarre {
  /** Si devuelve un texto, no se puede agarrar y se muestra como aviso. */
  impedir?: (obj: Agarrable, lado: Lado) => string | null;
  alSoltar?: (obj: Agarrable, lado: Lado) => void;
}

export class GestorAgarre {
  private cerradaAntes: Record<Lado, boolean> = { izquierda: false, derecha: false };
  aviso: string | null = null;
  private avisoHasta = 0;
  private tiempo = 0;

  constructor(
    private objetos: Agarrable[],
    private instrumentos: Record<Lado, Instrumento>,
    private bus: BusEventos,
    private reglas: ReglasAgarre = {},
  ) {}

  reiniciar(): void {
    for (const o of this.objetos) o.sostenidoPor = [];
    this.aviso = null;
    for (const lado of LADOS) this.cerradaAntes[lado] = this.instrumentos[lado].cerrada;
  }

  actualizar(dt: number, registrar: boolean): void {
    this.tiempo += dt;
    if (this.tiempo > this.avisoHasta) this.aviso = null;

    for (const lado of LADOS) {
      const inst = this.instrumentos[lado];
      const antes = this.cerradaAntes[lado];
      this.cerradaAntes[lado] = inst.cerrada;

      if (!antes && inst.cerrada) {
        let elegido: Agarrable | null = null;
        let mejor = Infinity;
        for (const o of this.objetos) {
          const d = o.distancia(inst.punta);
          if (d < o.alcance && d < mejor) {
            mejor = d;
            elegido = o;
          }
        }
        if (!elegido) continue;
        const motivo = this.reglas.impedir?.(elegido, lado);
        if (motivo) {
          this.aviso = motivo;
          this.avisoHasta = this.tiempo + 2.5;
          continue;
        }
        const otro = elegido.portador;
        elegido.tomar(lado, inst);
        if (registrar) {
          this.bus.emitir("agarre", { objeto: elegido.id, lado });
          if (otro && otro !== lado) this.bus.emitir("transferencia", { objeto: elegido.id, de: otro, a: lado });
        }
      } else if (antes && !inst.cerrada) {
        for (const o of this.objetos) {
          if (!o.sostenidoPor.includes(lado)) continue;
          o.dejar(lado);
          if (registrar) this.bus.emitir("suelta", { objeto: o.id, lado });
          if (!o.sostenido) this.reglas.alSoltar?.(o, lado);
        }
      }
    }
  }
}

/** Distancia de un punto al "tubo" de un aro (toro en el plano XY local, eje Z). */
export function distanciaAAro(objeto: THREE.Object3D, radio: number, punto: THREE.Vector3): number {
  objeto.updateMatrixWorld();
  const local = objeto.worldToLocal(punto.clone());
  return Math.hypot(Math.hypot(local.x, local.y) - radio, local.z);
}
