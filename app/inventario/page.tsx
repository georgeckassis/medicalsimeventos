"use client";

import Crud from "@/components/Crud";
import Encabezado from "@/components/Encabezado";
import { useSesion } from "@/components/Sesion";
import type { ItemInventario } from "@/lib/db/types";

export default function InventarioPage() {
  const { sesion } = useSesion();
  const rol = sesion?.usuario.rol;
  const gestor = rol === "general" || rol === "superadmin";
  const logistica = gestor || rol === "logistica";
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Encabezado
        titulo="Inventario"
        descripcion="Objetos que se llevan a los eventos (mesas, TV, simuladores…). Después se eligen desde un desplegable al armar cada evento."
      />
      {sesion && (
        <Crud<ItemInventario>
          endpoint="/api/inventario"
          puedeCrear={logistica}
          puedeEditar={logistica}
          puedeBorrar={gestor}
          textoNuevo="+ Agregar objeto"
          mensajeBorrar={(i) => `¿Eliminar "${i.nombre}"? Si ya se usó en algún evento, queda desactivado en vez de borrarse.`}
          campos={[
            { clave: "nombre", etiqueta: "Nombre", requerido: true },
            { clave: "categoria", etiqueta: "Categoría", ayuda: "Ej: Mobiliario, Audiovisual, Simuladores" },
            { clave: "stock", etiqueta: "Cantidad en stock", tipo: "numero", requerido: true },
            { clave: "activo", etiqueta: "Activo", tipo: "si_no" },
            { clave: "descripcion", etiqueta: "Descripción" },
          ]}
          aValores={(i) => ({
            nombre: i?.nombre ?? "",
            categoria: i?.categoria ?? "",
            stock: i ? String(i.stock) : "",
            activo: i && !i.activo ? "no" : "si",
            descripcion: i?.descripcion ?? "",
          })}
          aCuerpo={(v) => ({ ...v, stock: Number(v.stock) || 0, activo: v.activo === "si" })}
          columnas={[
            {
              titulo: "Objeto",
              render: (i) => (
                <span className={i.activo ? "" : "text-zinc-400 line-through"}>
                  <span className="font-medium">{i.nombre}</span>
                  {i.descripcion && <span className="block text-xs text-zinc-500">{i.descripcion}</span>}
                </span>
              ),
            },
            { titulo: "Categoría", render: (i) => i.categoria || "—" },
            { titulo: "Stock", render: (i) => <span className="font-bold">{i.stock}</span> },
          ]}
        />
      )}
    </div>
  );
}
