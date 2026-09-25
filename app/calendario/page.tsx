"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Encabezado from "@/components/Encabezado";
import MensajeError from "@/components/MensajeError";
import { useSesion } from "@/components/Sesion";
import { mensajeDe, pedir } from "@/lib/cliente";
import { diaLocal, formatoFecha, formatoFechaHora, formatoHora, isoALocal, localAIso } from "@/lib/fechas";
import { NOMBRE_ESTADO_EVENTO, type EventoResumen } from "@/lib/db/types";
import { COLOR_ESTADO, PUNTO_ESTADO } from "@/lib/estilos";

type Vista = "mes" | "semana" | "lista";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Aritmética de días sobre "YYYY-MM-DD" en UTC puro, para no depender de la zona del navegador.
function sumarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function diaSemana(dia: string): number {
  return (new Date(`${dia}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = lunes
}
function hoy(): string {
  return diaLocal(new Date().toISOString());
}

/** Horarios de logística y armado de un evento, para la agenda semanal. */
function hitos(e: EventoResumen): Array<{ iso: string; texto: string; tipo: "evento" | "logistica" }> {
  const lista: Array<{ iso: string | null; texto: string; tipo: "evento" | "logistica" }> = [
    { iso: e.cargaDepositoEn, texto: "Carga en depósito", tipo: "logistica" },
    { iso: e.salidaEn, texto: "Salida al evento", tipo: "logistica" },
    { iso: e.armadoEn, texto: "Armado", tipo: "logistica" },
    { iso: e.inicio, texto: "Inicio del curso", tipo: "evento" },
    { iso: e.fin, texto: "Fin del curso", tipo: "evento" },
    { iso: e.desarmadoEn, texto: "Desarmado", tipo: "logistica" },
    { iso: e.retiroEn, texto: "Retiro de la sede", tipo: "logistica" },
    { iso: e.devolucionEn, texto: "Devolución al depósito", tipo: "logistica" },
  ];
  return lista.filter((h): h is { iso: string; texto: string; tipo: "evento" | "logistica" } => Boolean(h.iso));
}

export default function CalendarioPage() {
  const { sesion } = useSesion();
  const [vista, setVista] = useState<Vista>("mes");
  const [referencia, setReferencia] = useState(hoy());
  // Día tocado en la vista mensual: sus eventos se listan debajo de la grilla
  // (en el celular las celdas son muy chicas para leer los nombres).
  const [diaElegido, setDiaElegido] = useState(hoy());
  const [eventos, setEventos] = useState<EventoResumen[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const rango = useMemo(() => {
    if (vista === "mes") {
      const primero = `${referencia.slice(0, 7)}-01`;
      const desde = sumarDias(primero, -diaSemana(primero));
      const ultimo = sumarDias(`${sumarDias(primero, 32).slice(0, 7)}-01`, -1);
      const hasta = sumarDias(ultimo, 6 - diaSemana(ultimo));
      return { desde, hasta };
    }
    if (vista === "semana") {
      const desde = sumarDias(referencia, -diaSemana(referencia));
      return { desde, hasta: sumarDias(desde, 6) };
    }
    return { desde: referencia, hasta: sumarDias(referencia, 120) };
  }, [vista, referencia]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const desde = localAIso(`${rango.desde}T00:00`)!;
      const hasta = localAIso(`${sumarDias(rango.hasta, 1)}T00:00`)!;
      setEventos(await pedir<EventoResumen[]>(`/api/eventos?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`));
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setCargando(false);
    }
  }, [rango]);

  useEffect(() => {
    // Carga inicial de datos al montar la página — patrón estándar de fetch-on-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  function mover(direccion: 1 | -1) {
    if (vista === "mes") {
      const [a, m] = referencia.split("-").map(Number);
      const nuevo = new Date(Date.UTC(a, m - 1 + direccion, 1));
      setReferencia(nuevo.toISOString().slice(0, 10));
    } else if (vista === "semana") setReferencia(sumarDias(referencia, 7 * direccion));
    else setReferencia(sumarDias(referencia, 30 * direccion));
  }

  const dias: string[] = [];
  for (let d = rango.desde; d <= rango.hasta; d = sumarDias(d, 1)) dias.push(d);
  const eventosDelDia = (dia: string) => eventos.filter((e) => diaLocal(e.inicio) <= dia && diaLocal(e.fin) >= dia);

  const titulo =
    vista === "mes"
      ? `${MESES[Number(referencia.slice(5, 7)) - 1]} ${referencia.slice(0, 4)}`
      : vista === "semana"
        ? `Semana del ${formatoFecha(localAIso(`${rango.desde}T12:00`))}`
        : `Desde el ${formatoFecha(localAIso(`${rango.desde}T12:00`))}`;

  const esGestor = sesion?.usuario.rol === "general" || sesion?.usuario.rol === "superadmin";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Encabezado titulo="Calendario de cursos" descripcion="Cursos de capacitación, con sus horarios de armado y logística.">
        {esGestor && (
          <Link href="/eventos/nuevo" className="boton">
            + Nuevo evento
          </Link>
        )}
      </Encabezado>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
          {(["mes", "semana", "lista"] as Vista[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`px-3 py-1.5 text-sm font-medium capitalize ${vista === v ? "bg-brand-navy text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => mover(-1)} className="boton-secundario" aria-label="Anterior">
          ‹
        </button>
        <button type="button" onClick={() => setReferencia(hoy())} className="boton-secundario">
          Hoy
        </button>
        <button type="button" onClick={() => mover(1)} className="boton-secundario" aria-label="Siguiente">
          ›
        </button>
        <span className="ml-2 text-lg font-bold">{titulo}</span>
        {cargando && <span className="text-xs text-zinc-400">Cargando…</span>}
      </div>

      {error && <MensajeError mensaje={error} onReintentar={cargar} />}

      {vista === "mes" && (
        <div className="tarjeta overflow-hidden">
          <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-xs font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            {DIAS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {dias.map((dia) => {
              const delMes = dia.slice(0, 7) === referencia.slice(0, 7);
              return (
                <div
                  key={dia}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDiaElegido(dia)}
                  onKeyDown={(ev) => ev.key === "Enter" && setDiaElegido(dia)}
                  className={`min-h-14 cursor-pointer border-r border-b border-zinc-100 p-1 sm:min-h-28 dark:border-zinc-800 ${
                    delMes ? "" : "bg-zinc-50/60 text-zinc-400 dark:bg-zinc-900/40"
                  } ${dia === diaElegido ? "bg-brand-cyan/10 ring-2 ring-brand-cyan/50 ring-inset" : ""}`}
                >
                  <div className={`mb-1 text-right text-xs font-semibold ${dia === hoy() ? "text-brand-navy" : ""}`}>
                    {dia === hoy() ? <span className="rounded-full bg-brand-navy px-1.5 py-0.5 text-white">{Number(dia.slice(8))}</span> : Number(dia.slice(8))}
                  </div>
                  <div className="flex flex-wrap justify-end gap-1 sm:hidden">
                    {eventosDelDia(dia).map((e) => (
                      <span
                        key={e.id}
                        className={`h-2 w-2 rounded-full ${e.alertasActivas > 0 ? "bg-red-600" : PUNTO_ESTADO[e.estado]}`}
                      />
                    ))}
                  </div>
                  <div className="hidden flex-col gap-1 sm:flex">
                    {eventosDelDia(dia).map((e) => (
                      <Link
                        key={e.id}
                        href={`/eventos/${e.id}`}
                        title={e.nombre}
                        className={`truncate rounded border px-1 py-0.5 text-[11px] leading-tight font-medium ${COLOR_ESTADO[e.estado]}`}
                      >
                        {e.alertasActivas > 0 && <span className="mr-0.5 text-red-600">●</span>}
                        {diaLocal(e.inicio) === dia && <span className="font-bold">{formatoHora(e.inicio)} </span>}
                        {e.nombre}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vista === "mes" && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-bold text-zinc-600 dark:text-zinc-300">
            {formatoFecha(localAIso(`${diaElegido}T12:00`))}
            <span className="font-normal text-zinc-400"> · tocá un día para ver sus eventos</span>
          </h2>
          {eventosDelDia(diaElegido).length === 0 ? (
            <p className="text-sm text-zinc-400">No hay eventos ese día.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {eventosDelDia(diaElegido).map((e) => (
                <Link key={e.id} href={`/eventos/${e.id}`} className="tarjeta block p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">
                      {e.alertasActivas > 0 && <span className="mr-1 text-red-600">●</span>}
                      {e.nombre}
                    </span>
                    <span className={`rounded border px-1.5 py-0.5 text-xs ${COLOR_ESTADO[e.estado]}`}>{NOMBRE_ESTADO_EVENTO[e.estado]}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatoHora(e.inicio)} a {formatoHora(e.fin)}
                    {e.institucionNombre && ` · ${e.institucionNombre}`}
                    {e.sede && ` · ${e.sede}`}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    Carga: {e.cargaDepositoEn ? formatoFechaHora(e.cargaDepositoEn) : <span className="text-amber-600">sin definir</span>} ·
                    Armado: {e.armadoEn ? formatoFechaHora(e.armadoEn) : "—"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {vista === "semana" && (
        <div className="grid gap-3 md:grid-cols-7">
          {dias.map((dia) => {
            const entradas = eventos
              .flatMap((e) => hitos(e).map((h) => ({ ...h, evento: e })))
              .filter((h) => diaLocal(h.iso) === dia)
              .sort((a, b) => a.iso.localeCompare(b.iso));
            return (
              <div key={dia} className="tarjeta min-h-32 p-2">
                <div className={`mb-2 text-xs font-bold ${dia === hoy() ? "text-brand-navy" : "text-zinc-500"}`}>
                  {DIAS[diaSemana(dia)]} {dia.slice(8)}/{dia.slice(5, 7)}
                </div>
                <div className="flex flex-col gap-1.5">
                  {entradas.length === 0 && <span className="text-xs text-zinc-400">—</span>}
                  {entradas.map((h, i) => (
                    <Link
                      key={`${h.evento.id}-${i}`}
                      href={`/eventos/${h.evento.id}`}
                      className={`rounded border px-1.5 py-1 text-[11px] leading-tight ${
                        h.tipo === "evento" ? COLOR_ESTADO[h.evento.estado] : "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                      }`}
                    >
                      <span className="font-bold">{formatoHora(h.iso)}</span> {h.texto}
                      <span className="block truncate opacity-80">{h.evento.nombre}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vista === "lista" && (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Curso</th>
                <th className="px-3 py-2">Institución / sede</th>
                <th className="px-3 py-2">Alumnos</th>
                <th className="px-3 py-2">Carga</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {eventos.length === 0 && !cargando && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">
                    No hay eventos en este rango.
                  </td>
                </tr>
              )}
              {eventos.map((e) => (
                <tr key={e.id} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatoFecha(e.inicio)} {formatoHora(e.inicio)}
                    {diaLocal(e.inicio) !== diaLocal(e.fin) && <span className="text-zinc-400"> → {formatoFecha(e.fin)}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/eventos/${e.id}`} className="font-semibold text-brand-navy hover:underline">
                      {e.alertasActivas > 0 && <span className="mr-1 text-red-600">●</span>}
                      {e.nombre}
                    </Link>
                    {e.tipoCapacitacion && <span className="block text-xs text-zinc-500">{e.tipoCapacitacion}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {e.institucionNombre ?? "—"}
                    {e.sede && <span className="block text-xs text-zinc-500">{e.sede}</span>}
                  </td>
                  <td className="px-3 py-2">{e.cantidadAlumnos}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{e.cargaDepositoEn ? isoALocal(e.cargaDepositoEn).replace("T", " ") : <span className="text-amber-600">Sin definir</span>}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded border px-1.5 py-0.5 text-xs ${COLOR_ESTADO[e.estado]}`}>{NOMBRE_ESTADO_EVENTO[e.estado]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
