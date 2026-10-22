import * as THREE from "three";
import type { Lado } from "../configuracion";

/**
 * Instrumento robótico: vástago que entra por el trocar, muñeca articulada
 * (tipo EndoWrist) y mandíbulas. La pose que se controla es la de la punta;
 * el vástago se acomoda solo para pasar siempre por el trocar.
 */
export interface DefinicionInstrumento {
  nombre: string;
  largoMandibula: number;
  aperturaMaxGrados: number;
  radioVastago: number;
}

export const INSTRUMENTOS = {
  pinza: { nombre: "Pinza de agarre", largoMandibula: 1.1, aperturaMaxGrados: 50, radioVastago: 0.28 },
  portaAgujas: { nombre: "Porta-agujas", largoMandibula: 0.9, aperturaMaxGrados: 35, radioVastago: 0.28 },
} satisfies Record<string, DefinicionInstrumento>;

export const COLOR_LADO: Record<Lado, number> = { izquierda: 0x3b82f6, derecha: 0x22c55e };

/** Con histéresis, para que la pinza no "titile" cerca del umbral. */
const UMBRAL_CERRAR = 0.25;
const UMBRAL_ABRIR = 0.4;

const EJE_Y = new THREE.Vector3(0, 1, 0);
const ADELANTE = new THREE.Vector3(0, 0, -1);

export class Instrumento {
  readonly grupo = new THREE.Group();
  readonly punta = new THREE.Vector3();
  readonly orientacion = new THREE.Quaternion();
  apertura = 1;
  cerrada = false;

  private vastago: THREE.Mesh;
  private cabeza = new THREE.Group();
  private mandibulaSup = new THREE.Group();
  private mandibulaInf = new THREE.Group();
  private lineaProfundidad: THREE.Line;
  private marcaProfundidad: THREE.Mesh;

  constructor(
    readonly lado: Lado,
    readonly trocar: THREE.Vector3,
    readonly definicion: DefinicionInstrumento,
  ) {
    const metal = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.8, roughness: 0.35 });
    const oscuro = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.4, roughness: 0.6 });
    const color = new THREE.MeshStandardMaterial({ color: COLOR_LADO[lado], metalness: 0.2, roughness: 0.5 });

    const r = definicion.radioVastago;
    this.vastago = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 20), oscuro);
    this.vastago.castShadow = true;
    this.grupo.add(this.vastago);

    const nudillo = new THREE.Mesh(new THREE.SphereGeometry(r * 0.9, 20, 12), metal);
    nudillo.castShadow = true;
    const anillo = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.35, 20), color);
    anillo.rotation.x = Math.PI / 2;
    anillo.position.z = 0.55;
    this.cabeza.add(nudillo, anillo);

    const L = definicion.largoMandibula;
    for (const [grupo, signo] of [
      [this.mandibulaSup, 1],
      [this.mandibulaInf, -1],
    ] as const) {
      const hoja = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, L), metal);
      hoja.position.set(0, signo * 0.06, -L / 2);
      hoja.castShadow = true;
      grupo.add(hoja);
      this.cabeza.add(grupo);
    }
    this.grupo.add(this.cabeza);

    this.lineaProfundidad = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: COLOR_LADO[lado], transparent: true, opacity: 0.6 }),
    );
    this.marcaProfundidad = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.3, 24),
      new THREE.MeshBasicMaterial({ color: COLOR_LADO[lado], transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    this.marcaProfundidad.rotation.x = -Math.PI / 2;
    this.grupo.add(this.lineaProfundidad, this.marcaProfundidad);
  }

  /** Orientación que deja las mandíbulas en línea con el vástago (pose de partida). */
  orientacionAlineada(punta: THREE.Vector3): THREE.Quaternion {
    const m = new THREE.Matrix4().lookAt(this.trocar, punta, EJE_Y);
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }

  fijarPose(punta: THREE.Vector3, orientacion: THREE.Quaternion): void {
    this.punta.copy(punta);
    this.orientacion.copy(orientacion);
    const adelante = ADELANTE.clone().applyQuaternion(orientacion);
    const muneca = punta.clone().sub(adelante.multiplyScalar(this.definicion.largoMandibula));

    const eje = muneca.clone().sub(this.trocar);
    const largo = Math.max(eje.length(), 0.01);
    this.vastago.position.copy(this.trocar).addScaledVector(eje, 0.5);
    this.vastago.quaternion.setFromUnitVectors(EJE_Y, eje.normalize());
    this.vastago.scale.set(1, largo, 1);

    this.cabeza.position.copy(muneca);
    this.cabeza.quaternion.copy(orientacion);
  }

  fijarApertura(apertura: number): void {
    this.apertura = apertura;
    this.cerrada = this.cerrada ? apertura < UMBRAL_ABRIR : apertura < UMBRAL_CERRAR;
    const angulo = THREE.MathUtils.degToRad(this.definicion.aperturaMaxGrados) * apertura * 0.5;
    this.mandibulaSup.rotation.x = angulo;
    this.mandibulaInf.rotation.x = -angulo;
  }

  /** Línea vertical de la punta hasta la superficie que tiene abajo. */
  fijarAyudaProfundidad(visible: boolean, alturaSuperficie: number): void {
    this.lineaProfundidad.visible = visible;
    this.marcaProfundidad.visible = visible;
    if (!visible) return;
    const abajo = new THREE.Vector3(this.punta.x, alturaSuperficie + 0.02, this.punta.z);
    this.lineaProfundidad.geometry.setFromPoints([this.punta, abajo]);
    this.marcaProfundidad.position.copy(abajo);
  }

  /** Matriz de la punta en el mundo (para llevar objetos agarrados). */
  matrizPunta(): THREE.Matrix4 {
    return new THREE.Matrix4().compose(this.punta, this.orientacion, new THREE.Vector3(1, 1, 1));
  }
}
