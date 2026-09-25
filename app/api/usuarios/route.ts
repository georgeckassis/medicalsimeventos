import { NextRequest, NextResponse } from "next/server";
import { leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { esquemaUsuario } from "@/lib/esquemas";
import { ROLES_ASIGNABLES } from "@/lib/db/types";
import { esGestor } from "@/lib/auth/permisos";
import { crearUsuario, listarUsuarios } from "@/lib/db/usuarios";

const UNICIDAD = { usuarios_email_key: "Ya existe un usuario con ese mail." };

export async function GET(req: NextRequest) {
  try {
    const usuario = await requerirUsuario();
    const rol = req.nextUrl.searchParams.get("rol");
    const usuarios = await listarUsuarios({
      // El superadmin no aparece nunca en la lista (ni para sí mismo: su contraseña se cambia en "Mi cuenta").
      incluirSuperadmin: false,
      rol: (ROLES_ASIGNABLES as readonly string[]).includes(rol ?? "") ? (rol as (typeof ROLES_ASIGNABLES)[number]) : undefined,
      soloActivos: !esGestor(usuario.rol),
    });
    return NextResponse.json(usuarios);
  } catch (error) {
    return respuestaError(error, "listando usuarios");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requerirUsuario((u) => esGestor(u.rol));
    const input = await leerCuerpo(req, esquemaUsuario);
    if (!input.password) return NextResponse.json({ error: "La contraseña inicial es obligatoria." }, { status: 400 });
    const usuario = await crearUsuario({ ...input, password: input.password });
    return NextResponse.json(usuario, { status: 201 });
  } catch (error) {
    return respuestaError(error, "creando usuario", UNICIDAD);
  }
}
