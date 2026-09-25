import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { idDeParams, requerirUsuario, respuestaError } from "@/lib/api";
import { eventoVisible } from "@/lib/acceso";

/** QR (SVG) que abre el formulario público de inscripción del evento. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await requerirUsuario();
    const evento = await eventoVisible(usuario, idDeParams((await params).id));
    const base = process.env.APP_URL?.replace(/\/$/, "") || req.nextUrl.origin;
    const url = `${base}/inscripcion/${evento.tokenInscripcion}`;
    const svg = await QRCode.toString(url, { type: "svg", margin: 2, width: 512, color: { dark: "#24578f" } });
    return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    return respuestaError(error, "generando el QR");
  }
}
