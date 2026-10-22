import * as THREE from "three";
import { PINZA_POR_DEFECTO, type Configuracion, type Lado, type Rotacion } from "../configuracion";
import { P, type ManoCruda, type Punto3 } from "../tracking/proveedor";
import { FiltroEscalar, FiltroRotacion, FiltroVector } from "./filtros";

/**
 * Convierte cada mano detectada en el estado de un "controlador maestro" de
 * la consola, en el marco del usuario: X hacia su derecha, Y hacia arriba y
 * Z hacia él (cm). Es el mismo marco que la cámara del endoscopio en
 * pantalla, que es lo que da la alineación ojo-mano.
 */
export interface EstadoMaestro {
  /** Posición del agarre (entre la base del pulgar y la del índice), en cm. */
  posicion: THREE.Vector3;
  orientacion: THREE.Quaternion;
  /** 0 = pinza cerrada, 1 = abierta (con la calibración de esa mano). */
  apertura: number;
  /** Distancia pulgar-índice / largo de la palma, sin calibrar (para la calibración). */
  pinzaCruda: number;
  /** Tamaño aparente de la mano en la imagen (para la calibración de altura). */
  tamano: number;
}

/** Tamaño aparente típico de una mano a la distancia de referencia, si todavía no se calibró. */
const TAMANO_REF_POR_DEFECTO = 0.23;
/** Si una mano no se ve por más de esto, al volver se reinician sus filtros. */
const PERDIDA_REINICIO_S = 0.4;

function rotar(x: number, y: number, rotacion: Rotacion): [number, number] {
  switch (rotacion) {
    case 90:
      return [-y, x];
    case 180:
      return [-x, -y];
    case 270:
      return [y, -x];
    default:
      return [x, y];
  }
}

/**
 * Punto de la imagen orientado según la configuración, centrado y en
 * unidades del alto de la imagen: x hacia la derecha del usuario, y hacia él.
 */
export function orientarImagen(p: Punto3, aspecto: number, config: Configuracion): [number, number] {
  let x = (p.x - 0.5) * aspecto;
  if (config.espejar) x = -x;
  return rotar(x, p.y - 0.5, config.rotacion);
}

/** Punto en metros de MediaPipe al marco del usuario (X derecha, Y arriba, Z hacia él). */
function orientarMundo(p: Punto3, config: Configuracion): THREE.Vector3 {
  const [x, y] = rotar(config.espejar ? -p.x : p.x, p.y, config.rotacion);
  // La cámara mira hacia abajo: lo que se aleja de la cámara (z) es hacia abajo.
  return new THREE.Vector3(x, -p.z, y);
}

function distanciaImagen(a: Punto3, b: Punto3, aspecto: number): number {
  return Math.hypot((a.x - b.x) * aspecto, a.y - b.y, (a.z - b.z) * aspecto);
}

/** Tamaño aparente de la palma: varios huesos, en 3D, para que no dependa del giro de la mano. */
function tamanoAparente(m: ManoCruda): number {
  const i = m.imagen;
  const huesos: Array<[number, number]> = [
    [P.muneca, P.indiceMcp],
    [P.muneca, P.medioMcp],
    [P.muneca, P.meniqueMcp],
    [P.indiceMcp, P.meniqueMcp],
  ];
  return huesos.reduce((s, [a, b]) => s + distanciaImagen(i[a], i[b], m.aspecto), 0) / huesos.length;
}

function orientacionPalma(m: ManoCruda, config: Configuracion): THREE.Quaternion {
  const w = (k: number) => orientarMundo(m.mundo[k], config);
  const adelante = w(P.medioMcp).sub(w(P.muneca)).normalize();
  const lateral = w(P.indiceMcp).sub(w(P.meniqueMcp));
  const ejeX = lateral.sub(adelante.clone().multiplyScalar(lateral.dot(adelante))).normalize();
  const ejeZ = adelante.clone().negate();
  const ejeY = new THREE.Vector3().crossVectors(ejeZ, ejeX);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(ejeX, ejeY, ejeZ));
}

export function pinzaCruda(m: ManoCruda): number {
  const d = (a: number, b: number) => {
    const p = m.mundo[a];
    const q = m.mundo[b];
    return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
  };
  return d(P.pulgarPunta, P.indicePunta) / Math.max(d(P.muneca, P.medioMcp), 1e-6);
}

interface Medida {
  mano: ManoCruda;
  posicion: THREE.Vector3;
  tamano: number;
}

interface FiltrosMano {
  posicion: FiltroVector;
  orientacion: FiltroRotacion;
  apertura: FiltroEscalar;
  visto: number;
  ultimaPosicion: THREE.Vector3 | null;
}

function nuevosFiltros(): FiltrosMano {
  return {
    // cm y cm/s; la altura (y) sale del tamaño aparente y es la más ruidosa.
    posicion: new FiltroVector([
      [1.0, 0.2],
      [0.5, 0.08],
      [1.0, 0.2],
    ]),
    orientacion: new FiltroRotacion(1.0, 0.5),
    apertura: new FiltroEscalar(1.5, 0.5),
    visto: -Infinity,
    ultimaPosicion: null,
  };
}

export class Consola {
  private filtros: Record<Lado, FiltrosMano> = { izquierda: nuevosFiltros(), derecha: nuevosFiltros() };
  private ultimoT = 0;

  constructor(private config: Configuracion) {}

  actualizarConfiguracion(config: Configuracion): void {
    this.config = config;
  }

  private medir(m: ManoCruda): Medida {
    const c = this.config;
    const tamano = tamanoAparente(m);
    const tamanoRef = c.calibracion?.tamanoRef ?? TAMANO_REF_POR_DEFECTO;
    // k > 1: la mano está más lejos de la cámara (más abajo) que en la posición neutra.
    const k = tamanoRef / tamano;
    const a = m.imagen[P.pulgarMcp];
    const b = m.imagen[P.indiceMcp];
    const [x, y] = orientarImagen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: 0 }, m.aspecto, c);
    const posicion = new THREE.Vector3(x * c.campoVisibleCm * k, (1 - k) * c.distanciaRefCm, y * c.campoVisibleCm * k);
    return { mano: m, posicion, tamano };
  }

  /**
   * Decide qué mano es cuál (no se usa la detección de MediaPipe, que se
   * confunde vista desde arriba). Si se venían siguiendo las dos, por
   * continuidad: cada una es la más cercana a donde estaba, así no se
   * intercambian cuando se acercan para pasarse un objeto. Si no, la de la
   * izquierda es la izquierda.
   */
  private asignar(medidas: Medida[]): Partial<Record<Lado, Medida>> {
    if (medidas.length >= 2) {
      const [a, b] = [...medidas].sort((p, q) => p.posicion.x - q.posicion.x);
      const pi = this.filtros.izquierda.ultimaPosicion;
      const pd = this.filtros.derecha.ultimaPosicion;
      if (pi && pd) {
        const directo = a.posicion.distanceTo(pi) + b.posicion.distanceTo(pd);
        const cruzado = b.posicion.distanceTo(pi) + a.posicion.distanceTo(pd);
        if (cruzado < directo) return { izquierda: b, derecha: a };
      }
      return { izquierda: a, derecha: b };
    }
    if (medidas.length === 1) {
      const m = medidas[0];
      const pi = this.filtros.izquierda.ultimaPosicion;
      const pd = this.filtros.derecha.ultimaPosicion;
      let lado: Lado;
      if (pi && pd) lado = m.posicion.distanceTo(pi) <= m.posicion.distanceTo(pd) ? "izquierda" : "derecha";
      else if (pi) lado = m.posicion.distanceTo(pi) < 8 || m.posicion.x < 0 ? "izquierda" : "derecha";
      else if (pd) lado = m.posicion.distanceTo(pd) < 8 || m.posicion.x >= 0 ? "derecha" : "izquierda";
      else lado = m.posicion.x < 0 ? "izquierda" : "derecha";
      return { [lado]: m };
    }
    return {};
  }

  /** `t` en segundos. */
  procesar(manos: ManoCruda[], t: number): Record<Lado, EstadoMaestro | null> {
    const dt = this.ultimoT ? Math.min(t - this.ultimoT, 0.2) : 1 / 30;
    this.ultimoT = t;
    const asignadas = this.asignar(manos.slice(0, 2).map((m) => this.medir(m)));
    const salida: Record<Lado, EstadoMaestro | null> = { izquierda: null, derecha: null };

    for (const lado of ["izquierda", "derecha"] as const) {
      const medida = asignadas[lado];
      const f = this.filtros[lado];
      if (!medida) {
        if (t - f.visto > PERDIDA_REINICIO_S) f.ultimaPosicion = null;
        continue;
      }
      if (t - f.visto > PERDIDA_REINICIO_S) {
        f.posicion.reiniciar();
        f.orientacion.reiniciar();
        f.apertura.reiniciar();
      }
      f.visto = t;
      f.ultimaPosicion = medida.posicion.clone();

      const calibracionPinza = this.config.calibracion?.manos[lado] ?? PINZA_POR_DEFECTO;
      const cruda = pinzaCruda(medida.mano);
      const rango = Math.max(calibracionPinza.pinzaMax - calibracionPinza.pinzaMin, 0.05);
      const apertura = THREE.MathUtils.clamp((cruda - calibracionPinza.pinzaMin) / rango, 0, 1);

      salida[lado] = {
        posicion: f.posicion.filtrar(medida.posicion, dt),
        orientacion: f.orientacion.filtrar(orientacionPalma(medida.mano, this.config), dt),
        apertura: THREE.MathUtils.clamp(f.apertura.filtrar(apertura, dt), 0, 1),
        pinzaCruda: cruda,
        tamano: medida.tamano,
      };
    }
    return salida;
  }
}
