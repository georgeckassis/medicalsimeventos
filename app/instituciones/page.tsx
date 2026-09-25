"use client";

import Crud from "@/components/Crud";
import Encabezado from "@/components/Encabezado";
import { useSesion } from "@/components/Sesion";
import type { Institucion } from "@/lib/db/types";

export default function InstitucionesPage() {
  const { sesion } = useSesion();
  const gestor = sesion?.usuario.rol === "general" || sesion?.usuario.rol === "superadmin";
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Encabezado
        titulo="Instituciones"
        descripcion="Clientes / instituciones de los cursos. Cada representante ve solo los eventos de su institución."
      />
      {sesion && (
        <Crud<Institucion>
          endpoint="/api/instituciones"
          puedeCrear={gestor}
          puedeEditar={gestor}
          puedeBorrar={gestor}
          textoNuevo="+ Agregar institución"
          mensajeBorrar={(i) => `¿Eliminar "${i.nombre}"? Sus eventos y representantes quedan sin institución.`}
          campos={[
            { clave: "nombre", etiqueta: "Nombre", requerido: true },
            { clave: "direccion", etiqueta: "Dirección" },
            { clave: "contacto", etiqueta: "Persona de contacto" },
            { clave: "telefono", etiqueta: "Teléfono" },
            { clave: "email", etiqueta: "Mail" },
          ]}
          aValores={(i) => ({
            nombre: i?.nombre ?? "",
            direccion: i?.direccion ?? "",
            contacto: i?.contacto ?? "",
            telefono: i?.telefono ?? "",
            email: i?.email ?? "",
          })}
          aCuerpo={(v) => v}
          columnas={[
            { titulo: "Institución", render: (i) => <span className="font-medium">{i.nombre}</span> },
            { titulo: "Dirección", render: (i) => i.direccion || "—" },
            {
              titulo: "Contacto",
              render: (i) => (
                <span className="text-xs">
                  {i.contacto || "—"}
                  <span className="block text-zinc-500">{[i.telefono, i.email].filter(Boolean).join(" · ")}</span>
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
