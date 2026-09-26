"use client";

import { useCallback, useEffect, useState } from "react";
import Encabezado from "@/components/Encabezado";
import MensajeError from "@/components/MensajeError";
import { mensajeDe, pedir } from "@/lib/cliente";
import type { EntradaDiagnostico } from "@/lib/db/diagnostico";
import { formatoFechaHora } from "@/lib/fechas";

interface ResultadoPrueba {
  pasos: Array<{ paso: string; ok: boolean; ms: number; detalle?: string }>;
  servidor: { version: string; region: string; mail: string };
}

const COLOR_TIPO: Record<string, string> = {
  error_servidor: "bg-red-100 text-red-800",
  error_navegador: "bg-red-100 text-red-800",
  error_conexion: "bg-red-100 text-red-800",
  guardado_evento: "bg-sky-100 text-sky-800",
};

/**
 * Registro de lo que pasa por detrás: errores del servidor y del navegador,
 * rechazos (datos inválidos, sin permiso) e intentos de guardado. Sirve para
 * saber qué pasó cuando algo "no anda" sin tener que adivinar.
 */
export default function DiagnosticoPage() {
  const [entradas, setEntradas] = useState<EntradaDiagnostico[]>([]);
  const [prueba, setPrueba] = useState<ResultadoPrueba | null>(null);
  const [probando, setProbando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navegador, setNavegador] = useState("");

  const cargar = useCallback(async () => {
    try {
      setEntradas(await pedir<EntradaDiagnostico[]>("/api/diagnostico"));
    } catch (err) {
      setError(mensajeDe(err));
    }
  }, []);

  useEffect(() => {
    // Carga inicial de datos al montar la página — patrón estándar de fetch-on-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    setNavegador(navigator.userAgent);
  }, [cargar]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Encabezado
        titulo="Diagnóstico"
        descripcion="Errores e intentos de guardado de los últimos 30 días. Si algo no anda, sacale captura a esta pantalla."
      >
        <button type="button" className="boton-secundario" onClick={cargar}>
          Actualizar
        </button>
        <button
          type="button"
          className="boton"
          disabled={probando}
          onClick={async () => {
            setProbando(true);
            setError(null);
            try {
              setPrueba(await pedir<ResultadoPrueba>("/api/diagnostico/prueba", { method: "POST" }));
            } catch (err) {
              setError(mensajeDe(err));
            } finally {
              setProbando(false);
            }
          }}
        >
          {probando ? "Probando…" : "Probar guardado"}
        </button>
      </Encabezado>

      {error && (
        <div className="mb-4">
          <MensajeError mensaje={error} />
        </div>
      )}

      <section className="tarjeta mb-5 p-4 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="font-semibold">Este navegador:</span> {navegador || "—"}
      </section>

      {prueba && (
        <section className="tarjeta mb-5 p-4 text-sm">
          <h2 className="mb-2 font-bold">Prueba de guardado (no deja nada guardado)</h2>
          <ul className="flex flex-col gap-1">
            {prueba.pasos.map((p) => (
              <li key={p.paso} className={p.ok ? "text-emerald-700" : "font-semibold text-red-700"}>
                {p.ok ? "✔" : "✘"} {p.paso} — {p.ms} ms{p.detalle && <span className="font-normal text-zinc-500"> · {p.detalle}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-500">
            Versión {prueba.servidor.version} · región {prueba.servidor.region} · mail {prueba.servidor.mail}
          </p>
        </section>
      )}

      <div className="tarjeta overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Cuándo</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Qué pasó</th>
              <th className="px-3 py-2">Quién / dónde</th>
            </tr>
          </thead>
          <tbody>
            {entradas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-zinc-400">
                  Sin registros todavía.
                </td>
              </tr>
            )}
            {entradas.map((e) => (
              <tr key={e.id} className="border-b border-zinc-100 align-top dark:border-zinc-800">
                <td className="px-3 py-2 text-xs whitespace-nowrap">{formatoFechaHora(e.creadoEn)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${COLOR_TIPO[e.tipo] ?? "bg-amber-100 text-amber-800"}`}>{e.tipo}</span>
                </td>
                <td className="px-3 py-2">
                  {e.mensaje}
                  {e.detalle && (
                    <details className="mt-1 text-xs text-zinc-500">
                      <summary className="cursor-pointer">Detalle</summary>
                      <pre className="whitespace-pre-wrap">{e.detalle}</pre>
                    </details>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500">
                  {e.usuarioNombre ?? "—"}
                  {e.ruta && <span className="block">{e.ruta}</span>}
                  {e.navegador && <span className="block max-w-56 truncate" title={e.navegador}>{e.navegador}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
