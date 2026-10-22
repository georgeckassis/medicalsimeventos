import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { ManoCruda, ProveedorManos } from "./proveedor";

const RECURSOS = "/simulador-recursos";

/** Cámaras conectadas (para elegir cuál usar). Los nombres aparecen recién después de dar permiso. */
export async function listarCamaras(): Promise<MediaDeviceInfo[]> {
  const dispositivos = await navigator.mediaDevices.enumerateDevices();
  return dispositivos.filter((d) => d.kind === "videoinput");
}

export class ProveedorWebcam implements ProveedorManos {
  video: HTMLVideoElement | null = null;
  private detector: HandLandmarker | null = null;
  private flujo: MediaStream | null = null;
  private ultimoTiempoVideo = -1;
  private ultimoMs = 0;

  constructor(private camaraId: string) {}

  async iniciar(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Este navegador no permite usar la cámara. Probá con Chrome o Edge actualizados.");
    }
    try {
      this.flujo = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: this.camaraId ? { exact: this.camaraId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });
    } catch (e) {
      const nombre = e instanceof DOMException ? e.name : "";
      if (nombre === "NotAllowedError") throw new Error("No hay permiso para usar la cámara. Habilitalo en el candado de la barra de direcciones.");
      if (nombre === "NotFoundError" || nombre === "OverconstrainedError") throw new Error("No se encontró la cámara elegida. Revisá que esté conectada.");
      if (nombre === "NotReadableError") throw new Error("La cámara está en uso por otro programa.");
      throw e;
    }

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = this.flujo;
    await video.play();
    this.video = video;

    const archivos = await FilesetResolver.forVisionTasks(`${RECURSOS}/mediapipe`);
    const opciones = (delegado: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: `${RECURSOS}/modelos/hand_landmarker.task`, delegate: delegado },
      runningMode: "VIDEO" as const,
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
    try {
      this.detector = await HandLandmarker.createFromOptions(archivos, opciones("GPU"));
    } catch {
      // Sin aceleración por placa de video: anda igual, más lento.
      this.detector = await HandLandmarker.createFromOptions(archivos, opciones("CPU"));
    }
  }

  detectar(ahoraMs: number): ManoCruda[] | null {
    const video = this.video;
    if (!video || !this.detector || video.readyState < 2) return null;
    if (video.currentTime === this.ultimoTiempoVideo) return null;
    this.ultimoTiempoVideo = video.currentTime;
    // MediaPipe exige marcas de tiempo estrictamente crecientes.
    const ms = Math.max(ahoraMs, this.ultimoMs + 1);
    this.ultimoMs = ms;
    const r = this.detector.detectForVideo(video, ms);
    const aspecto = video.videoWidth / video.videoHeight;
    return r.landmarks.map((imagen, i) => ({ imagen, mundo: r.worldLandmarks[i], aspecto }));
  }

  detener(): void {
    this.detector?.close();
    this.detector = null;
    for (const pista of this.flujo?.getTracks() ?? []) pista.stop();
    this.flujo = null;
    if (this.video) this.video.srcObject = null;
    this.video = null;
  }
}
