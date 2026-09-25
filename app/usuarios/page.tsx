"use client";

import { useEffect, useState } from "react";
import Crud from "@/components/Crud";
import Encabezado from "@/components/Encabezado";
import { useSesion } from "@/components/Sesion";
import { pedir } from "@/lib/cliente";
import { NOMBRE_ROL, ROLES_ASIGNABLES, type Institucion, type Usuario } from "@/lib/db/types";

export default function UsuariosPage() {
  const { sesion } = useSesion();
  const [instituciones, setInstituciones] = useState<Institucion[]>([]);
  const gestor = sesion?.usuario.rol === "general" || sesion?.usuario.rol === "superadmin";

  useEffect(() => {
    pedir<Institucion[]>("/api/instituciones").then(setInstituciones).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Encabezado
        titulo="Usuarios"
        descripcion="Cada persona entra con su mail y contraseña. Los usuarios no se borran: se desactivan, para no perder quién tildó o firmó cada cosa."
      />
      {sesion && gestor && (
        <Crud<Usuario>
          endpoint="/api/usuarios"
          puedeCrear
          puedeEditar
          puedeBorrar={false}
          textoNuevo="+ Agregar usuario"
          campos={[
            { clave: "nombre", etiqueta: "Nombre y apellido", requerido: true },
            { clave: "email", etiqueta: "Mail (para entrar)", tipo: "email", requerido: true },
            { clave: "rol", etiqueta: "Rol", tipo: "opciones", opciones: ROLES_ASIGNABLES.map((r) => ({ valor: r, etiqueta: NOMBRE_ROL[r] })) },
            {
              clave: "institucionId",
              etiqueta: "Institución",
              tipo: "opciones",
              opciones: [{ valor: "", etiqueta: "— Ninguna —" }, ...instituciones.map((i) => ({ valor: String(i.id), etiqueta: i.nombre }))],
              visible: (v) => v.rol === "representante",
              ayuda: "Ve todos los eventos de esta institución. Si queda vacío, solo ve los eventos donde se lo asigne como representante a cargo.",
            },
            { clave: "telefono", etiqueta: "Teléfono / WhatsApp", ayuda: "Para los avisos por WhatsApp." },
            { clave: "dni", etiqueta: "DNI", ayuda: "Obligatorio para choferes (autorización de ingreso)." },
            {
              clave: "password",
              etiqueta: "Contraseña",
              tipo: "password",
              ayuda:
                "Mínimo 8 caracteres. Copiala antes de guardar para pasársela a la persona: se guarda cifrada y después no se puede volver a ver. Al editar, dejala vacía para no cambiarla o poné una nueva para resetearla.",
            },
            { clave: "activo", etiqueta: "Activo", tipo: "si_no" },
          ]}
          aValores={(u) => ({
            nombre: u?.nombre ?? "",
            email: u?.email ?? "",
            rol: u?.rol ?? "logistica",
            institucionId: u?.institucionId ? String(u.institucionId) : "",
            telefono: u?.telefono ?? "",
            dni: u?.dni ?? "",
            password: "",
            activo: u && !u.activo ? "no" : "si",
          })}
          aCuerpo={(v) => ({
            ...v,
            institucionId: v.rol === "representante" && v.institucionId ? Number(v.institucionId) : null,
            password: v.password || undefined,
            activo: v.activo === "si",
          })}
          columnas={[
            {
              titulo: "Usuario",
              render: (u) => (
                <span className={u.activo ? "" : "text-zinc-400 line-through"}>
                  <span className="font-medium">{u.nombre}</span>
                  <span className="block text-xs text-zinc-500">{u.email}</span>
                </span>
              ),
            },
            {
              titulo: "Rol",
              render: (u) => (
                <>
                  {NOMBRE_ROL[u.rol]}
                  {u.institucionNombre && <span className="block text-xs text-zinc-500">{u.institucionNombre}</span>}
                </>
              ),
            },
            { titulo: "Teléfono", render: (u) => u.telefono || "—" },
            { titulo: "DNI", render: (u) => u.dni || "—" },
          ]}
        />
      )}
    </div>
  );
}
