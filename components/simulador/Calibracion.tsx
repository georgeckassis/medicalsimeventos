"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Encabezado from "@/components/Encabezado";
import {
  LADOS,
  guardarConfiguracion,
  leerConfiguracion,
  type Calibracion as DatosCalibracion,
  type Configuracion,
  type Lado,
  type Rotacion,
} from "@/lib/simulador/configuracion";
import { Consola, type EstadoMaestro } from "@/lib/simulador/consola/maestro";
import type { ManoCruda } from "@/lib/simulador/tracking/proveedor";
import { ProveedorWebcam } from "@/lib/simulador/tracking/webcam";
import { dibujarVistaPrevia } from "@/lib/simulador/vistaPrevia";

/**
 * Calibración de cada puesto:
 * 1. Cámara: orientación de la imagen (que la derecha sea la derecha y arriba, lejos).
 * 2. Posición neutra: tamaño aparente de las manos, referencia para estimar la altura.
 * 3. Pinza: rango de apertura pulgar-índice de cada mano.
 */

type Paso = "camara" | "neutra" | "pinza" | "listo";

const QUIETO_CM = 1.5;
const QUIETO_S = 2;
const PINZA_S = 6;

interface Vista {
  manos: Record<Lado, EstadoMaestro | null>;
  /** 0 a 1: avance del paso actual. */
  avance: number;
}

function percentil(valores: number[], p: number): number {
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.max(0, Math.round((orden.length - 1) * p)))];
}

export default function Calibracion() {
  const [config, setConfig] = useState<Configuracion>(leerConfiguracion);
  const [paso, setPaso] = useState<Paso>("camara");
  const [vista, setVista] = useState<Vista>({ manos: { izquierda: null, derecha: null }, avance: 0 });
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const vistaPrevia = useRef<HTMLCanvasElement>(null);
  const mapa = useRef<HTMLCanvasElement>(null);

  // El ciclo de cuadros lee el paso y la configuración actuales por referencia.
  const pasoRef = useRef(paso);
  const configRef = useRef(config);
  const consolaRef = useRef<Consola | null>(null);
  useEffect(() => {
    pasoRef.current = paso;
    configRef.current = config;
    consolaRef.current?.actualizarConfiguracion(config);
  }, [paso, config]);

  // Datos que junta cada paso.
  const neutra = useRef<{ desde: number; ancla: Record<Lado, EstadoMaestro> | null; tamanos: number[] }>({
    desde: 0,
    ancla: null,
    tamanos: [],
  });
  const pinza = useRef<{ desde: number; muestras: Record<Lado, number[]> }>({ desde: 0, muestras: { izquierda: [], derecha: [] } });

  useEffect(() => {
    const proveedor = new ProveedorWebcam(configRef.current.camaraId);
    const consola = new Consola(configRef.current);
    consolaRef.current = consola;
    let raf = 0;
    let ultimoAviso = 0;
    let manosCrudas: ManoCruda[] = [];
    let maestros: Record<Lado, EstadoMaestro | null> = { izquierda: null, derecha: null };
    let cerrado = false;

    const cuadro = (ahora: number) => {
      raf = requestAnimationFrame(cuadro);
      const t = ahora / 1000;
      const manos = proveedor.detectar(ahora);
      if (manos) {
        manosCrudas = manos;
        maestros = consola.procesar(manos, t);
      }
      const ambas = !!maestros.izquierda && !!maestros.derecha;
      let avance = 0;

      if (pasoRef.current === "neutra") {
        const n = neutra.current;
        const quietas =
          ambas &&
          n.ancla !== null &&
          LADOS.every((l) => maestros[l]!.posicion.distanceTo(n.ancla![l].posicion) < QUIETO_CM);
        if (!quietas) {
          n.desde = t;
          n.ancla = ambas ? { izquierda: maestros.izquierda!, derecha: maestros.derecha! } : null;
          n.tamanos = [];
        } else if (manos) {
          n.tamanos.push(maestros.izquierda!.tamano, maestros.derecha!.tamano);
        }
        avance = quietas ? Math.min((t - n.desde) / QUIETO_S, 1) : 0;
        if (avance >= 1) {
          const tamanoRef = n.tamanos.reduce((s, x) => s + x, 0) / n.tamanos.length;
          const nueva = { ...configRef.current, calibracion: { ...calibracionBase(configRef.current), tamanoRef } };
          configRef.current = nueva;
          consola.actualizarConfiguracion(nueva);
          setConfig(nueva);
          pinza.current = { desde: 0, muestras: { izquierda: [], derecha: [] } };
          pasoRef.current = "pinza";
          setPaso("pinza");
        }
      } else if (pasoRef.current === "pinza") {
        const p = pinza.current;
        if (ambas && manos) {
          if (!p.desde) p.desde = t;
          for (const l of LADOS) p.muestras[l].push(maestros[l]!.pinzaCruda);
        }
        avance = p.desde ? Math.min((t - p.desde) / PINZA_S, 1) : 0;
        if (avance >= 1) {
          const rangos = LADOS.map((l) => ({
            lado: l,
            pinzaMin: percentil(p.muestras[l], 0.05),
            pinzaMax: percentil(p.muestras[l], 0.95),
          }));
          if (rangos.some((r) => r.pinzaMax - r.pinzaMin < 0.3)) {
            setAviso("No se vio la pinza abrirse y cerrarse del todo. Probá de nuevo, abriendo bien los dedos.");
            pinza.current = { desde: 0, muestras: { izquierda: [], derecha: [] } };
          } else {
            const base = configRef.current.calibracion ?? calibracionBase(configRef.current);
            const calibracion: DatosCalibracion = {
              ...base,
              manos: {
                izquierda: { pinzaMin: rangos[0].pinzaMin, pinzaMax: rangos[0].pinzaMax },
                derecha: { pinzaMin: rangos[1].pinzaMin, pinzaMax: rangos[1].pinzaMax },
              },
              fecha: new Date().toISOString(),
            };
            const nueva = { ...configRef.current, calibracion };
            configRef.current = nueva;
            guardarConfiguracion(nueva);
            setConfig(nueva);
            setAviso(null);
            pasoRef.current = "listo";
            setPaso("listo");
          }
        }
      }

      const video = proveedor.video;
      if (vistaPrevia.current && video) dibujarVistaPrevia(vistaPrevia.current, video, manosCrudas, configRef.current, 480);
      if (mapa.current) dibujarMapa(mapa.current, maestros);
      if (ahora - ultimoAviso > 100) {
        ultimoAviso = ahora;
        setVista({ manos: maestros, avance });
      }
    };

    proveedor
      .iniciar()
      .then(() => {
        if (!cerrado) raf = requestAnimationFrame(cuadro);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setCargando(false));
    return () => {
      cerrado = true;
      cancelAnimationFrame(raf);
      proveedor.detener();
      consolaRef.current = null;
    };
  }, []);

  function cambiarCamara(parcial: Partial<Configuracion>) {
    const nueva = { ...config, ...parcial };
    setConfig(nueva);
    guardarConfiguracion(nueva);
  }

  const ambas = !!vista.manos.izquierda && !!vista.manos.derecha;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Encabezado titulo="Calibración del simulador" descripcion="Se hace una vez por puesto; repetila si cambia la cámara, la luz o la persona.">
        <Link href="/simulador" className="boton-secundario">
          Volver
        </Link>
      </Encabezado>

      <ol className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
        {(["camara", "neutra", "pinza", "listo"] as const).map((p, i) => (
          <li
            key={p}
            className={`rounded-full px-3 py-1 ${paso === p ? "bg-brand-navy text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900"}`}
          >
            {i + 1}. {{ camara: "Cámara", neutra: "Posición neutra", pinza: "Pinza", listo: "Listo" }[p]}
          </li>
        ))}
      </ol>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="relative">
          <canvas ref={vistaPrevia} className="w-full rounded-lg bg-zinc-900" />
          {(cargando || error) && (
            <div className="absolute inset-0 flex min-h-48 items-center justify-center rounded-lg bg-zinc-900 p-6 text-center text-sm text-white">
              {error ? <span className="text-red-300">{error}</span> : "Abriendo la cámara y cargando la detección de manos…"}
            </div>
          )}
          <p className="mt-1 text-xs text-zinc-500">
            Manos detectadas: {ambas ? "las dos" : vista.manos.izquierda || vista.manos.derecha ? "una" : "ninguna"}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <canvas ref={mapa} width={280} height={200} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800" />
            <p className="mt-1 text-xs text-zinc-500">Vista desde arriba: azul = mano izquierda, verde = derecha.</p>
          </div>

          <section className="tarjeta p-4 text-sm">
            {paso === "camara" && (
              <>
                <h2 className="mb-2 font-bold">Orientación de la cámara</h2>
                <p className="mb-2 text-zinc-600 dark:text-zinc-400">
                  Poné las dos manos bajo la cámara. Movelas hacia tu derecha: los puntos del mapa tienen que ir a la derecha. Alejalas
                  de vos: tienen que subir. Si no, cambiá la ubicación.
                </p>
                <label className="etiqueta">Ubicación de la cámara</label>
                <select
                  className="campo mb-2"
                  value={config.rotacion}
                  onChange={(e) => cambiarCamara({ rotacion: Number(e.target.value) as Rotacion })}
                >
                  <option value={0}>Arriba, borde superior hacia el monitor</option>
                  <option value={180}>En el monitor, inclinada hacia abajo</option>
                  <option value={90}>Girada 90° (a la derecha)</option>
                  <option value={270}>Girada 90° (a la izquierda)</option>
                </select>
                <label className="mb-3 flex items-center gap-2">
                  <input type="checkbox" checked={config.espejar} onChange={(e) => cambiarCamara({ espejar: e.target.checked })} />
                  Imagen espejada
                </label>
                <button type="button" className="boton w-full" disabled={!ambas} onClick={() => setPaso("neutra")}>
                  {ambas ? "Siguiente" : "Esperando las dos manos…"}
                </button>
              </>
            )}
            {paso === "neutra" && (
              <>
                <h2 className="mb-2 font-bold">Posición neutra</h2>
                <p className="mb-3 text-zinc-600 dark:text-zinc-400">
                  Dejá las manos relajadas, en el aire, como sosteniendo los controles de la consola y a la altura en la que vas a
                  trabajar. Quedate quieto unos segundos.
                </p>
                <Barra avance={vista.avance} />
              </>
            )}
            {paso === "pinza" && (
              <>
                <h2 className="mb-2 font-bold">Pinza</h2>
                <p className="mb-3 text-zinc-600 dark:text-zinc-400">
                  Con las dos manos, juntá pulgar e índice hasta tocarse y abrilos bien, varias veces, hasta que se llene la barra.
                </p>
                <Barra avance={vista.avance} />
                {aviso && <p className="mt-2 text-xs text-red-600">{aviso}</p>}
              </>
            )}
            {paso === "listo" && (
              <>
                <h2 className="mb-2 font-bold">¡Calibración guardada!</h2>
                <p className="mb-3 text-zinc-600 dark:text-zinc-400">Ya podés hacer los ejercicios.</p>
                <div className="flex gap-2">
                  <Link href="/simulador" className="boton flex-1">
                    Ir a los ejercicios
                  </Link>
                  <button type="button" className="boton-secundario" onClick={() => setPaso("camara")}>
                    Repetir
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function calibracionBase(config: Configuracion): DatosCalibracion {
  return (
    config.calibracion ?? {
      tamanoRef: 0.23,
      manos: { izquierda: { pinzaMin: 0.12, pinzaMax: 0.9 }, derecha: { pinzaMin: 0.12, pinzaMax: 0.9 } },
      fecha: new Date().toISOString(),
    }
  );
}

function Barra({ avance }: { avance: number }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div className="h-full bg-brand-cyan transition-[width]" style={{ width: `${Math.round(avance * 100)}%` }} />
    </div>
  );
}

/** Mapa visto desde arriba de dónde están las manos (±25 cm) y cuán abierta está cada pinza. */
function dibujarMapa(canvas: HTMLCanvasElement, manos: Record<Lado, EstadoMaestro | null>) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(127,127,127,0.4)";
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(127,127,127,0.8)";
  ctx.font = "11px sans-serif";
  ctx.fillText("lejos", w / 2 + 4, 12);
  ctx.fillText("cerca (vos)", w / 2 + 4, h - 4);
  const escala = w / 50;
  for (const [lado, color] of [
    ["izquierda", "#3b82f6"],
    ["derecha", "#22c55e"],
  ] as const) {
    const m = manos[lado];
    if (!m) continue;
    const x = w / 2 + m.posicion.x * escala;
    const y = h / 2 + m.posicion.z * escala;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 6 + m.apertura * 8, 0, Math.PI * 2);
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
