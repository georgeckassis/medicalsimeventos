import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_SESION, leerTokenSesion } from "@/lib/auth/sesion";
import { esViolacionUnicidad, mensajeError } from "@/lib/db/errores";
import { obtenerUsuario } from "@/lib/db/usuarios";
import type { Usuario } from "@/lib/db/types";

/** Error con código HTTP que las API routes devuelven tal cual al front. */
export class ErrorApi extends Error {
  constructor(
    public status: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

export async function usuarioActual(): Promise<Usuario | null> {
  const id = leerTokenSesion((await cookies()).get(COOKIE_SESION)?.value);
  if (!id) return null;
  const usuario = await obtenerUsuario(id);
  return usuario && usuario.activo ? usuario : null;
}

/** Usuario logueado y activo; si se pasa `permitido`, además valida su rol. */
export async function requerirUsuario(permitido?: (u: Usuario) => boolean): Promise<Usuario> {
  const usuario = await usuarioActual();
  if (!usuario) throw new ErrorApi(401, "Tu sesión expiró. Volvé a iniciar sesión.");
  if (permitido && !permitido(usuario)) throw new ErrorApi(403, "Tu rol no tiene permiso para esta acción.");
  return usuario;
}

export async function leerCuerpo<T extends z.ZodType>(req: Request, esquema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ErrorApi(400, "El cuerpo del pedido no es un JSON válido.");
  }
  const r = esquema.safeParse(json);
  if (!r.success) {
    const primero = r.error.issues[0];
    const campo = primero?.path.join(".");
    throw new ErrorApi(400, campo ? `${campo}: ${primero.message}` : (primero?.message ?? "Datos inválidos."));
  }
  return r.data;
}

export function idDeParams(valor: string): number {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorApi(400, "Id inválido.");
  return id;
}

export function respuestaError(error: unknown, contexto: string, mensajesUnicidad: Record<string, string> = {}) {
  if (error instanceof ErrorApi) return NextResponse.json({ error: error.message }, { status: error.status });
  for (const [constraint, mensaje] of Object.entries(mensajesUnicidad)) {
    if (esViolacionUnicidad(error, constraint)) return NextResponse.json({ error: mensaje }, { status: 409 });
  }
  console.error(`Error ${contexto}:`, error);
  return NextResponse.json({ error: mensajeError(error) }, { status: 500 });
}

/** Campos de texto opcionales: undefined → "", recortados. */
export const textoOpcional = z.string().trim().max(5000).optional().default("");
/** ISO o null (las pantallas mandan ISO ya convertido desde hora Argentina). */
export const fechaOpcional = z.iso.datetime({ offset: true }).nullable().optional().default(null);
