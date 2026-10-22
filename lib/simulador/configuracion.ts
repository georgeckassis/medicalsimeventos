/**
 * Configuración del simulador de cada puesto (cámara, escala, teclas y
 * calibración). Queda guardada en el navegador: depende de la PC y de dónde
 * está la cámara, no del usuario.
 */

export type Lado = "izquierda" | "derecha";
export const LADOS: Lado[] = ["izquierda", "derecha"];

export type Rotacion = 0 | 90 | 180 | 270;

export interface CalibracionMano {
  /** Distancia pulgar-índice (relativa al largo de la palma) con la pinza cerrada y abierta. */
  pinzaMin: number;
  pinzaMax: number;
}

export interface Calibracion {
  /** Tamaño aparente de la mano en la posición neutra: referencia para estimar la altura. */
  tamanoRef: number;
  manos: Record<Lado, CalibracionMano>;
  fecha: string;
}

export interface Configuracion {
  /** Cámara elegida (deviceId); vacío = la predeterminada. */
  camaraId: string;
  /**
   * Cuánto hay que girar la imagen (en sentido horario) para que arriba quede
   * lo más lejos del usuario y la derecha sea su derecha. Cámara cenital con
   * el borde de arriba hacia el monitor: 0. Webcam del monitor inclinada
   * hacia el escritorio: 180.
   */
  rotacion: Rotacion;
  /** Algunas cámaras entregan la imagen espejada. */
  espejar: boolean;
  /** Alto (en cm) de lo que ve la cámara a la altura de las manos en posición neutra. */
  campoVisibleCm: number;
  /** Distancia (en cm) de la cámara a las manos en posición neutra. */
  distanciaRefCm: number;
  /** Escala de movimiento: 3 = 3 cm de la mano mueven 1 cm la punta. */
  escala: number;
  /** Ayuda visual: línea vertical de la punta al piso, para juzgar la profundidad. */
  ayudaProfundidad: boolean;
  teclasClutch: string[];
  teclasCamara: string[];
  calibracion: Calibracion | null;
}

export const PINZA_POR_DEFECTO: CalibracionMano = { pinzaMin: 0.12, pinzaMax: 0.9 };

export const CONFIGURACION_POR_DEFECTO: Configuracion = {
  camaraId: "",
  rotacion: 0,
  espejar: false,
  campoVisibleCm: 35,
  distanciaRefCm: 40,
  escala: 3,
  ayudaProfundidad: true,
  // F13/F14: las que manda el pedal (no existen en los teclados comunes).
  teclasClutch: ["Space", "F13"],
  teclasCamara: ["ShiftLeft", "ShiftRight", "F14"],
  calibracion: null,
};

const CLAVE = "simulador.configuracion";

export function leerConfiguracion(): Configuracion {
  try {
    const guardada = localStorage.getItem(CLAVE);
    if (guardada) return { ...CONFIGURACION_POR_DEFECTO, ...(JSON.parse(guardada) as Partial<Configuracion>) };
  } catch {
    // Sin acceso al almacenamiento (modo privado): se usa la de fábrica.
  }
  return { ...CONFIGURACION_POR_DEFECTO };
}

export function guardarConfiguracion(config: Configuracion): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(config));
  } catch {
    // Sin almacenamiento la configuración dura lo que dura la pestaña.
  }
}

/** Nombre legible de una tecla (KeyboardEvent.code). */
export function nombreTecla(codigo: string): string {
  const nombres: Record<string, string> = {
    Space: "Espacio",
    ShiftLeft: "Shift izq.",
    ShiftRight: "Shift der.",
    ControlLeft: "Ctrl izq.",
    ControlRight: "Ctrl der.",
    AltLeft: "Alt izq.",
    AltRight: "Alt der.",
  };
  if (nombres[codigo]) return nombres[codigo];
  if (codigo.startsWith("Key")) return codigo.slice(3);
  if (codigo.startsWith("Digit")) return codigo.slice(5);
  return codigo;
}
