import { NextRequest, NextResponse } from "next/server";
import { idDeParams, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { esGestor } from "@/lib/auth/permisos";
import { actualizarItemInventario, eliminarItemInventario } from "@/lib/db/inventario";
import { esquemaInventario, UNICIDAD_INVENTARIO } from "@/lib/esquemas";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    await requerirUsuario((u) => esGestor(u.rol));
    const id = idDeParams((await params).id);
    const item = await actualizarItemInventario(id, await leerCuerpo(req, esquemaInventario));
    if (!item) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    return respuestaError(error, "actualizando inventario", UNICIDAD_INVENTARIO);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    await requerirUsuario((u) => esGestor(u.rol));
    const resultado = await eliminarItemInventario(idDeParams((await params).id));
    return NextResponse.json({ ok: true, resultado });
  } catch (error) {
    return respuestaError(error, "eliminando del inventario");
  }
}
