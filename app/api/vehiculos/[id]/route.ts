import { NextRequest, NextResponse } from "next/server";
import { idDeParams, leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { esGestor, puedeEditarLogistica } from "@/lib/auth/permisos";
import { actualizarVehiculo, eliminarVehiculo } from "@/lib/db/vehiculos";
import { esquemaVehiculo, UNICIDAD_VEHICULO } from "@/lib/esquemas";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    await requerirUsuario((u) => puedeEditarLogistica(u.rol));
    const id = idDeParams((await params).id);
    const vehiculo = await actualizarVehiculo(id, await leerCuerpo(req, esquemaVehiculo));
    if (!vehiculo) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    return NextResponse.json(vehiculo);
  } catch (error) {
    return respuestaError(error, "actualizando vehículo", UNICIDAD_VEHICULO);
  }
}

// Borrar queda solo para el encargado general (logística puede desactivarlo).
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    await requerirUsuario((u) => esGestor(u.rol));
    await eliminarVehiculo(idDeParams((await params).id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "eliminando vehículo");
  }
}
