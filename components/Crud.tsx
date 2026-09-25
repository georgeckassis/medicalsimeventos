"use client";

import { useCallback, useEffect, useState } from "react";
import CampoPassword from "@/components/CampoPassword";
import MensajeError from "@/components/MensajeError";
import { mensajeDe, pedir } from "@/lib/cliente";

export interface Campo {
  clave: string;
  etiqueta: string;
  tipo?: "texto" | "numero" | "email" | "password" | "si_no" | "opciones";
  opciones?: Array<{ valor: string; etiqueta: string }>;
  requerido?: boolean;
  ayuda?: string;
  /** Solo se muestra si devuelve true para los valores actuales del formulario. */
  visible?: (valores: Record<string, string>) => boolean;
}

export interface Columna<T> {
  titulo: string;
  render: (fila: T) => React.ReactNode;
}

type Fila = { id: number };

/**
 * Pantalla de alta/edición/baja genérica (inventario, vehículos,
 * instituciones, usuarios). Los valores del formulario viajan como texto y
 * `aCuerpo` los convierte al JSON que espera la API.
 */
export default function Crud<T extends Fila>({
  endpoint,
  campos,
  columnas,
  aValores,
  aCuerpo,
  puedeCrear,
  puedeEditar,
  puedeBorrar,
  textoNuevo = "+ Agregar",
  mensajeBorrar,
}: {
  endpoint: string;
  campos: Campo[];
  columnas: Array<Columna<T>>;
  aValores: (fila?: T) => Record<string, string>;
  aCuerpo: (valores: Record<string, string>, fila?: T) => unknown;
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeBorrar: boolean;
  textoNuevo?: string;
  mensajeBorrar?: (fila: T) => string;
}) {
  const [filas, setFilas] = useState<T[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<T | "nuevo" | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setFilas(await pedir<T[]>(endpoint));
      setError(null);
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setCargando(false);
    }
  }, [endpoint]);

  useEffect(() => {
    // Carga inicial de datos al montar la página — patrón estándar de fetch-on-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  function abrir(fila?: T) {
    setValores(aValores(fila));
    setEditando(fila ?? "nuevo");
    setError(null);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const fila = editando === "nuevo" ? undefined : (editando ?? undefined);
      await pedir(fila ? `${endpoint}/${fila.id}` : endpoint, { method: fila ? "PUT" : "POST", body: aCuerpo(valores, fila) });
      setEditando(null);
      cargar();
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {puedeCrear && !editando && (
        <div>
          <button type="button" className="boton" onClick={() => abrir()}>
            {textoNuevo}
          </button>
        </div>
      )}
      {error && <MensajeError mensaje={error} onReintentar={editando ? undefined : cargar} />}

      {editando && (
        <form onSubmit={guardar} className="tarjeta grid gap-3 p-5 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">{editando === "nuevo" ? "Nuevo" : "Editar"}</h2>
          {campos
            .filter((c) => !c.visible || c.visible(valores))
            .map((c) => (
              <div key={c.clave}>
                <label className="etiqueta">
                  {c.etiqueta}
                  {c.requerido && " *"}
                </label>
                {c.tipo === "si_no" ? (
                  <select className="campo" value={valores[c.clave]} onChange={(e) => setValores((v) => ({ ...v, [c.clave]: e.target.value }))}>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                ) : c.tipo === "opciones" ? (
                  <select
                    className="campo"
                    required={c.requerido}
                    value={valores[c.clave]}
                    onChange={(e) => setValores((v) => ({ ...v, [c.clave]: e.target.value }))}
                  >
                    {c.opciones?.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.etiqueta}
                      </option>
                    ))}
                  </select>
                ) : c.tipo === "password" ? (
                  <CampoPassword
                    valor={valores[c.clave] ?? ""}
                    onCambio={(valor) => setValores((v) => ({ ...v, [c.clave]: valor }))}
                    autoComplete="new-password"
                    requerido={c.requerido}
                    conGenerar
                  />
                ) : (
                  <input
                    className="campo"
                    type={c.tipo === "numero" ? "number" : c.tipo === "email" ? "email" : "text"}
                    min={c.tipo === "numero" ? 0 : undefined}
                    required={c.requerido}
                    value={valores[c.clave] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [c.clave]: e.target.value }))}
                  />
                )}
                {c.ayuda && <p className="mt-1 text-xs text-zinc-500">{c.ayuda}</p>}
              </div>
            ))}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="boton" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="boton-secundario" onClick={() => setEditando(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="tarjeta overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              {columnas.map((c) => (
                <th key={c.titulo} className="px-3 py-2">
                  {c.titulo}
                </th>
              ))}
              {(puedeEditar || puedeBorrar) && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan={columnas.length + 1} className="px-3 py-6 text-center text-zinc-400">
                  Todavía no hay nada cargado.
                </td>
              </tr>
            )}
            {filas.map((fila) => (
              <tr key={fila.id} className="border-b border-zinc-100 dark:border-zinc-800">
                {columnas.map((c) => (
                  <td key={c.titulo} className="px-3 py-2">
                    {c.render(fila)}
                  </td>
                ))}
                {(puedeEditar || puedeBorrar) && (
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {puedeEditar && (
                      <button type="button" className="mr-3 text-sm font-medium text-brand-navy hover:underline" onClick={() => abrir(fila)}>
                        Editar
                      </button>
                    )}
                    {puedeBorrar && (
                      <button
                        type="button"
                        className="boton-peligro"
                        onClick={async () => {
                          if (!confirm(mensajeBorrar?.(fila) ?? "¿Eliminar?")) return;
                          try {
                            await pedir(`${endpoint}/${fila.id}`, { method: "DELETE" });
                            cargar();
                          } catch (err) {
                            setError(mensajeDe(err));
                          }
                        }}
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
