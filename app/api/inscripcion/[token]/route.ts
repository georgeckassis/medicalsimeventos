import { NextRequest, NextResponse } from "next/server";
import { ErrorApi, leerCuerpo, respuestaError } from "@/lib/api";
import { inscribirAlumno } from "@/lib/db/alumnos";
import { ipDe, sumarIntento } from "@/lib/db/limites";
import { obtenerEventoPorToken } from "@/lib/db/eventos";
import { esquemaAlumno } from "@/lib/esquemas";

// Público (sin login): es lo que abre el alumno al escanear el QR. Solo
// expone el nombre, la fecha y la sede del evento.

type Ctx = { params: Promise<{ token: string }> };

// Freno contra envíos masivos al formulario público, guardado en la base:
// 30 envíos por IP cada 10 minutos (alcanza para un aula entera compartiendo
// el wifi de la sede) y 500 por evento por día.
async function frenarSiAbusa(req: NextRequest, token: string) {
  const [porIp, porEvento] = await Promise.all([
    sumarIntento(`inscripcion-ip:${ipDe(req)}`, 10 * 60),
    sumarIntento(`inscripcion-evento:${token}`, 24 * 3600),
  ]);
  if (porIp > 30 || porEvento > 500) throw new ErrorApi(429, "Demasiados envíos. Probá de nuevo en unos minutos.");
}

async function eventoAbierto(token: string) {
  const evento = await obtenerEventoPorToken(token);
  if (!evento) throw new ErrorApi(404, "El enlace de inscripción no es válido.");
  return evento;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const evento = await eventoAbierto((await params).token);
    return NextResponse.json({
      nombre: evento.nombre,
      inicio: evento.inicio,
      fin: evento.fin,
      sede: evento.sede,
      institucionNombre: evento.institucionNombre,
      abierto: evento.estado !== "cancelado" && evento.estado !== "finalizado" });
  } catch (error) {
    return respuestaError(error, "leyendo la inscripción");
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { token } = await params;
    const evento = await eventoAbierto(token);
    await frenarSiAbusa(req, token);
    if (evento.estado === "cancelado" || evento.estado === "finalizado") {
      throw new ErrorApi(409, "La inscripción a este evento está cerrada.");
    }
    const alumno = await inscribirAlumno(evento.id, await leerCuerpo(req, esquemaAlumno));
    return NextResponse.json({ ok: true, nombre: alumno.nombre }, { status: 201 });
  } catch (error) {
    return respuestaError(error, "inscribiendo alumno");
  }
}
