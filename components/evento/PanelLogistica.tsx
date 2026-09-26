"use client";

import { useEffect, useState } from "react";
import CampoFechaHora from "@/components/CampoFechaHora";
import MensajeError from "@/components/MensajeError";
import { mensajeDe, pedir } from "@/lib/cliente";
import { formatoFechaHora, isoALocal, localAIso } from "@/lib/fechas";
import type { DetalleEvento, Usuario, Vehiculo } from "@/lib/db/types";

function Dato({ titulo, valor, alerta }: { titulo: string; valor: React.ReactNode; alerta?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold text-zinc-500">{titulo}</div>
      <div className={`text-sm ${alerta ? "font-semibold text-amber-600" : ""}`}>{valor}</div>
    </div>
  );
}

/**
 * Datos de logística del evento: los ve todo el mundo, y los edita el
 * encargado de logística (o el general): horarios de carga, salida, retiro y
 * devolución, más encargado, chofer y vehículo.
 */
export default function PanelLogistica({ detalle, onCambio }: { detalle: DetalleEvento; onCambio: () => void }) {
  const { evento, permisos } = detalle;
  const [editando, setEditando] = useState(false);
  const [choferes, setChoferes] = useState<Usuario[]>([]);
  const [encargados, setEncargados] = useState<Usuario[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [campos, setCampos] = useState({
    logisticaId: evento.logisticaId ? String(evento.logisticaId) : "",
    cargaDepositoEn: isoALocal(evento.cargaDepositoEn),
    salidaEn: isoALocal(evento.salidaEn),
    retiroEn: isoALocal(evento.retiroEn),
    devolucionEn: isoALocal(evento.devolucionEn),
    choferId: evento.choferId ? String(evento.choferId) : "",
    vehiculoId: evento.vehiculoId ? String(evento.vehiculoId) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!editando) return;
    Promise.all([
      pedir<Usuario[]>("/api/usuarios?rol=chofer"),
      pedir<Usuario[]>("/api/usuarios?rol=logistica"),
      pedir<Vehiculo[]>("/api/vehiculos"),
    ])
      .then(([c, l, v]) => {
        setChoferes(c.filter((u) => u.activo));
        setEncargados(l.filter((u) => u.activo));
        setVehiculos(v.filter((x) => x.activo));
      })
      .catch((e) => setError(mensajeDe(e)));
  }, [editando]);

  const set = (clave: keyof typeof campos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCampos((c) => ({ ...c, [clave]: e.target.value }));

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await pedir(`/api/eventos/${evento.id}/logistica`, {
        method: "PUT",
        body: {
          logisticaId: campos.logisticaId ? Number(campos.logisticaId) : null,
          cargaDepositoEn: localAIso(campos.cargaDepositoEn),
          salidaEn: localAIso(campos.salidaEn),
          retiroEn: localAIso(campos.retiroEn),
          devolucionEn: localAIso(campos.devolucionEn),
          choferId: campos.choferId ? Number(campos.choferId) : null,
          vehiculoId: campos.vehiculoId ? Number(campos.vehiculoId) : null,
        },
      });
      setEditando(false);
      onCambio();
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setGuardando(false);
    }
  }

  if (!editando) {
    return (
      <section className="tarjeta p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">Logística</h2>
          {permisos.editarLogistica && (
            <button type="button" className="boton-secundario" onClick={() => setEditando(true)}>
              Editar logística
            </button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato titulo="Encargado de logística" valor={evento.logisticaNombre ?? "Sin asignar"} alerta={!evento.logisticaNombre} />
          <Dato titulo="Carga en depósito" valor={evento.cargaDepositoEn ? formatoFechaHora(evento.cargaDepositoEn) : "Sin definir"} alerta={!evento.cargaDepositoEn} />
          <Dato titulo="Salida al evento" valor={evento.salidaEn ? formatoFechaHora(evento.salidaEn) : "Sin definir"} alerta={!evento.salidaEn} />
          <Dato titulo="Armado (lo define el general)" valor={formatoFechaHora(evento.armadoEn)} />
          <Dato titulo="Desarmado (lo define el general)" valor={formatoFechaHora(evento.desarmadoEn)} />
          <Dato titulo="Retiro de la sede" valor={formatoFechaHora(evento.retiroEn)} />
          <Dato titulo="Devolución al depósito" valor={formatoFechaHora(evento.devolucionEn)} />
          <div />
          <Dato
            titulo="Chofer"
            alerta={!evento.choferNombre}
            valor={
              evento.choferNombre ? (
                <>
                  {evento.choferNombre}
                  <span className="block text-xs text-zinc-500">
                    DNI {evento.choferDni || "—"} · Tel. {evento.choferTelefono || "—"}
                  </span>
                </>
              ) : (
                "Sin asignar"
              )
            }
          />
          <Dato
            titulo="Vehículo"
            alerta={!evento.vehiculoPatente}
            valor={
              evento.vehiculoPatente ? (
                <>
                  <span className="font-mono font-bold">{evento.vehiculoPatente}</span>
                  <span className="block text-xs text-zinc-500">{evento.vehiculoDescripcion}</span>
                </>
              ) : (
                "Sin asignar"
              )
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section className="tarjeta p-5">
      <h2 className="mb-4 font-bold">Editar logística</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="etiqueta">Encargado de logística</label>
          <select className="campo" value={campos.logisticaId} onChange={set("logisticaId")}>
            <option value="">— Sin asignar (avisa a todos los de logística) —</option>
            {encargados.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
        <div />
        <div>
          <label className="etiqueta">Carga de mercadería en depósito</label>
          <CampoFechaHora valor={campos.cargaDepositoEn} onCambio={(v) => setCampos((c) => ({ ...c, cargaDepositoEn: v }))} horaPorDefecto="07:00" opcional />
        </div>
        <div>
          <label className="etiqueta">Salida al evento</label>
          <CampoFechaHora valor={campos.salidaEn} onCambio={(v) => setCampos((c) => ({ ...c, salidaEn: v }))} horaPorDefecto="08:00" opcional />
        </div>
        <div>
          <label className="etiqueta">Retiro de las cosas de la sede</label>
          <CampoFechaHora valor={campos.retiroEn} onCambio={(v) => setCampos((c) => ({ ...c, retiroEn: v }))} horaPorDefecto="18:00" opcional />
        </div>
        <div>
          <label className="etiqueta">Devolución al depósito</label>
          <CampoFechaHora valor={campos.devolucionEn} onCambio={(v) => setCampos((c) => ({ ...c, devolucionEn: v }))} horaPorDefecto="20:00" opcional />
        </div>
        <div>
          <label className="etiqueta">Chofer</label>
          <select className="campo" value={campos.choferId} onChange={set("choferId")}>
            <option value="">— Sin asignar —</option>
            {choferes.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} {u.dni && `(DNI ${u.dni})`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiqueta">Vehículo</label>
          <select className="campo" value={campos.vehiculoId} onChange={set("vehiculoId")}>
            <option value="">— Sin asignar —</option>
            {vehiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.patente} — {v.marca} {v.modelo}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Si a la hora de carga todavía hay objetos sin tildar, se avisa por mail a los encargados. Antes de cada horario se manda un aviso previo a
        logística y al chofer.
      </p>
      {error && (
        <div className="mt-3">
          <MensajeError mensaje={error} />
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button type="button" className="boton" disabled={guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" className="boton-secundario" onClick={() => setEditando(false)}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
