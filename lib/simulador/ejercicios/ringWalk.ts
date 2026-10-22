import * as THREE from "three";
import type { Lado } from "../configuracion";
import { COLOR_LADO } from "../instrumentos/instrumento";
import { Agarrable, GestorAgarre, distanciaAAro } from "./agarre";
import type { ContextoEjercicio, DatoResultado, Ejercicio, EstadoEjercicio } from "./tipos";

/**
 * Ring walk: llevar un aro enhebrado en un alambre curvo de punta a punta.
 * El alambre tiene 3 tramos (izquierda, derecha, izquierda): cada tramo se
 * recorre con su pinza, así que en cada marca hay que pasar el aro a la otra.
 * Si el aro toca el alambre (por ir desviado o inclinado) se marca en rojo.
 */

const ALTO_TABLERO = 0.4;
const ARO = { radio: 0.6, tubo: 0.1 };
const ALAMBRE = 0.08;
const HOLGURA = ARO.radio - ARO.tubo - ALAMBRE;
const MUESTRAS = 600;
const VENTANA = 40; // muestras a cada lado de la posición actual donde se busca el punto más cercano
const FIN = 0.96;
const INICIO = 0.03;

const TRAMOS: Array<{ desde: number; hasta: number; lado: Lado }> = [
  { desde: 0, hasta: 1 / 3, lado: "izquierda" },
  { desde: 1 / 3, hasta: 2 / 3, lado: "derecha" },
  { desde: 2 / 3, hasta: 1, lado: "izquierda" },
];
const TOLERANCIA_TRAMO = 0.015;

const CURVA = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-6, 0.9, 2),
  new THREE.Vector3(-5, 2.6, 1.2),
  new THREE.Vector3(-3, 3.4, -1),
  new THREE.Vector3(-1, 2.4, -2.2),
  new THREE.Vector3(1, 2.2, -0.5),
  new THREE.Vector3(2.8, 3.6, 1.5),
  new THREE.Vector3(4.8, 2.8, 0.2),
  new THREE.Vector3(6, 0.9, -1.5),
]);

const EJE_Z = new THREE.Vector3(0, 0, 1);

function tramoDe(t: number, lado: Lado) {
  return TRAMOS.find((tr) => tr.lado === lado && t >= tr.desde - TOLERANCIA_TRAMO && t <= tr.hasta + TOLERANCIA_TRAMO);
}

export class RingWalk implements Ejercicio {
  readonly limites = {
    punta: new THREE.Box3(new THREE.Vector3(-14, 0, -10), new THREE.Vector3(14, 10, 8)),
    camara: new THREE.Box3(new THREE.Vector3(-10, 4, -4), new THREE.Vector3(10, 20, 22)),
    alturaSuperficie: (x: number, z: number) => (Math.abs(x) <= 8 && Math.abs(z) <= 5 ? ALTO_TABLERO : 0),
  };
  readonly camaraInicial = { posicion: new THREE.Vector3(0, 9, 10.5), mira: new THREE.Vector3(0, 1.5, 0) };
  readonly trocares = { izquierda: new THREE.Vector3(-11, 11, 5), derecha: new THREE.Vector3(11, 11, 5) };
  readonly puntasIniciales = { izquierda: new THREE.Vector3(-4, 3.5, 3), derecha: new THREE.Vector3(3, 3.5, 3) };

  private ctx!: ContextoEjercicio;
  private puntos: THREE.Vector3[] = [];
  private tangentes: THREE.Vector3[] = [];
  private aro!: THREE.Mesh;
  private materialAro!: THREE.MeshStandardMaterial;
  private agarrable!: Agarrable;
  private gestor!: GestorAgarre;
  private indice = 0;
  private contacto = false;
  private tiempoContacto = 0;
  private aviso: string | null = null;

  private get t(): number {
    return this.indice / MUESTRAS;
  }

  montar(ctx: ContextoEjercicio): void {
    this.ctx = ctx;
    const escena = ctx.escena.escena;
    for (let i = 0; i <= MUESTRAS; i++) {
      this.puntos.push(CURVA.getPointAt(i / MUESTRAS));
      this.tangentes.push(CURVA.getTangentAt(i / MUESTRAS));
    }

    const tablero = new THREE.Mesh(
      new THREE.BoxGeometry(16, ALTO_TABLERO, 10),
      new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.7 }),
    );
    tablero.position.y = ALTO_TABLERO / 2;
    tablero.receiveShadow = true;
    escena.add(tablero);

    // Cada tramo del alambre con el color de la pinza que lo recorre.
    for (const tramo of TRAMOS) {
      const puntos = this.puntos.slice(Math.round(tramo.desde * MUESTRAS), Math.round(tramo.hasta * MUESTRAS) + 1);
      const tubo = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(puntos), 120, ALAMBRE, 8),
        new THREE.MeshStandardMaterial({ color: COLOR_LADO[tramo.lado], metalness: 0.5, roughness: 0.4 }),
      );
      tubo.castShadow = true;
      escena.add(tubo);
    }
    // Marcas de pase y soportes de los extremos.
    const materialMarca = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 });
    for (const t of [1 / 3, 2 / 3]) {
      const marca = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8), materialMarca);
      marca.position.copy(CURVA.getPointAt(t));
      escena.add(marca);
    }
    const materialSoporte = new THREE.MeshStandardMaterial({ color: 0x64748b });
    for (const t of [0, 1]) {
      const p = CURVA.getPointAt(t);
      const alto = p.y - ALTO_TABLERO;
      const soporte = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, alto, 12), materialSoporte);
      soporte.position.set(p.x, ALTO_TABLERO + alto / 2, p.z);
      soporte.castShadow = true;
      escena.add(soporte);
    }

    this.materialAro = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 });
    this.aro = new THREE.Mesh(new THREE.TorusGeometry(ARO.radio, ARO.tubo, 12, 40), this.materialAro);
    this.aro.castShadow = true;
    escena.add(this.aro);

    this.agarrable = new Agarrable("aro", this.aro, (p) => distanciaAAro(this.aro, ARO.radio, p), 0.4);
    this.gestor = new GestorAgarre([this.agarrable], ctx.instrumentos, ctx.bus, {
      impedir: (_obj, lado) => (tramoDe(this.t, lado) ? null : "Este tramo es con la otra pinza (mirá el color del alambre)."),
      alSoltar: () => this.colgar(),
    });
    this.reiniciar();
  }

  reiniciar(): void {
    this.indice = Math.round(INICIO * MUESTRAS);
    this.contacto = false;
    this.tiempoContacto = 0;
    this.materialAro.color.setHex(0xf97316);
    this.gestor.reiniciar();
    this.colgar();
  }

  /** Suelto, el aro cuelga del alambre, perpendicular a él. */
  private colgar(): void {
    const p = this.puntos[this.indice];
    const tangente = this.tangentes[this.indice];
    const abajo = new THREE.Vector3(0, -1, 0);
    abajo.addScaledVector(tangente, -abajo.dot(tangente)).normalize();
    this.aro.position.copy(p).addScaledVector(abajo, HOLGURA);
    this.aro.quaternion.setFromUnitVectors(EJE_Z, tangente);
  }

  actualizar(dt: number, enCurso: boolean): void {
    this.gestor.actualizar(dt, enCurso);
    this.aviso = this.gestor.aviso;
    const portador = this.agarrable.portador;
    let tocando = false;

    if (portador) {
      const deseada = this.agarrable.poseDeseada(this.ctx.instrumentos[portador]);
      const tramo = tramoDe(this.t, portador);
      // Punto del alambre más cercano a donde la pinza quiere llevar el aro,
      // buscando cerca del actual (para no saltar a otra parte de la curva).
      let mejor = this.indice;
      let distancia = Infinity;
      const desde = Math.max(0, this.indice - VENTANA);
      const hasta = Math.min(MUESTRAS, this.indice + VENTANA);
      for (let i = desde; i <= hasta; i++) {
        const d = this.puntos[i].distanceToSquared(deseada.posicion);
        if (d < distancia) {
          distancia = d;
          mejor = i;
        }
      }
      if (tramo) {
        const min = Math.round(Math.max(tramo.desde - TOLERANCIA_TRAMO, 0.01) * MUESTRAS);
        const max = Math.round(Math.min(tramo.hasta + TOLERANCIA_TRAMO, 0.99) * MUESTRAS);
        this.indice = THREE.MathUtils.clamp(mejor, min, max);
      }

      const p = this.puntos[this.indice];
      const tangente = this.tangentes[this.indice];
      // Inclinado respecto del alambre, el aro deja menos espacio libre.
      const eje = EJE_Z.clone().applyQuaternion(deseada.orientacion);
      const coseno = Math.abs(eje.dot(tangente));
      const holgura = Math.max(0.05, ARO.radio * coseno - ARO.tubo - ALAMBRE);
      const desvio = deseada.posicion.clone().sub(p);
      desvio.addScaledVector(tangente, -desvio.dot(tangente));
      if (desvio.length() > holgura) {
        tocando = true;
        desvio.setLength(holgura);
      }
      this.aro.position.copy(p).add(desvio);
      this.aro.quaternion.copy(deseada.orientacion);
    }

    if (tocando && !this.contacto && enCurso) this.ctx.bus.emitir("contacto", { t: Number(this.t.toFixed(3)) });
    this.contacto = tocando;
    if (tocando && enCurso) this.tiempoContacto += dt;
    this.materialAro.color.setHex(tocando ? 0xdc2626 : 0xf97316);
  }

  estado(): EstadoEjercicio {
    const completo = this.t >= FIN;
    const tramo = TRAMOS.findIndex((tr) => this.t < tr.hasta) + 1 || TRAMOS.length;
    const lado = TRAMOS[tramo - 1].lado === "izquierda" ? "izquierda (azul)" : "derecha (verde)";
    return {
      instruccion: completo
        ? "¡Listo!"
        : `Llevá el aro por el alambre sin tocarlo. Este tramo es con la pinza ${lado}; en cada marca blanca pasale el aro a la otra pinza.`,
      progreso: `Tramo ${tramo} de 3 · ${Math.round(Math.min(this.t / FIN, 1) * 100)}%`,
      aviso: this.aviso ?? undefined,
      completo,
    };
  }

  resultados(): DatoResultado[] {
    return [
      { etiqueta: "Contactos con el alambre", valor: String(this.ctx.bus.contar("contacto")) },
      { etiqueta: "Tiempo en contacto", valor: `${this.tiempoContacto.toFixed(1)} s` },
      { etiqueta: "Transferencias", valor: String(this.ctx.bus.contar("transferencia")) },
    ];
  }
}
