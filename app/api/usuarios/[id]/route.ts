import { NextRequest, NextResponse } from "next/server";
import { idDeParams, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { esGestor } from "@/lib/auth/permisos";
import { actualizarUsuario } from "@/lib/db/usuarios";
import { esquemaUsuario } from "@/lib/esquemas";

/** No hay DELETE: un usuario se desactiva (activo = false) para no perder quién tildó o firmó cada cosa. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actual = await requerirUsuario((u) => esGestor(u.rol));
    const id = idDeParams((await params).id);
    const input = await leerCuerpo(req, esquemaUsuario);
    if (id === actual.id && !input.activo) {
      return NextResponse.json({ error: "No podés desactivar tu propio usuario." }, { status: 400 });
    }
    const usuario = await actualizarUsuario(id, input, input.password);
    if (!usuario) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    return NextResponse.json(usuario);
  } catch (error) {
    return respuestaError(error, "actualizando usuario", { usuarios_email_key: "Ya existe un usuario con ese mail." });
  }
}
