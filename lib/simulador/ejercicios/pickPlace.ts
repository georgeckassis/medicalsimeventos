import * as THREE from "three";
import type { Lado } from "../configuracion";
import { Agarrable, GestorAgarre, distanciaAAro } from "./agarre";
import type { ContextoEjercicio, DatoResultado, Ejercicio, EstadoEjercicio } from "./tipos";

/**
 * Pick & place (peg transfer): pasar 6 aros de los postes de la izquierda a
 * los de la derecha, transfiriéndolos en el aire de la pinza izquierda a la
 * derecha. Después, al revés.
 */

const TABLERO = { ancho: 14, fondo: 9, alto: 0.4 };
const POSTE = { radio: 0.15, alto: 1.8 };
const ARO = { radio: 0.5, tubo: 0.13 };
const GRAVEDAD = 400; // cm/s²: menos que la real, para que la caída se vea
const ENCAJE_POSTE = 0.4;
const ESPERA_REPOSICION_S = 1.2;
const COLORES = [0xf97316, 0xeab308, 0xec4899, 0x8b5cf6, 0x06b6d4, 0xef4444];
const PLANO = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

const POSTES: Record<Lado, THREE.Vector3[]> = { izquierda: [], derecha: [] };
for (const [lado, xs] of [
  ["izquierda", [-5.2, -3.6]],
  ["derecha", [3.6, 5.2]],
] as const) {
  for (const x of xs) for (const z of [-2.5, 0, 2.5]) POSTES[lado].push(new THREE.Vector3(x, TABLERO.alto, z));
}

type Ubicacion =
  | { tipo: "poste"; lado: Lado; indice: number }
  | { tipo: "tablero" }
  | { tipo: "sostenido" }
  | { tipo: "cayendo"; destino: Ubicacion; y: number; velocidad: number }
  | { tipo: "perdido"; espera: number };

interface Aro {
  agarrable: Agarrable;
  ubicacion: Ubicacion;
  transferido: boolean;
}

const otroLado = (l: Lado): Lado => (l === "izquierda" ? "derecha" : "izquierda");

function sobreTablero(x: number, z: number): boolean {
  return Math.abs(x) <= TABLERO.ancho / 2 && Math.abs(z) <= TABLERO.fondo / 2;
}

export class PickPlace implements Ejercicio {
  readonly limites = {
    punta: new THREE.Box3(new THREE.Vector3(-14, 0, -10), new THREE.Vector3(14, 10, 8)),
    camara: new THREE.Box3(new THREE.Vector3(-10, 4, -4), new THREE.Vector3(10, 20, 22)),
    alturaSuperficie: (x: number, z: number) => (sobreTablero(x, z) ? TABLERO.alto : 0),
  };
  readonly camaraInicial = { posicion: new THREE.Vector3(0, 9, 10), mira: new THREE.Vector3(0, 0.5, 0) };
  readonly trocares = { izquierda: new THREE.Vector3(-11, 10, 5), derecha: new THREE.Vector3(11, 10, 5) };
  readonly puntasIniciales = { izquierda: new THREE.Vector3(-3, 2.5, 1.5), derecha: new THREE.Vector3(3, 2.5, 1.5) };

  private ctx!: ContextoEjercicio;
  private aros: Aro[] = [];
  private gestor!: GestorAgarre;
  /** Lado de donde salen los aros en la fase actual. */
  private origen: Lado = "izquierda";
  private fase = 1;

  montar(ctx: ContextoEjercicio): void {
    this.ctx = ctx;
    const escena = ctx.escena.escena;

    const tablero = new THREE.Mesh(
      new THREE.BoxGeometry(TABLERO.ancho, TABLERO.alto, TABLERO.fondo),
      new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.7 }),
    );
    tablero.position.y = TABLERO.alto / 2;
    tablero.receiveShadow = true;
    escena.add(tablero);

    const materialPoste = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5 });
    for (const base of [...POSTES.izquierda, ...POSTES.derecha]) {
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(POSTE.radio, POSTE.radio, POSTE.alto, 12), materialPoste);
      poste.position.set(base.x, base.y + POSTE.alto / 2, base.z);
      poste.castShadow = true;
      poste.receiveShadow = true;
      escena.add(poste);
    }

    this.aros = COLORES.map((color, i) => {
      const malla = new THREE.Mesh(
        new THREE.TorusGeometry(ARO.radio, ARO.tubo, 12, 32),
        new THREE.MeshStandardMaterial({ color, roughness: 0.45 }),
      );
      malla.castShadow = true;
      escena.add(malla);
      const agarrable = new Agarrable(`aro${i + 1}`, malla, (p) => distanciaAAro(malla, ARO.radio, p), 0.35);
      return { agarrable, ubicacion: { tipo: "tablero" }, transferido: false };
    });

    this.gestor = new GestorAgarre(
      this.aros.map((a) => a.agarrable),
      ctx.instrumentos,
      ctx.bus,
      { alSoltar: (obj) => this.soltar(this.aros.find((a) => a.agarrable === obj)!) },
    );
    this.reiniciar();
  }

  reiniciar(): void {
    this.origen = "izquierda";
    this.fase = 1;
    this.aros.forEach((aro, i) => {
      aro.transferido = false;
      this.colocarEnPoste(aro, "izquierda", i);
    });
    this.gestor.reiniciar();
  }

  private alturaEnPoste(lado: Lado, indice: number, excepto: Aro): number {
    const apilados = this.aros.filter(
      (a) => a !== excepto && a.ubicacion.tipo === "poste" && a.ubicacion.lado === lado && a.ubicacion.indice === indice,
    ).length;
    return TABLERO.alto + ARO.tubo + apilados * ARO.tubo * 2;
  }

  private colocarEnPoste(aro: Aro, lado: Lado, indice: number): void {
    const base = POSTES[lado][indice];
    const o = aro.agarrable.objeto;
    o.position.set(base.x, this.alturaEnPoste(lado, indice, aro), base.z);
    o.quaternion.copy(PLANO);
    aro.ubicacion = { tipo: "poste", lado, indice };
  }

  /** Al soltarlo: encaja en un poste, queda en el tablero o se cae fuera. */
  private soltar(aro: Aro): void {
    const p = aro.agarrable.objeto.position;
    let destino: Ubicacion = sobreTablero(p.x, p.z) ? { tipo: "tablero" } : { tipo: "perdido", espera: ESPERA_REPOSICION_S };
    let y = sobreTablero(p.x, p.z) ? TABLERO.alto + ARO.tubo : ARO.tubo;
    let mejor = ENCAJE_POSTE;
    let poste: { lado: Lado; indice: number } | null = null;
    for (const lado of ["izquierda", "derecha"] as const) {
      for (let indice = 0; indice < POSTES[lado].length; indice++) {
        const base = POSTES[lado][indice];
        const d = Math.hypot(p.x - base.x, p.z - base.z);
        if (d < mejor && p.y > TABLERO.alto) {
          mejor = d;
          poste = { lado, indice };
        }
      }
    }
    if (poste) {
      const base = POSTES[poste.lado][poste.indice];
      p.x = base.x;
      p.z = base.z;
      y = this.alturaEnPoste(poste.lado, poste.indice, aro);
      destino = { tipo: "poste", ...poste };
    }
    aro.agarrable.objeto.quaternion.copy(PLANO);
    aro.ubicacion = { tipo: "cayendo", destino, y, velocidad: 0 };
  }

  actualizar(dt: number, enCurso: boolean): void {
    this.gestor.actualizar(dt, enCurso);

    for (const aro of this.aros) {
      const o = aro.agarrable.objeto;
      const portador = aro.agarrable.portador;
      if (portador) {
        const pose = aro.agarrable.poseDeseada(this.ctx.instrumentos[portador]);
        o.position.copy(pose.posicion);
        o.quaternion.copy(pose.orientacion);
        o.position.y = Math.max(o.position.y, this.limites.alturaSuperficie(o.position.x, o.position.z) + ARO.tubo);
        aro.ubicacion = { tipo: "sostenido" };
        if (aro.agarrable.sostenidoPor.length === 2) aro.transferido = true;
        continue;
      }

      const u = aro.ubicacion;
      if (u.tipo === "cayendo") {
        u.velocidad += GRAVEDAD * dt;
        o.position.y -= u.velocidad * dt;
        if (o.position.y > u.y) continue;
        o.position.y = u.y;
        aro.ubicacion = u.destino;
        const d = u.destino;
        if (d.tipo === "poste" && d.lado === otroLado(this.origen)) {
          if (enCurso) this.ctx.bus.emitir("colocacion", { objeto: aro.agarrable.id, sinTransferencia: !aro.transferido });
          aro.transferido = false;
        }
        if (d.tipo === "perdido" && enCurso) this.ctx.bus.emitir("caida", { objeto: aro.agarrable.id });
      } else if (u.tipo === "perdido") {
        u.espera -= dt;
        if (u.espera <= 0) this.reponer(aro);
      }
    }

    const destino = otroLado(this.origen);
    const listos = this.aros.every((a) => a.ubicacion.tipo === "poste" && a.ubicacion.lado === destino);
    if (enCurso && listos && this.fase === 1) {
      this.fase = 2;
      this.origen = destino;
    }
  }

  /** Un aro que cayó fuera del tablero vuelve a un poste libre del lado de origen. */
  private reponer(aro: Aro): void {
    const ocupados = new Set(
      this.aros.flatMap((a) => (a.ubicacion.tipo === "poste" && a.ubicacion.lado === this.origen ? [a.ubicacion.indice] : [])),
    );
    const libre = POSTES[this.origen].findIndex((_, i) => !ocupados.has(i));
    this.colocarEnPoste(aro, this.origen, libre === -1 ? 0 : libre);
    aro.transferido = false;
  }

  estado(): EstadoEjercicio {
    const destino = otroLado(this.origen);
    const colocados = this.aros.filter((a) => a.ubicacion.tipo === "poste" && a.ubicacion.lado === destino).length;
    const completo = this.fase === 2 && colocados === this.aros.length;
    const desde = this.origen === "izquierda" ? "izquierda (azul)" : "derecha (verde)";
    const hacia = destino === "izquierda" ? "izquierda (azul)" : "derecha (verde)";
    return {
      instruccion: completo
        ? "¡Listo!"
        : `Tomá cada aro con la pinza ${desde}, pasalo en el aire a la pinza ${hacia} y dejalo en un poste del otro lado.`,
      progreso: `Fase ${this.fase} de 2 · ${colocados}/${this.aros.length} aros`,
      aviso: this.gestor.aviso ?? undefined,
      completo,
    };
  }

  resultados(): DatoResultado[] {
    const bus = this.ctx.bus;
    const sinTransferir = bus.eventos().filter((e) => e.tipo === "colocacion" && e.datos?.sinTransferencia).length;
    return [
      { etiqueta: "Transferencias en el aire", valor: String(bus.contar("transferencia")) },
      { etiqueta: "Aros colocados sin transferir", valor: String(sinTransferir) },
      { etiqueta: "Caídas fuera del tablero", valor: String(bus.contar("caida")) },
    ];
  }
}
