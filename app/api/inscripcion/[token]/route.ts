import { NextRequest, NextResponse } from "next/server";
import { ErrorApi, leerCuerpo, respuestaError } from "@/lib/api";
import { inscribirAlumno } from "@/lib/db/alumnos";
import { obtenerEventoPorToken } from "@/lib/db/eventos";
import { esquemaAlumno } from "@/lib/esquemas";

// Público (sin login): es lo que abre el alumno al escanear el QR. Solo
// expone el nombre, la fecha y la sede del evento.

type Ctx = { params: Promise<{ token: string }> };

// Freno simple contra envíos masivos al formulario público: 30 por IP cada
// 10 minutos (por instancia del servidor). Alcanza para un aula entera
// compartiendo el wifi de la sede.
const envios = new Map<string, { cantidad: number; desde: number }>();
const MAX_ENVIOS = 30;
const VENTANA_MS = 10 * 60_000;

function frenarSiAbusa(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const r = envios.get(ip);
  const vigente = r && Date.now() - r.desde < VENTANA_MS ? r : { cantidad: 0, desde: Date.now() };
  if (vigente.cantidad >= MAX_ENVIOS) throw new ErrorApi(429, "Demasiados envíos. Probá de nuevo en unos minutos.");
  envios.set(ip, { ...vigente, cantidad: vigente.cantidad + 1 });
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
    frenarSiAbusa(req);
    const evento = await eventoAbierto((await params).token);
    if (evento.estado === "cancelado" || evento.estado === "finalizado") {
      throw new ErrorApi(409, "La inscripción a este evento está cerrada.");
    }
    const alumno = await inscribirAlumno(evento.id, await leerCuerpo(req, esquemaAlumno));
    return NextResponse.json({ ok: true, nombre: alumno.nombre }, { status: 201 });
  } catch (error) {
    return respuestaError(error, "inscribiendo alumno");
  }
}
