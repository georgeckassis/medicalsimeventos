import * as THREE from "three";
import { LADOS } from "../configuracion";
import type { ContextoEjercicio, DatoResultado, Ejercicio, EstadoEjercicio } from "./tipos";

/**
 * Clutch y cámara: tocar esferas lejanas. Las primeras están a la vista pero
 * fuera del alcance de las manos (hay que usar el clutch); las siguientes,
 * fuera de la vista (hay que mover la cámara); al final, las dos cosas.
 */

interface Objetivo {
  posicion: THREE.Vector3;
  parte: 1 | 2 | 3;
}

const OBJETIVOS: Objetivo[] = [
  { posicion: new THREE.Vector3(-9, 1.5, -5), parte: 1 },
  { posicion: new THREE.Vector3(9, 3, -5), parte: 1 },
  { posicion: new THREE.Vector3(-9, 3, 4), parte: 1 },
  { posicion: new THREE.Vector3(9, 1, 4), parte: 1 },
  { posicion: new THREE.Vector3(-19, 2, -6), parte: 2 },
  { posicion: new THREE.Vector3(19, 3, -6), parte: 2 },
  { posicion: new THREE.Vector3(0, 2, -19), parte: 2 },
  { posicion: new THREE.Vector3(-17, 1.5, 6), parte: 3 },
  { posicion: new THREE.Vector3(16, 2, -15), parte: 3 },
  { posicion: new THREE.Vector3(0, 4, 5), parte: 3 },
];

const RADIO = 0.7;
const SOSTENER_S = 1;

const INSTRUCCIONES: Record<Objetivo["parte"], string> = {
  1: "Tocá la esfera con la punta de cualquier pinza y sostené 1 segundo. Está lejos: pisá el clutch, reubicá las manos al centro y seguí avanzando.",
  2: "La esfera está fuera de la vista: con el pedal de cámara pisado, mové las manos para mover la vista (seguí la flecha). Después, alcanzala con la pinza.",
  3: "Combiná clutch y cámara para llegar a cada esfera.",
};

export class ClutchCamara implements Ejercicio {
  readonly limites = {
    punta: new THREE.Box3(new THREE.Vector3(-24, 0, -24), new THREE.Vector3(24, 14, 10)),
    camara: new THREE.Box3(new THREE.Vector3(-22, 5, -14), new THREE.Vector3(22, 26, 26)),
    alturaSuperficie: () => 0,
  };
  readonly camaraInicial = { posicion: new THREE.Vector3(0, 10, 13), mira: new THREE.Vector3(0, 0, 0) };
  readonly trocares = { izquierda: new THREE.Vector3(-12, 11, 6), derecha: new THREE.Vector3(12, 11, 6) };
  readonly puntasIniciales = { izquierda: new THREE.Vector3(-3, 2, 2), derecha: new THREE.Vector3(3, 2, 2) };

  private ctx!: ContextoEjercicio;
  private esfera!: THREE.Mesh;
  private material!: THREE.MeshStandardMaterial;
  private indice = 0;
  private sostenido = 0;

  montar(ctx: ContextoEjercicio): void {
    this.ctx = ctx;
    this.material = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfacc15,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.85,
    });
    this.esfera = new THREE.Mesh(new THREE.SphereGeometry(RADIO, 32, 16), this.material);
    this.esfera.castShadow = true;
    ctx.escena.escena.add(this.esfera);

    // Relieves del tejido: referencias para notar que la vista se mueve.
    const tejido = new THREE.MeshStandardMaterial({ color: 0xb85c52, roughness: 0.9 });
    const azar = semilla(7);
    for (let i = 0; i < 45; i++) {
      const pliegue = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), tejido);
      pliegue.position.set((azar() - 0.5) * 50, 0, (azar() - 0.5) * 40 - 5);
      pliegue.scale.set(1 + azar() * 2.5, 0.08 + azar() * 0.12, 1 + azar() * 2.5);
      pliegue.rotation.y = azar() * Math.PI;
      pliegue.receiveShadow = true;
      ctx.escena.escena.add(pliegue);
    }
    this.reiniciar();
  }

  reiniciar(): void {
    this.indice = 0;
    this.sostenido = 0;
    this.ubicarEsfera();
  }

  private ubicarEsfera(): void {
    const objetivo = OBJETIVOS[this.indice];
    this.esfera.visible = !!objetivo;
    if (objetivo) this.esfera.position.copy(objetivo.posicion);
  }

  actualizar(dt: number, enCurso: boolean): void {
    const objetivo = OBJETIVOS[this.indice];
    if (!objetivo) return;
    const tocando = LADOS.some((l) => this.ctx.instrumentos[l].punta.distanceTo(objetivo.posicion) < RADIO);
    this.sostenido = tocando ? this.sostenido + dt : 0;
    const avance = Math.min(this.sostenido / SOSTENER_S, 1);
    this.material.color.setHex(tocando ? 0x22c55e : 0xfacc15);
    this.material.emissive.setHex(tocando ? 0x22c55e : 0xfacc15);
    this.esfera.scale.setScalar(1 - avance * 0.4);

    if (enCurso && this.sostenido >= SOSTENER_S) {
      this.ctx.bus.emitir("objetivo", { numero: this.indice + 1, parte: objetivo.parte });
      this.indice++;
      this.sostenido = 0;
      this.esfera.scale.setScalar(1);
      this.ubicarEsfera();
    }
  }

  estado(): EstadoEjercicio {
    const objetivo = OBJETIVOS[this.indice];
    if (!objetivo) return { instruccion: "¡Listo!", progreso: `${OBJETIVOS.length}/${OBJETIVOS.length} esferas`, completo: true };
    return {
      instruccion: INSTRUCCIONES[objetivo.parte],
      progreso: `Parte ${objetivo.parte} de 3 · esfera ${this.indice + 1}/${OBJETIVOS.length}`,
      completo: false,
      objetivo: objetivo.posicion,
    };
  }

  resultados(): DatoResultado[] {
    return [{ etiqueta: "Esferas alcanzadas", valor: `${this.indice}/${OBJETIVOS.length}` }];
  }
}

/** Números "al azar" repetibles: el escenario es siempre el mismo. */
export function semilla(s: number): () => number {
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
