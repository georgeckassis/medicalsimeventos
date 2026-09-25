import { NextRequest, NextResponse } from "next/server";
import { leerCuerpo, requerirUsuario, respuestaError } from "@/lib/api";
import { esquemaVehiculo, UNICIDAD_VEHICULO } from "@/lib/esquemas";
import { puedeEditarLogistica } from "@/lib/auth/permisos";
import { crearVehiculo, listarVehiculos } from "@/lib/db/vehiculos";

export async function GET() {
  try {
    await requerirUsuario();
    return NextResponse.json(await listarVehiculos());
  } catch (error) {
    return respuestaError(error, "listando vehículos");
  }
}

// Los vehículos los administra quien organiza la logística (general o logística).
export async function POST(req: NextRequest) {
  try {
    await requerirUsuario((u) => puedeEditarLogistica(u.rol));
    return NextResponse.json(await crearVehiculo(await leerCuerpo(req, esquemaVehiculo)), { status: 201 });
  } catch (error) {
    return respuestaError(error, "creando vehículo", UNICIDAD_VEHICULO);
  }
}
