"use client";

import { useCallback, useEffect, useState } from "react";
import MensajeError from "@/components/MensajeError";
import { mensajeDe, pedir } from "@/lib/cliente";
import { formatoFechaHora } from "@/lib/fechas";
import type { Alumno, DetalleEvento } from "@/lib/db/types";

const VACIO = { nombre: "", apellido: "", dni: "", email: "", telefono: "", institucion: "", especialidad: "" };

/** QR de inscripción + lista de alumnos que se anotaron (o que cargó a mano el encargado general). */
export default function Alumnos({ detalle }: { detalle: DetalleEvento }) {
  const { evento, permisos } = detalle;
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(VACIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const enlace = typeof window !== "undefined" ? `${window.location.origin}/inscripcion/${evento.tokenInscripcion}` : "";

  const cargar = useCallback(() => {
    pedir<Alumno[]>(`/api/eventos/${evento.id}/alumnos`)
      .then(setAlumnos)
      .catch((e) => setError(mensajeDe(e)));
  }, [evento.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await pedir(`/api/eventos/${evento.id}/alumnos`, { method: "POST", body: nuevo });
      setNuevo(VACIO);
      setMostrarForm(false);
      cargar();
    } catch (err) {
      setError(mensajeDe(err));
    }
  }

  function exportarCsv() {
    const filas = [
      ["Apellido", "Nombre", "DNI", "Email", "Teléfono", "Institución", "Especialidad", "Inscripción"],
      ...alumnos.map((a) => [a.apellido, a.nombre, a.dni, a.email, a.telefono, a.institucion, a.especialidad, formatoFechaHora(a.creadoEn)]),
    ];
    const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `alumnos-${evento.nombre.replace(/[^\w-]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <section className="tarjeta p-5 text-center">
        <h2 className="mb-2 font-bold">QR de inscripción</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/eventos/${evento.id}/qr`} alt="QR de inscripción" className="mx-auto w-56 rounded-lg border border-zinc-200 bg-white" />
        <p className="mt-2 text-xs text-zinc-500">Los alumnos lo escanean y completan sus datos; aparecen solos en esta lista.</p>
        <div className="mt-3 flex flex-col gap-2">
          <a className="boton-secundario" href={`/api/eventos/${evento.id}/qr`} download={`qr-${evento.id}.svg`}>
            Descargar QR
          </a>
          <button type="button" className="boton-secundario" onClick={() => navigator.clipboard?.writeText(enlace)}>
            Copiar enlace
          </button>
        </div>
      </section>

      <section className="tarjeta p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">
            Inscriptos: {alumnos.length}
            <span className="font-normal text-zinc-500"> / {evento.cantidadAlumnos} previstos</span>
          </h2>
          <div className="flex gap-2">
            {alumnos.length > 0 && (
              <button type="button" className="boton-secundario" onClick={exportarCsv}>
                Exportar CSV
              </button>
            )}
            {permisos.editarEvento && (
              <button type="button" className="boton-secundario" onClick={() => setMostrarForm((v) => !v)}>
                + Cargar a mano
              </button>
            )}
          </div>
        </div>
        {error && <MensajeError mensaje={error} />}
        {mostrarForm && (
          <form onSubmit={agregar} className="mb-4 grid gap-2 rounded-lg border border-zinc-200 p-3 sm:grid-cols-3 dark:border-zinc-700">
            {(Object.keys(VACIO) as Array<keyof typeof VACIO>).map((k) => (
              <input
                key={k}
                className="campo"
                placeholder={k[0].toUpperCase() + k.slice(1) + (["nombre", "apellido", "dni", "email"].includes(k) ? " *" : "")}
                value={nuevo[k]}
                onChange={(e) => setNuevo((n) => ({ ...n, [k]: e.target.value }))}
              />
            ))}
            <button type="submit" className="boton">
              Guardar
            </button>
          </form>
        )}
        {alumnos.length === 0 ? (
          <p className="text-sm text-zinc-400">Todavía no se inscribió nadie.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="py-2 pr-3">Alumno</th>
                  <th className="py-2 pr-3">DNI</th>
                  <th className="py-2 pr-3">Contacto</th>
                  <th className="py-2 pr-3">Institución / especialidad</th>
                  {permisos.editarEvento && <th />}
                </tr>
              </thead>
              <tbody>
                {alumnos.map((a) => (
                  <tr key={a.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-3 font-medium">
                      {a.apellido}, {a.nombre}
                    </td>
                    <td className="py-2 pr-3">{a.dni}</td>
                    <td className="py-2 pr-3 text-xs">
                      {a.email}
                      <span className="block text-zinc-500">{a.telefono}</span>
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {a.institucion}
                      <span className="block text-zinc-500">{a.especialidad}</span>
                    </td>
                    {permisos.editarEvento && (
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          className="boton-peligro"
                          onClick={async () => {
                            if (!confirm(`¿Quitar a ${a.nombre} ${a.apellido}?`)) return;
                            try {
                              await pedir(`/api/eventos/${evento.id}/alumnos/${a.id}`, { method: "DELETE" });
                              cargar();
                            } catch (err) {
                              setError(mensajeDe(err));
                            }
                          }}
                        >
                          Quitar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
