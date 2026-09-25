"use client";

import { useEffect, useState } from "react";
import Crud from "@/components/Crud";
import Encabezado from "@/components/Encabezado";
import { useSesion } from "@/components/Sesion";
import { pedir } from "@/lib/cliente";
import type { Institucion, Usuario } from "@/lib/db/types";

export default function InstitucionesPage() {
  const { sesion } = useSesion();
  const gestor = sesion?.usuario.rol === "general" || sesion?.usuario.rol === "superadmin";
  const [vendedores, setVendedores] = useState<Usuario[]>([]);

  useEffect(() => {
    pedir<Usuario[]>("/api/usuarios?rol=vendedor")
      .then((u) => setVendedores(u.filter((r) => r.activo)))
      .catch(() => {});
  }, []);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Encabezado
        titulo="Instituciones"
        descripcion="Clientes de los cursos. Cada institución tiene su representante de ventas de MedicalSim; su representante (ej. el jefe médico) se da de alta en Usuarios."
      />
      {sesion && (
        <Crud<Institucion>
          endpoint="/api/instituciones"
          puedeCrear={gestor}
          puedeEditar={gestor}
          puedeBorrar={gestor}
          textoNuevo="+ Agregar institución"
          mensajeBorrar={(i) => `¿Eliminar "${i.nombre}"? Sus eventos y vendedores quedan sin institución.`}
          campos={[
            { clave: "nombre", etiqueta: "Nombre", requerido: true },
            {
              clave: "vendedorId",
              etiqueta: "Representante de ventas",
              tipo: "opciones",
              opciones: [{ valor: "", etiqueta: "— Sin asignar —" }, ...vendedores.map((r) => ({ valor: String(r.id), etiqueta: r.nombre }))],
              ayuda: "Vendedor de MedicalSim que atiende esta institución. Se da de alta en Usuarios.",
            },
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
            vendedorId: i?.vendedorId ? String(i.vendedorId) : "",
          })}
          aCuerpo={(v) => ({ ...v, vendedorId: v.vendedorId ? Number(v.vendedorId) : null })}
          columnas={[
            { titulo: "Institución", render: (i) => <span className="font-medium">{i.nombre}</span> },
            { titulo: "Representante de ventas", render: (i) => i.vendedorNombre ?? <span className="text-amber-600">Sin asignar</span> },
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
