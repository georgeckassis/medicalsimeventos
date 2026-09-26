"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Encabezado from "@/components/Encabezado";
import CampoFechaHora from "@/components/CampoFechaHora";
import MensajeError from "@/components/MensajeError";
import { useSesion } from "@/components/Sesion";
import { useAhora } from "@/lib/useAhora";
import { mensajeDe, pedir } from "@/lib/cliente";
import { COLOR_ESTADO_TAREA } from "@/lib/estilos";
import { formatoFechaHora, isoALocal, localAIso } from "@/lib/fechas";
import { ESTADOS_TAREA, NOMBRE_ESTADO_TAREA, NOMBRE_ROL, type EstadoTarea, type EventoResumen, type Tarea, type Usuario } from "@/lib/db/types";

const VACIA = { titulo: "", descripcion: "", responsableId: "", eventoId: "", venceEn: "", estado: "pendiente" as EstadoTarea };

export default function TareasPage() {
  const { sesion, recargar } = useSesion();
  const gestor = sesion?.usuario.rol === "general" || sesion?.usuario.rol === "superadmin";
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [eventos, setEventos] = useState<EventoResumen[]>([]);
  const [soloMias, setSoloMias] = useState(false);
  const [editando, setEditando] = useState<Tarea | "nueva" | null>(null);
  const [campos, setCampos] = useState(VACIA);
  const [error, setError] = useState<string | null>(null);
  const ahora = useAhora();

  const cargar = useCallback(async () => {
    try {
      setTareas(await pedir<Tarea[]>(`/api/tareas${soloMias ? "?mias=1" : ""}`));
    } catch (err) {
      setError(mensajeDe(err));
    }
  }, [soloMias]);

  useEffect(() => {
    // Carga inicial de datos al montar la página — patrón estándar de fetch-on-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (sesion) cargar();
  }, [sesion, cargar]);

  useEffect(() => {
    if (!gestor) return;
    const desde = new Date(Date.now() - 30 * 86400_000).toISOString();
    Promise.all([pedir<Usuario[]>("/api/usuarios"), pedir<EventoResumen[]>(`/api/eventos?desde=${encodeURIComponent(desde)}`)])
      .then(([u, e]) => {
        setUsuarios(u.filter((x) => x.activo));
        setEventos(e);
      })
      .catch(() => {});
  }, [gestor]);

  function abrir(t?: Tarea) {
    setCampos(
      t
        ? {
            titulo: t.titulo,
            descripcion: t.descripcion,
            responsableId: t.responsableId ? String(t.responsableId) : "",
            eventoId: t.eventoId ? String(t.eventoId) : "",
            venceEn: isoALocal(t.venceEn),
            estado: t.estado,
          }
        : VACIA,
    );
    setEditando(t ?? "nueva");
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const cuerpo = {
        ...campos,
        responsableId: campos.responsableId ? Number(campos.responsableId) : null,
        eventoId: campos.eventoId ? Number(campos.eventoId) : null,
        venceEn: localAIso(campos.venceEn),
      };
      if (editando === "nueva") await pedir("/api/tareas", { method: "POST", body: cuerpo });
      else if (editando) await pedir(`/api/tareas/${editando.id}`, { method: "PUT", body: cuerpo });
      setEditando(null);
      cargar();
    } catch (err) {
      setError(mensajeDe(err));
    }
  }

  async function cambiarEstado(t: Tarea, estado: EstadoTarea) {
    setError(null);
    try {
      const cuerpo = gestor
        ? {
            titulo: t.titulo,
            descripcion: t.descripcion,
            responsableId: t.responsableId,
            eventoId: t.eventoId,
            venceEn: t.venceEn,
            estado,
          }
        : { estado };
      await pedir(`/api/tareas/${t.id}`, { method: "PUT", body: cuerpo });
      cargar();
      setTimeout(recargar, 2000);
    } catch (err) {
      setError(mensajeDe(err));
    }
  }

  const set = (k: keyof typeof VACIA) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setCampos((c) => ({ ...c, [k]: e.target.value }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Encabezado
        titulo="Tareas"
        descripcion={gestor ? "Tareas libres asignadas a cualquier persona del equipo." : "Tus tareas asignadas. Actualizá el estado a medida que avanzás."}
      >
        {gestor && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={soloMias} onChange={(e) => setSoloMias(e.target.checked)} /> Solo las mías
            </label>
            <button type="button" className="boton" onClick={() => abrir()}>
              + Nueva tarea
            </button>
          </>
        )}
      </Encabezado>
      {error && (
        <div className="mb-4">
          <MensajeError mensaje={error} />
        </div>
      )}

      {editando && (
        <form onSubmit={guardar} className="tarjeta mb-5 grid gap-3 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="etiqueta">Título *</label>
            <input className="campo" required value={campos.titulo} onChange={set("titulo")} />
          </div>
          <div className="sm:col-span-2">
            <label className="etiqueta">Descripción</label>
            <textarea className="campo" rows={2} value={campos.descripcion} onChange={set("descripcion")} />
          </div>
          <div>
            <label className="etiqueta">Responsable</label>
            <select className="campo" value={campos.responsableId} onChange={set("responsableId")}>
              <option value="">— Sin asignar —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} ({NOMBRE_ROL[u.rol]})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta">Vence</label>
            <CampoFechaHora valor={campos.venceEn} onCambio={(venceEn) => setCampos((c) => ({ ...c, venceEn }))} horaPorDefecto="18:00" opcional />
          </div>
          <div>
            <label className="etiqueta">Evento (opcional)</label>
            <select className="campo" value={campos.eventoId} onChange={set("eventoId")}>
              <option value="">— Ninguno —</option>
              {eventos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre} ({formatoFechaHora(e.inicio)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta">Estado</label>
            <select className="campo" value={campos.estado} onChange={set("estado")}>
              {ESTADOS_TAREA.map((e) => (
                <option key={e} value={e}>
                  {NOMBRE_ESTADO_TAREA[e]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="boton">
              Guardar
            </button>
            <button type="button" className="boton-secundario" onClick={() => setEditando(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {tareas.length === 0 && <p className="text-sm text-zinc-400">No hay tareas.</p>}
        {tareas.map((t) => {
          const vencida = t.venceEn && t.estado !== "completada" && new Date(t.venceEn).getTime() < ahora;
          const puedeCambiar = gestor || t.responsableId === sesion?.usuario.id;
          return (
            <div key={t.id} className={`tarjeta flex flex-wrap items-start gap-3 p-4 ${vencida ? "border-red-300" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${t.estado === "completada" ? "text-zinc-400 line-through" : ""}`}>{t.titulo}</p>
                {t.descripcion && <p className="text-sm whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{t.descripcion}</p>}
                <p className="mt-1 text-xs text-zinc-500">
                  {t.responsableNombre ?? "Sin responsable"}
                  {t.venceEn && (
                    <span className={vencida ? "font-bold text-red-600" : ""}> · Vence {formatoFechaHora(t.venceEn)}{vencida && " (vencida)"}</span>
                  )}
                  {t.eventoId && (
                    <>
                      {" · "}
                      <Link href={`/eventos/${t.eventoId}`} className="text-brand-navy hover:underline">
                        {t.eventoNombre}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {puedeCambiar ? (
                  <select
                    className={`rounded-md border-0 px-2 py-1 text-xs font-semibold ${COLOR_ESTADO_TAREA[t.estado]}`}
                    value={t.estado}
                    onChange={(e) => cambiarEstado(t, e.target.value as EstadoTarea)}
                  >
                    {ESTADOS_TAREA.map((e) => (
                      <option key={e} value={e}>
                        {NOMBRE_ESTADO_TAREA[e]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${COLOR_ESTADO_TAREA[t.estado]}`}>{NOMBRE_ESTADO_TAREA[t.estado]}</span>
                )}
                {gestor && (
                  <>
                    <button type="button" className="text-sm font-medium text-brand-navy hover:underline" onClick={() => abrir(t)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="boton-peligro"
                      onClick={async () => {
                        if (!confirm(`¿Eliminar la tarea "${t.titulo}"?`)) return;
                        try {
                          await pedir(`/api/tareas/${t.id}`, { method: "DELETE" });
                          cargar();
                        } catch (err) {
                          setError(mensajeDe(err));
                        }
                      }}
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
