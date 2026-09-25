"use client";

import { useEffect, useState } from "react";
import MensajeError from "@/components/MensajeError";
import { mensajeDe, pedir } from "@/lib/cliente";
import type { DetalleEvento, ItemInventario } from "@/lib/db/types";

/**
 * Lista de objetos a llevar. Solo el encargado general la arma: elige del
 * inventario en un desplegable y pone la cantidad. Avisa si en esas fechas
 * no alcanza el stock por otros eventos que se superponen.
 */
export default function ListaObjetos({ detalle, onCambio }: { detalle: DetalleEvento; onCambio: () => void }) {
  const { evento, items, cierres, permisos } = detalle;
  const [inventario, setInventario] = useState<ItemInventario[]>([]);
  const [inventarioId, setInventarioId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const bloqueada = cierres.length > 0;
  const puedeEditar = permisos.editarEvento && !bloqueada;

  useEffect(() => {
    if (puedeEditar) pedir<ItemInventario[]>("/api/inventario").then((i) => setInventario(i.filter((x) => x.activo))).catch(() => {});
  }, [puedeEditar]);

  async function ejecutar(accion: () => Promise<unknown>) {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      onCambio();
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setOcupado(false);
    }
  }

  const seleccionado = inventario.find((i) => String(i.id) === inventarioId);

  return (
    <section className="tarjeta p-5">
      <h2 className="mb-1 font-bold">Objetos a llevar</h2>
      <p className="mb-4 text-xs text-zinc-500">
        {bloqueada
          ? "La lista está bloqueada porque ya se cerró al menos una etapa con firma. El encargado general puede reabrirla desde el checklist."
          : permisos.editarEvento
            ? "Elegí del inventario y poné la cantidad. Si el objeto ya está en la lista, se reemplaza la cantidad."
            : "Lista armada por el encargado general."}
      </p>

      {puedeEditar && (
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <label className="etiqueta">Objeto del inventario</label>
            <select className="campo" value={inventarioId} onChange={(e) => setInventarioId(e.target.value)}>
              <option value="">— Elegí un objeto —</option>
              {inventario.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.categoria ? `${i.categoria} · ` : ""}
                  {i.nombre} (stock {i.stock})
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="etiqueta">Cantidad</label>
            <input className="campo" type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
          <button
            type="button"
            className="boton"
            disabled={ocupado || !inventarioId || !(Number(cantidad) > 0)}
            onClick={() =>
              ejecutar(async () => {
                await pedir(`/api/eventos/${evento.id}/items`, {
                  method: "POST",
                  body: { inventarioId: Number(inventarioId), cantidad: Number(cantidad) },
                });
                setInventarioId("");
                setCantidad("1");
              })
            }
          >
            Agregar
          </button>
          {seleccionado && Number(cantidad) > seleccionado.stock && (
            <p className="w-full text-xs font-semibold text-red-600">Pediste más de lo que hay en stock ({seleccionado.stock}).</p>
          )}
        </div>
      )}
      {error && (
        <div className="mb-3">
          <MensajeError mensaje={error} />
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-zinc-400">Todavía no hay objetos cargados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="py-2 pr-3">Objeto</th>
                <th className="py-2 pr-3">Cantidad</th>
                <th className="py-2 pr-3">Stock / disponible</th>
                {puedeEditar && <th className="py-2" />}
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const disponible = i.stock - i.comprometidoOtros;
                const noAlcanza = i.cantidad > disponible;
                return (
                  <tr key={i.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-3">
                      <span className="font-medium">{i.nombre}</span>
                      {i.categoria && <span className="block text-xs text-zinc-500">{i.categoria}</span>}
                    </td>
                    <td className="py-2 pr-3">
                      {puedeEditar ? (
                        <input
                          type="number"
                          min={1}
                          defaultValue={i.cantidad}
                          className="campo w-20"
                          onBlur={(e) => {
                            const n = Number(e.target.value);
                            if (n > 0 && n !== i.cantidad) {
                              ejecutar(() => pedir(`/api/eventos/${evento.id}/items/${i.id}`, { method: "PUT", body: { cantidad: n } }));
                            }
                          }}
                        />
                      ) : (
                        <span className="font-bold">{i.cantidad}</span>
                      )}
                    </td>
                    <td className={`py-2 pr-3 text-xs ${noAlcanza ? "font-semibold text-red-600" : "text-zinc-500"}`}>
                      {i.stock} en stock
                      {i.comprometidoOtros > 0 && ` · ${i.comprometidoOtros} en otros eventos esas fechas`}
                      {noAlcanza && ` · ¡No alcanza! Disponible: ${Math.max(disponible, 0)}`}
                    </td>
                    {puedeEditar && (
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          className="boton-peligro"
                          disabled={ocupado}
                          onClick={() => {
                            if (confirm(`¿Quitar ${i.nombre} de la lista?`)) {
                              ejecutar(() => pedir(`/api/eventos/${evento.id}/items/${i.id}`, { method: "DELETE" }));
                            }
                          }}
                        >
                          Quitar
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
