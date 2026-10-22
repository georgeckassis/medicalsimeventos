/**
 * Fuente de manos. Hoy: una webcam con MediaPipe. Mañana: dos cámaras, un
 * visor de VR o un controlador físico; todas entregan lo mismo y el resto del
 * simulador no cambia.
 */

export interface Punto3 {
  x: number;
  y: number;
  z: number;
}

/** Los 21 puntos de MediaPipe de una mano detectada. */
export interface ManoCruda {
  /** Coordenadas en la imagen: x e y de 0 a 1 (y hacia abajo); z relativa, en la escala de x. */
  imagen: Punto3[];
  /** Coordenadas reales en metros, con origen en el centro de la mano y ejes de la imagen. */
  mundo: Punto3[];
  /** Ancho / alto de la imagen. */
  aspecto: number;
}

export interface ProveedorManos {
  iniciar(): Promise<void>;
  /** Devuelve las manos del último cuadro, o null si no hay un cuadro nuevo desde la última vez. */
  detectar(ahoraMs: number): ManoCruda[] | null;
  /** El video para mostrar la vista previa (si la fuente es una cámara). */
  readonly video: HTMLVideoElement | null;
  detener(): void;
}

/** Índices de MediaPipe Hands que usa el simulador. */
export const P = {
  muneca: 0,
  pulgarCmc: 1,
  pulgarMcp: 2,
  pulgarPunta: 4,
  indiceMcp: 5,
  indicePunta: 8,
  medioMcp: 9,
  anularMcp: 13,
  meniqueMcp: 17,
} as const;

/** Huesos que se dibujan en la vista previa. */
export const CONEXIONES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
