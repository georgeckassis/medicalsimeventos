"use client";

import { useRef, useState } from "react";
import CapturaFoto from "@/components/CapturaFoto";
import FirmaCanvas, { type FirmaCanvasHandle } from "@/components/FirmaCanvas";
import MensajeError from "@/components/MensajeError";
import { useSesion } from "@/components/Sesion";
import { mensajeDe, pedir } from "@/lib/cliente";
import { formatoFechaHora } from "@/lib/fechas";
import { useAhora } from "@/lib/useAhora";
import { ETAPAS, NOMBRE_ETAPA, type DetalleEvento, type Etapa, type EventoItem } from "@/lib/db/types";

const AYUDA: Record<Etapa, string> = {
  carga_deposito: "Tildá cada objeto a medida que se embala y se sube al vehículo en el depósito.",
  descarga_sede: "Tildá cada objeto que se baja y queda en la sede para el armado.",
  carga_retiro: "Al terminar el evento: tildá cada objeto que se vuelve a cargar para retirarlo.",
  devolucion_deposito: "Tildá cada objeto que vuelve al depósito. Lo que falte queda registrado como faltante.",
};

function horaPrevista(detalle: DetalleEvento, etapa: Etapa): string | null {
  const e = detalle.evento;
  return {
    carga_deposito: e.cargaDepositoEn,
    descarga_sede: e.armadoEn ?? e.inicio,
    carga_retiro: e.retiroEn ?? e.desarmadoEn,
    devolucion_deposito: e.devolucionEn,
  }[etapa];
}

function cantidadTildada(item: EventoItem, etapa: Etapa) {
  return item.checks[etapa]?.cantidad ?? 0;
}

/**
 * Checklist compartido por logística, chofer, encargado general y
 * representante (este último solo mira). Cada etapa se cierra con la firma
 * de quien carga/descarga y una foto; después ya no se puede destildar.
 */
export default function Checklist({ detalle, onCambio }: { detalle: DetalleEvento; onCambio: () => void }) {
  const { sesion } = useSesion();
  const { evento, items, cierres, permisos } = detalle;
  const primeraAbierta = ETAPAS.find((e) => !cierres.some((c) => c.etapa === e)) ?? "devolucion_deposito";
  const [etapa, setEtapa] = useState<Etapa>(primeraAbierta);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<number | "cierre" | null>(null);
  const firmaRef = useRef<FirmaCanvasHandle | null>(null);
  // null = todavía no se tocó: se propone el nombre de quien está logueado.
  const [firmanteEditado, setFirmante] = useState<string | null>(null);
  const firmante = firmanteEditado ?? sesion?.usuario.nombre ?? "";
  const ahora = useAhora();
  const [foto, setFoto] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState("");

  const cierre = cierres.find((c) => c.etapa === etapa);
  const puedeTildar = permisos.tildar && !cierre;
  const pendientes = items.filter((i) => cantidadTildada(i, etapa) < i.cantidad);
  const hora = horaPrevista(detalle, etapa);
  const vencida = hora !== null && new Date(hora).getTime() <= ahora;

  async function tildar(item: EventoItem, cantidad: number | null) {
    setOcupado(item.id);
    setError(null);
    try {
      await pedir(`/api/eventos/${evento.id}/checklist`, { method: "PUT", body: { itemId: item.id, etapa, cantidad } });
      onCambio();
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setOcupado(null);
    }
  }

  async function cerrar() {
    const firma = firmaRef.current?.obtenerFirma();
    if (!firma) {
      setError("Falta la firma de quien carga/descarga.");
      return;
    }
    if (!foto && !confirm("No sacaste foto de la carga. ¿Cerrar igual sin foto?")) return;
    setOcupado("cierre");
    setError(null);
    try {
      await pedir(`/api/eventos/${evento.id}/etapas/${etapa}`, {
        method: "POST",
        body: { nombreFirmante: firmante, firma, foto, observaciones },
      });
      setFoto(null);
      setObservaciones("");
      firmaRef.current?.limpiar();
      onCambio();
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setOcupado(null);
    }
  }

  async function reabrir() {
    const motivo = prompt(`¿Por qué se reabre "${NOMBRE_ETAPA[etapa]}"? (queda registrado en el historial)`);
    if (!motivo?.trim()) return;
    setError(null);
    try {
      await pedir(`/api/eventos/${evento.id}/etapas/${etapa}/reabrir`, { method: "POST", body: { motivo } });
      onCambio();
    } catch (err) {
      setError(mensajeDe(err));
    }
  }

  if (items.length === 0) {
    return (
      <section className="tarjeta p-5 text-sm text-zinc-500">
        El checklist aparece cuando el encargado general carga los objetos a llevar.
      </section>
    );
  }

  return (
    <section className="tarjeta p-4 sm:p-5">
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ETAPAS.map((e) => {
          const cerrada = cierres.some((c) => c.etapa === e);
          const listos = items.filter((i) => cantidadTildada(i, e) >= i.cantidad).length;
          return (
            <button
              key={e}
              type="button"
              onClick={() => setEtapa(e)}
              className={`rounded-lg border px-3 py-2 text-left text-xs ${
                etapa === e ? "border-brand-navy bg-brand-cyan/10" : "border-zinc-200 hover:border-brand-navy dark:border-zinc-700"
              }`}
            >
              <span className="block font-bold">{NOMBRE_ETAPA[e]}</span>
              <span className={cerrada ? (listos < items.length ? "text-red-600" : "text-emerald-700") : "text-zinc-500"}>
                {cerrada ? "✔ Cerrada" : "Abierta"} · {listos}/{items.length}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mb-1 text-sm">{AYUDA[etapa]}</p>
      <p className="mb-3 text-xs text-zinc-500">Horario previsto: {formatoFechaHora(hora)}</p>

      {!cierre && pendientes.length > 0 && (
        <div
          className={`mb-3 rounded-md border px-3 py-2 text-sm ${
            vencida ? "border-red-300 bg-red-50 font-semibold text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          {vencida ? "⚠️ Ya pasó el horario y " : ""}
          {pendientes.length === 1 ? "falta 1 objeto" : `faltan ${pendientes.length} objetos`} por tildar:{" "}
          {pendientes.map((i) => `${i.nombre} (${cantidadTildada(i, etapa)}/${i.cantidad})`).join(", ")}
        </div>
      )}
      {error && (
        <div className="mb-3">
          <MensajeError mensaje={error} />
        </div>
      )}

      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {items.map((item) => {
          const tildada = cantidadTildada(item, etapa);
          const completo = tildada >= item.cantidad;
          const check = item.checks[etapa];
          return (
            <li key={item.id} className={`flex items-center gap-3 py-2.5 ${completo ? "" : tildada > 0 ? "bg-amber-50/60 dark:bg-amber-950/30" : ""}`}>
              <button
                type="button"
                disabled={!puedeTildar || ocupado === item.id}
                onClick={() => tildar(item, completo ? null : item.cantidad)}
                aria-label={completo ? `Destildar ${item.nombre}` : `Tildar ${item.nombre}`}
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border-2 text-lg font-bold transition-colors ${
                  completo
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : tildada > 0
                      ? "border-amber-500 bg-amber-100 text-amber-700"
                      : "border-zinc-300 bg-white dark:bg-zinc-900"
                } ${puedeTildar ? "cursor-pointer" : "cursor-default opacity-80"}`}
              >
                {completo ? "✓" : tildada > 0 ? "½" : ""}
              </button>
              <div className="min-w-0 flex-1">
                <div className={`font-medium ${completo ? "" : "text-zinc-800 dark:text-zinc-200"}`}>{item.nombre}</div>
                <div className="text-xs text-zinc-500">
                  {tildada} de {item.cantidad}
                  {check?.usuarioNombre && ` · ${check.usuarioNombre}, ${formatoFechaHora(check.actualizadoEn)}`}
                </div>
              </div>
              {puedeTildar && item.cantidad > 1 && (
                <label className="flex items-center gap-1 text-xs text-zinc-500">
                  Cant.
                  <input
                    type="number"
                    min={0}
                    max={item.cantidad}
                    key={`${item.id}-${etapa}-${tildada}`}
                    defaultValue={tildada}
                    className="campo w-16 px-2 py-1"
                    onBlur={(e) => {
                      const n = Math.min(item.cantidad, Math.max(0, Number(e.target.value) || 0));
                      if (n !== tildada) tildar(item, n === 0 ? null : n);
                    }}
                  />
                </label>
              )}
            </li>
          );
        })}
      </ul>

      {cierre ? (
        <div className="mt-5 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-bold text-emerald-800 dark:text-emerald-200">Etapa cerrada el {formatoFechaHora(cierre.cerradaEn)}</p>
              <p>
                Firmó: <span className="font-semibold">{cierre.nombreFirmante}</span>
                {cierre.cerradaPorNombre && cierre.cerradaPorNombre !== cierre.nombreFirmante && ` (registrado por ${cierre.cerradaPorNombre})`}
              </p>
              {cierre.observaciones && <p className="mt-1">Observaciones: {cierre.observaciones}</p>}
            </div>
            {permisos.editarEvento && (
              <button type="button" className="boton-peligro" onClick={reabrir}>
                Reabrir etapa
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/archivos/${cierre.firmaId}`} alt="Firma" className="h-24 rounded border border-zinc-300 bg-white" />
            {cierre.fotoId && (
              <a href={`/api/archivos/${cierre.fotoId}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/archivos/${cierre.fotoId}`} alt="Foto de la carga" className="h-24 rounded border border-zinc-300 object-cover" />
              </a>
            )}
          </div>
        </div>
      ) : (
        permisos.tildar && (
          <div className="mt-5 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
            <h3 className="mb-3 font-bold">Cerrar &quot;{NOMBRE_ETAPA[etapa]}&quot; con firma y foto</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="etiqueta">Nombre de quien carga / descarga</label>
                <input className="campo mb-3" value={firmante} onChange={(e) => setFirmante(e.target.value)} />
                <label className="etiqueta">Firma</label>
                <FirmaCanvas ref={firmaRef} />
              </div>
              <div>
                <label className="etiqueta">Foto de la carga</label>
                <CapturaFoto valor={foto} onCambio={setFoto} />
                <label className="etiqueta mt-4">Observaciones {pendientes.length > 0 && <span className="text-red-600">(obligatorio: faltan objetos)</span>}</label>
                <textarea className="campo" rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
              </div>
            </div>
            <button type="button" className="boton mt-4 w-full sm:w-auto" disabled={ocupado === "cierre" || !firmante.trim()} onClick={cerrar}>
              {ocupado === "cierre" ? "Guardando…" : "Firmar y cerrar etapa"}
            </button>
          </div>
        )
      )}
    </section>
  );
}
