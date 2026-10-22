import * as THREE from "three";
import { LADOS, type Configuracion, type Lado } from "../configuracion";
import type { EstadoMaestro } from "../consola/maestro";
import type { Pedales } from "../consola/pedales";
import type { Instrumento } from "../instrumentos/instrumento";

/**
 * Traduce los controladores maestros a los instrumentos, como la consola:
 *
 * - Movimiento relativo y escalado: lo que se mueve la mano desde que se
 *   "acopló", dividido por la escala, en el marco de la cámara (alineación
 *   ojo-mano).
 * - Clutch: mientras está pisado los instrumentos quedan quietos y se pueden
 *   reubicar las manos. Al soltarlo se vuelve a acoplar desde donde estén.
 * - Cámara: mientras está pisado, mover las manos mueve la vista ("se agarra
 *   la escena") y los instrumentos quedan quietos.
 * - Si se pierde una mano su instrumento se congela (como sacar la cabeza del
 *   visor).
 * - Al reacoplar con la pinza cerrada, no se abre hasta que la mano iguala su
 *   apertura: así no se suelta lo que tenía agarrado.
 */

interface Brazo {
  acoplado: boolean;
  anclaMaestroPos: THREE.Vector3;
  anclaMaestroRot: THREE.Quaternion;
  anclaPuntaPos: THREE.Vector3;
  anclaPuntaRot: THREE.Quaternion;
  pinzaSincronizada: boolean;
  signoPinza: number;
}

export interface LimitesTeleoperacion {
  punta: THREE.Box3;
  camara: THREE.Box3;
  /** Altura de la superficie bajo un punto: la punta no puede atravesarla. */
  alturaSuperficie: (x: number, z: number) => number;
}

/** La vista se mueve más que los instrumentos: 1,5 cm de mano = 1 cm de cámara. */
const ESCALA_CAMARA = 1.5;
const MARGEN_SUPERFICIE = 0.15;

function nuevoBrazo(): Brazo {
  return {
    acoplado: false,
    anclaMaestroPos: new THREE.Vector3(),
    anclaMaestroRot: new THREE.Quaternion(),
    anclaPuntaPos: new THREE.Vector3(),
    anclaPuntaRot: new THREE.Quaternion(),
    pinzaSincronizada: true,
    signoPinza: 0,
  };
}

export class Teleoperacion {
  private brazos: Record<Lado, Brazo> = { izquierda: nuevoBrazo(), derecha: nuevoBrazo() };
  private anclaCamara: { posicion: THREE.Vector3; manos: THREE.Vector3; cuantas: number } | null = null;

  constructor(
    private instrumentos: Record<Lado, Instrumento>,
    private camara: THREE.PerspectiveCamera,
    private limites: LimitesTeleoperacion,
  ) {}

  /** Desacopla todo (al pausar o reiniciar): el próximo movimiento parte de cero. */
  soltar(): void {
    for (const lado of LADOS) this.brazos[lado].acoplado = false;
    this.anclaCamara = null;
  }

  /** La mano todavía no igualó la apertura de la pinza (para avisarle al usuario). */
  pinzaPendiente(lado: Lado): boolean {
    return this.brazos[lado].acoplado && !this.brazos[lado].pinzaSincronizada;
  }

  actualizar(maestros: Record<Lado, EstadoMaestro | null>, pedales: Pedales, config: Configuracion): void {
    const camQ = this.camara.quaternion;
    this.moverCamara(maestros, pedales.camara);

    for (const lado of LADOS) {
      const m = maestros[lado];
      const b = this.brazos[lado];
      const inst = this.instrumentos[lado];
      if (!m || pedales.clutch || pedales.camara) {
        b.acoplado = false;
        continue;
      }
      if (!b.acoplado) {
        b.acoplado = true;
        b.anclaMaestroPos.copy(m.posicion);
        b.anclaMaestroRot.copy(m.orientacion);
        b.anclaPuntaPos.copy(inst.punta);
        b.anclaPuntaRot.copy(inst.orientacion);
        const diferencia = m.apertura - inst.apertura;
        // Solo importa si la pinza está cerrada (puede tener algo agarrado).
        b.pinzaSincronizada = !inst.cerrada || Math.abs(diferencia) < 0.2;
        b.signoPinza = Math.sign(diferencia);
      }

      const delta = m.posicion.clone().sub(b.anclaMaestroPos).applyQuaternion(camQ).divideScalar(config.escala);
      const deseada = b.anclaPuntaPos.clone().add(delta);
      const punta = deseada.clone().clamp(this.limites.punta.min, this.limites.punta.max);
      punta.y = Math.max(punta.y, this.limites.alturaSuperficie(punta.x, punta.z) + MARGEN_SUPERFICIE);
      // Contra un límite la punta se detiene como contra una pared: al volver
      // la mano, responde enseguida (sin "zona muerta").
      b.anclaPuntaPos.add(punta.clone().sub(deseada));

      const giroMaestro = m.orientacion.clone().multiply(b.anclaMaestroRot.clone().invert());
      const giroMundo = camQ.clone().multiply(giroMaestro).multiply(camQ.clone().invert());
      inst.fijarPose(punta, giroMundo.multiply(b.anclaPuntaRot));

      if (!b.pinzaSincronizada) {
        const diferencia = m.apertura - inst.apertura;
        if (Math.abs(diferencia) < 0.1 || Math.sign(diferencia) !== b.signoPinza) b.pinzaSincronizada = true;
      }
      if (b.pinzaSincronizada) inst.fijarApertura(m.apertura);
    }
  }

  private moverCamara(maestros: Record<Lado, EstadoMaestro | null>, pedalCamara: boolean): void {
    const visibles = LADOS.map((l) => maestros[l]).filter((m): m is EstadoMaestro => m !== null);
    if (!pedalCamara || visibles.length === 0) {
      this.anclaCamara = null;
      return;
    }
    const manos = visibles.reduce((s, m) => s.add(m.posicion), new THREE.Vector3()).divideScalar(visibles.length);
    // Si aparece o desaparece una mano, el promedio salta: se vuelve a anclar.
    if (!this.anclaCamara || this.anclaCamara.cuantas !== visibles.length) {
      this.anclaCamara = { posicion: this.camara.position.clone(), manos, cuantas: visibles.length };
      return;
    }
    const delta = manos.sub(this.anclaCamara.manos).applyQuaternion(this.camara.quaternion).divideScalar(ESCALA_CAMARA);
    this.camara.position.copy(this.anclaCamara.posicion).sub(delta).clamp(this.limites.camara.min, this.limites.camara.max);
  }
}
