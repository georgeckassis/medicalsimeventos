"use client";

import Crud from "@/components/Crud";
import Encabezado from "@/components/Encabezado";
import { useSesion } from "@/components/Sesion";
import type { Vehiculo } from "@/lib/db/types";

export default function VehiculosPage() {
  const { sesion } = useSesion();
  const rol = sesion?.usuario.rol;
  const gestor = rol === "general" || rol === "superadmin";
  const logistica = gestor || rol === "logistica";
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Encabezado titulo="Vehículos" descripcion="Patentes para pedir la autorización de ingreso a cada sede." />
      {sesion && (
        <Crud<Vehiculo>
          endpoint="/api/vehiculos"
          puedeCrear={logistica}
          puedeEditar={logistica}
          puedeBorrar={gestor}
          textoNuevo="+ Agregar vehículo"
          mensajeBorrar={(v) => `¿Eliminar el vehículo ${v.patente}?`}
          campos={[
            { clave: "patente", etiqueta: "Patente", requerido: true },
            { clave: "marca", etiqueta: "Marca" },
            { clave: "modelo", etiqueta: "Modelo" },
            { clave: "activo", etiqueta: "Activo", tipo: "si_no" },
            { clave: "notas", etiqueta: "Notas" },
          ]}
          aValores={(v) => ({
            patente: v?.patente ?? "",
            marca: v?.marca ?? "",
            modelo: v?.modelo ?? "",
            activo: v && !v.activo ? "no" : "si",
            notas: v?.notas ?? "",
          })}
          aCuerpo={(v) => ({ ...v, activo: v.activo === "si" })}
          columnas={[
            { titulo: "Patente", render: (v) => <span className={`font-mono font-bold ${v.activo ? "" : "text-zinc-400 line-through"}`}>{v.patente}</span> },
            { titulo: "Vehículo", render: (v) => `${v.marca} ${v.modelo}`.trim() || "—" },
            { titulo: "Notas", render: (v) => v.notas || "—" },
          ]}
        />
      )}
    </div>
  );
}
