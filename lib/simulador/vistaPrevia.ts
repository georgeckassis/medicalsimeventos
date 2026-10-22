import type { Configuracion } from "./configuracion";
import { CONEXIONES, P, type ManoCruda } from "./tracking/proveedor";

/**
 * Dibuja lo que ve la cámara, girado como lo ve el usuario (arriba = lejos),
 * con el esqueleto de las manos detectadas.
 */
export function dibujarVistaPrevia(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  manos: ManoCruda[],
  config: Configuracion,
  ancho: number,
): void {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;
  const girada = config.rotacion % 180 !== 0;
  const alto = Math.round(ancho * (girada ? w / h : h / w));
  if (canvas.width !== ancho || canvas.height !== alto) {
    canvas.width = ancho;
    canvas.height = alto;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const escala = ancho / (girada ? h : w);

  ctx.save();
  ctx.translate(ancho / 2, alto / 2);
  ctx.rotate((config.rotacion * Math.PI) / 180);
  if (config.espejar) ctx.scale(-1, 1);
  ctx.scale(escala, escala);
  ctx.drawImage(video, -w / 2, -h / 2, w, h);

  const grosor = 2 / escala;
  for (const mano of manos) {
    const pt = (i: number) => [mano.imagen[i].x * w - w / 2, mano.imagen[i].y * h - h / 2] as const;
    ctx.strokeStyle = "rgba(34, 211, 238, 0.9)";
    ctx.lineWidth = grosor;
    ctx.beginPath();
    for (const [a, b] of CONEXIONES) {
      ctx.moveTo(...pt(a));
      ctx.lineTo(...pt(b));
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(250, 204, 21, 1)";
    ctx.lineWidth = grosor * 2;
    ctx.beginPath();
    ctx.moveTo(...pt(P.pulgarPunta));
    ctx.lineTo(...pt(P.indicePunta));
    ctx.stroke();
  }
  ctx.restore();
}
