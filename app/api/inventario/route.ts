import { NextRequest, NextResponse } from "next/server";
import { leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { esquemaInventario, UNICIDAD_INVENTARIO } from "@/lib/esquemas";
import { puedeEditarLogistica } from "@/lib/auth/permisos";
import { crearItemInventario, listarInventario } from "@/lib/db/inventario";

export async function GET() {
  try {
    await requerirUsuario();
    return NextResponse.json(await listarInventario());
  } catch (error) {
    return respuestaError(error, "listando inventario");
  }
}

// El inventario lo cargan el encargado general y el de logística (depósito).
export async function POST(req: NextRequest) {
  try {
    await requerirUsuario((u) => puedeEditarLogistica(u.rol));
    return NextResponse.json(await crearItemInventario(await leerCuerpo(req, esquemaInventario)), { status: 201 });
  } catch (error) {
    return respuestaError(error, "creando objeto de inventario", UNICIDAD_INVENTARIO);
  }
}
