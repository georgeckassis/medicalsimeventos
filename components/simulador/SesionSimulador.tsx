"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconArrowLeft } from "@/components/icons";
import { leerConfiguracion, nombreTecla } from "@/lib/simulador/configuracion";
import { buscarEjercicio } from "@/lib/simulador/ejercicios/catalogo";
import { Simulacion, type Instantanea } from "@/lib/simulador/simulacion";

function reloj(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Indicador({ activo, color, children }: { activo: boolean; color: string; children: React.ReactNode }) {
  return (
    <span
      className={`rounded px-2 py-1 text-xs font-bold ${activo ? `${color} text-white` : "bg-black/40 text-zinc-400"}`}
    >
      {children}
    </span>
  );
}

export default function SesionSimulador({ id }: { id: string }) {
  const definicion = buscarEjercicio(id);
  const [config] = useState(leerConfiguracion);
  const contenedor = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const vistaPrevia = useRef<HTMLCanvasElement>(null);
  const simulacion = useRef<Simulacion | null>(null);
  const [estado, setEstado] = useState<Instantanea | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!definicion || !lienzo.current || !contenedor.current) return;
    const sim = new Simulacion({
      lienzo: lienzo.current,
      vistaPrevia: vistaPrevia.current,
      config,
      definicion,
      alCambiar: setEstado,
    });
    simulacion.current = sim;
    const caja = contenedor.current;
    const observador = new ResizeObserver(() => sim.redimensionar(caja.clientWidth, caja.clientHeight));
    observador.observe(caja);
    sim
      .iniciar()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setCargando(false));
    return () => {
      observador.disconnect();
      sim.destruir();
      simulacion.current = null;
    };
  }, [definicion, config]);

  function accionPrincipal() {
    const sim = simulacion.current;
    if (!sim || !estado) return;
    if (estado.estado === "en_curso") sim.pausar();
    else if (estado.estado === "pausado") sim.reanudar();
    else sim.comenzar();
  }

  // Enter: comenzar / pausar / reanudar sin soltar las manos de la posición.
  const accionRef = useRef(accionPrincipal);
  useEffect(() => {
    accionRef.current = accionPrincipal;
  });
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        accionRef.current();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  if (!definicion) {
    return (
      <div className="p-6 text-sm">
        No existe ese ejercicio. <Link href="/simulador" className="underline">Volver al simulador</Link>
      </div>
    );
  }

  const e = estado;
  const textoAccion = !e || e.estado === "preparado" ? "Comenzar" : e.estado === "en_curso" ? "Pausar" : e.estado === "pausado" ? "Seguir" : "Repetir";

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
      <div ref={contenedor} className="relative min-h-[60vh] flex-1 overflow-hidden bg-black">
        <canvas ref={lienzo} className="absolute inset-0 h-full w-full" />

        {e && (
          <>
            <div className="pointer-events-none absolute top-3 left-3 max-w-md rounded-lg bg-black/60 p-3 text-sm text-white">
              <p className="font-bold">{definicion.nombre}</p>
              <p className="mt-1 text-zinc-200">{e.ejercicio.instruccion}</p>
            </div>
            <div className="pointer-events-none absolute top-3 right-3 rounded-lg bg-black/60 p-3 text-right text-white">
              <p className="font-mono text-2xl font-bold">{reloj(e.segundos)}</p>
              <p className="text-xs text-zinc-300">{e.ejercicio.progreso}</p>
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-1.5">
              <Indicador activo={e.manos.izquierda} color="bg-blue-600">
                Mano izq.{e.pinzaPendiente.izquierda ? " · igualá la pinza" : ""}
              </Indicador>
              <Indicador activo={e.manos.derecha} color="bg-green-600">
                Mano der.{e.pinzaPendiente.derecha ? " · igualá la pinza" : ""}
              </Indicador>
              <Indicador activo={e.clutch} color="bg-amber-600">
                CLUTCH
              </Indicador>
              <Indicador activo={e.camara} color="bg-purple-600">
                CÁMARA
              </Indicador>
            </div>
            {e.ejercicio.aviso && (
              <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black">
                {e.ejercicio.aviso}
              </div>
            )}
            {e.flecha && (
              <div
                className="pointer-events-none absolute text-4xl text-yellow-300 drop-shadow"
                style={{
                  left: `${e.flecha.x}%`,
                  top: `${e.flecha.y}%`,
                  transform: `translate(-50%, -50%) rotate(${e.flecha.angulo}rad)`,
                }}
              >
                ➜
              </div>
            )}
            {(e.estado === "preparado" || e.estado === "pausado") && !cargando && !error && (
              <div className="pointer-events-none absolute inset-x-0 bottom-16 text-center">
                <span className="rounded-lg bg-black/70 px-4 py-2 text-sm text-white">
                  {e.estado === "pausado" ? "En pausa. " : "Podés probar los movimientos. "}
                  Apretá <b>Enter</b> para {e.estado === "pausado" ? "seguir" : "comenzar"}.
                </span>
              </div>
            )}
            {e.estado === "completado" && e.resultados && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4">
                <div className="tarjeta w-full max-w-sm p-5">
                  <h2 className="mb-3 text-lg font-bold">¡Ejercicio completado!</h2>
                  <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                    {e.resultados.map((r) => (
                      <div key={r.etiqueta} className="contents">
                        <dt className="text-zinc-500">{r.etiqueta}</dt>
                        <dd className="text-right font-semibold">{r.valor}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 flex gap-2">
                    <button type="button" className="boton" onClick={accionPrincipal}>
                      Repetir (Enter)
                    </button>
                    <Link href="/simulador" className="boton-secundario">
                      Volver
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {(cargando || error) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-white">
            {error ? (
              <div>
                <p className="mb-3 font-bold text-red-300">{error}</p>
                <Link href="/simulador" className="boton">
                  Volver
                </Link>
              </div>
            ) : (
              "Abriendo la cámara y cargando la detección de manos…"
            )}
          </div>
        )}
      </div>

      <aside className="flex w-full flex-shrink-0 flex-col gap-3 overflow-y-auto border-l border-zinc-200 p-4 lg:w-80 dark:border-zinc-800">
        <Link href="/simulador" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-brand-navy">
          <IconArrowLeft size={16} /> Simulador
        </Link>
        <div>
          <canvas ref={vistaPrevia} className="w-full rounded-lg bg-zinc-900" />
          <p className="mt-1 text-xs text-zinc-500">
            Vista de la cámara (arriba = lejos de vos) · {e?.deteccionesPorSegundo ?? 0} detecciones/s
          </p>
        </div>
        {!config.calibracion && (
          <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Esta PC todavía no está calibrada: la pinza y la altura pueden no responder bien.{" "}
            <Link href="/simulador/calibracion" className="underline">
              Calibrar
            </Link>
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" className="boton flex-1" onClick={accionPrincipal} disabled={!e || cargando || !!error}>
            {textoAccion}
          </button>
          <button
            type="button"
            className="boton-secundario"
            onClick={() => simulacion.current?.reiniciar()}
            disabled={!e || cargando || !!error}
          >
            Reiniciar
          </button>
        </div>
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          <p className="mb-1 font-semibold">Controles</p>
          <ul className="space-y-0.5">
            <li>
              <b>Clutch:</b> {config.teclasClutch.map(nombreTecla).join(" / ")}
            </li>
            <li>
              <b>Cámara:</b> {config.teclasCamara.map(nombreTecla).join(" / ")}
            </li>
            <li>
              <b>Comenzar / pausar:</b> Enter
            </li>
            <li>
              <b>Pinza:</b> juntar pulgar e índice
            </li>
            <li>
              <b>Escala:</b> {String(config.escala).replace(".", ",")} : 1
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
