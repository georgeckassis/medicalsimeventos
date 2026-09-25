"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Encabezado from "@/components/Encabezado";
import MensajeError from "@/components/MensajeError";
import { useSesion } from "@/components/Sesion";
import { mensajeDe, pedir } from "@/lib/cliente";
import { COLOR_ESTADO, COLOR_ESTADO_TAREA } from "@/lib/estilos";
import { formatoFechaHora } from "@/lib/fechas";
import { NOMBRE_ESTADO_EVENTO, NOMBRE_ESTADO_TAREA, type Alerta, type EventoResumen, type Tarea } from "@/lib/db/types";

export default function InicioPage() {
  const { sesion } = useSesion();
  const [eventos, setEventos] = useState<EventoResumen[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sesion) return;
    const desde = new Date().toISOString();
    const hasta = new Date(Date.now() + 14 * 86400_000).toISOString();
    Promise.all([
      pedir<EventoResumen[]>(`/api/eventos?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`),
      pedir<Tarea[]>("/api/tareas?mias=1"),
      pedir<Alerta[]>("/api/alertas"),
    ])
      .then(([e, t, a]) => {
        setEventos(e.filter((x) => x.estado !== "cancelado"));
        setTareas(t.filter((x) => x.estado !== "completada"));
        setAlertas(a);
      })
      .catch((err) => setError(mensajeDe(err)));
  }, [sesion]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Encabezado titulo={sesion ? `Hola, ${sesion.usuario.nombre.split(" ")[0]}` : "Inicio"} descripcion="Lo que viene en los próximos 14 días." />
      {error && <MensajeError mensaje={error} />}

      {alertas.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-bold text-red-700">Alertas activas ({alertas.length})</h2>
          <div className="flex flex-col gap-2">
            {alertas.slice(0, 6).map((a) => (
              <Link
                key={a.id}
                href={a.eventoId ? `/eventos/${a.eventoId}?tab=checklist` : "/tareas"}
                className={`rounded-md border px-3 py-2 text-sm ${
                  a.severidad === "incumplimiento" ? "border-red-300 bg-red-50 font-semibold text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"
                }`}
              >
                {a.severidad === "incumplimiento" ? "⚠️ " : "🔔 "}
                {a.mensaje}
              </Link>
            ))}
            {alertas.length > 6 && (
              <Link href="/alertas" className="text-sm text-brand-navy hover:underline">
                Ver todas
              </Link>
            )}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Próximos eventos</h2>
            <Link href="/calendario" className="text-sm text-brand-navy hover:underline">
              Ver calendario
            </Link>
          </div>
          {eventos.length === 0 && <p className="text-sm text-zinc-400">No hay eventos en los próximos 14 días.</p>}
          <div className="flex flex-col gap-3">
            {eventos.map((e) => (
              <Link key={e.id} href={`/eventos/${e.id}`} className="tarjeta block p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {e.alertasActivas > 0 && <span className="mr-1 text-red-600">●</span>}
                      {e.nombre}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatoFechaHora(e.inicio)}
                      {e.institucionNombre && ` · ${e.institucionNombre}`}
                      {e.sede && ` · ${e.sede}`} · {e.cantidadAlumnos} alumnos
                    </p>
                  </div>
                  <span className={`rounded border px-1.5 py-0.5 text-xs ${COLOR_ESTADO[e.estado]}`}>{NOMBRE_ESTADO_EVENTO[e.estado]}</span>
                </div>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                  Carga: {e.cargaDepositoEn ? formatoFechaHora(e.cargaDepositoEn) : <span className="text-amber-600">sin definir</span>} · Salida:{" "}
                  {e.salidaEn ? formatoFechaHora(e.salidaEn) : <span className="text-amber-600">sin definir</span>} · Armado: {formatoFechaHora(e.armadoEn)}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Mis tareas</h2>
            <Link href="/tareas" className="text-sm text-brand-navy hover:underline">
              Ver todas
            </Link>
          </div>
          {tareas.length === 0 && <p className="text-sm text-zinc-400">No tenés tareas pendientes.</p>}
          <div className="flex flex-col gap-2">
            {tareas.map((t) => (
              <Link key={t.id} href="/tareas" className="tarjeta block p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{t.titulo}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${COLOR_ESTADO_TAREA[t.estado]}`}>{NOMBRE_ESTADO_TAREA[t.estado]}</span>
                </div>
                {t.venceEn && <p className="text-xs text-zinc-500">Vence {formatoFechaHora(t.venceEn)}</p>}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
