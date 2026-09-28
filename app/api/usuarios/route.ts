import { NextRequest, NextResponse } from "next/server";
import { ErrorApi, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { problemaPassword } from "@/lib/auth/password";
import { esquemaUsuario } from "@/lib/esquemas";
import { ROLES_ASIGNABLES } from "@/lib/db/types";
import { esGestor } from "@/lib/auth/permisos";
import { crearUsuario, listarUsuarios, sinDatosInternos } from "@/lib/db/usuarios";

const UNICIDAD = { usuarios_email_key: "Ya existe un usuario con ese mail." };

/**
 * El encargado general ve a todos con sus datos. Logística solo necesita
 * elegir chofer y encargado de logística: ve esos dos roles, sin mail ni
 * teléfono (el DNI del chofer sí, para el permiso de ingreso). El resto de
 * los roles no puede listar usuarios.
 */
export async function GET(req: NextRequest) {
  try {
    const usuario = await requerirUsuario((u) => esGestor(u.rol) || u.rol === "logistica");
    const rolPedido = req.nextUrl.searchParams.get("rol");
    const rol = (ROLES_ASIGNABLES as readonly string[]).includes(rolPedido ?? "") ? (rolPedido as (typeof ROLES_ASIGNABLES)[number]) : undefined;
    if (!esGestor(usuario.rol) && rol !== "chofer" && rol !== "logistica") {
      throw new ErrorApi(403, "Tu rol no tiene permiso para ver esta lista.");
    }
    const usuarios = await listarUsuarios({
      // El superadmin no aparece nunca en la lista (ni para sí mismo: su contraseña se cambia en "Mi cuenta").
      incluirSuperadmin: false,
      rol,
      soloActivos: !esGestor(usuario.rol),
    });
    if (esGestor(usuario.rol)) return NextResponse.json(usuarios.map(sinDatosInternos));
    return NextResponse.json(
      usuarios.map((u) => ({
        id: u.id,
        nombre: u.nombre,
        rol: u.rol,
        dni: u.rol === "chofer" ? u.dni : "",
        email: "",
        telefono: "",
        institucionId: null,
        institucionNombre: null,
        activo: u.activo,
        debeCambiarPassword: false,
      })),
    );
  } catch (error) {
    return respuestaError(error, "listando usuarios");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requerirUsuario((u) => esGestor(u.rol));
    const input = await leerCuerpo(req, esquemaUsuario);
    if (!input.password) return NextResponse.json({ error: "La contraseña inicial es obligatoria." }, { status: 400 });
    const problema = problemaPassword(input.password, input.email);
    if (problema) throw new ErrorApi(400, problema);
    if (input.rol === "representante" && !input.institucionId) {
      return NextResponse.json({ error: "El representante de la institución tiene que tener su institución asignada." }, { status: 400 });
    }
    const usuario = await crearUsuario({ ...input, password: input.password });
    return NextResponse.json(sinDatosInternos(usuario), { status: 201 });
  } catch (error) {
    return respuestaError(error, "creando usuario", UNICIDAD);
  }
}
