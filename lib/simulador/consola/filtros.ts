import * as THREE from "three";

/**
 * Filtro "One Euro" (Casiez et al., 2012): suaviza mucho cuando la mano está
 * quieta (saca el ruido del tracking y el temblor) y poco cuando se mueve
 * rápido (no agrega retraso). Es el que cumple el rol del filtro de temblor
 * de la consola.
 */
class FiltroOneEuro {
  private x: number | null = null;
  private dx = 0;

  constructor(
    private minCorte: number,
    private beta: number,
    private corteDerivada = 1,
  ) {}

  private static alfa(corte: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * corte);
    return 1 / (1 + tau / dt);
  }

  filtrar(valor: number, dt: number): number {
    if (this.x === null || dt <= 0) {
      this.x = valor;
      this.dx = 0;
      return valor;
    }
    const dxCrudo = (valor - this.x) / dt;
    this.dx += FiltroOneEuro.alfa(this.corteDerivada, dt) * (dxCrudo - this.dx);
    const corte = this.minCorte + this.beta * Math.abs(this.dx);
    this.x += FiltroOneEuro.alfa(corte, dt) * (valor - this.x);
    return this.x;
  }

  reiniciar(): void {
    this.x = null;
  }
}

export class FiltroVector {
  private ejes: FiltroOneEuro[];

  /** Un juego de parámetros por eje (x, y, z): la altura es la más ruidosa. */
  constructor(parametros: Array<[minCorte: number, beta: number]>) {
    this.ejes = parametros.map(([minCorte, beta]) => new FiltroOneEuro(minCorte, beta));
  }

  filtrar(v: THREE.Vector3, dt: number): THREE.Vector3 {
    return new THREE.Vector3(this.ejes[0].filtrar(v.x, dt), this.ejes[1].filtrar(v.y, dt), this.ejes[2].filtrar(v.z, dt));
  }

  reiniciar(): void {
    for (const eje of this.ejes) eje.reiniciar();
  }
}

/** Mismo criterio que el One Euro, aplicado a la orientación. */
export class FiltroRotacion {
  private q: THREE.Quaternion | null = null;

  constructor(
    private minCorte: number,
    private beta: number,
  ) {}

  filtrar(q: THREE.Quaternion, dt: number): THREE.Quaternion {
    if (!this.q || dt <= 0) {
      this.q = q.clone();
      return this.q.clone();
    }
    const velocidad = this.q.angleTo(q) / dt;
    const corte = this.minCorte + this.beta * velocidad;
    const tau = 1 / (2 * Math.PI * corte);
    this.q.slerp(q, 1 / (1 + tau / dt));
    return this.q.clone();
  }

  reiniciar(): void {
    this.q = null;
  }
}

/** Filtro simple de un valor escalar (la apertura de la pinza). */
export class FiltroEscalar {
  private f: FiltroOneEuro;

  constructor(minCorte: number, beta: number) {
    this.f = new FiltroOneEuro(minCorte, beta);
  }

  filtrar(v: number, dt: number): number {
    return this.f.filtrar(v, dt);
  }

  reiniciar(): void {
    this.f.reiniciar();
  }
}
