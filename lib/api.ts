import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_SESION, leerTokenSesion } from "@/lib/auth/sesion";
import { esViolacionUnicidad, mensajeError, mensajePublico } from "@/lib/db/errores";
import { registrarDiagnostico } from "@/lib/db/diagnostico";
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
  const sesion = leerTokenSesion((await cookies()).get(COOKIE_SESION)?.value);
  if (!sesion) return null;
  const usuario = await obtenerUsuario(sesion.usuarioId);
  // Sesión revocada (cambio de contraseña, usuario desactivado o "cerrar todas las sesiones").
  if (!usuario || !usuario.activo || usuario.sesionVersion !== sesion.version) return null;
  return usuario;
}

/**
 * Usuario logueado y activo; si se pasa `permitido`, además valida su rol.
 * Mientras tenga que cambiar la contraseña solo puede usar lo mínimo
 * (`permitirSinCambiarPassword`): ver su sesión y cambiarla.
 */
export async function requerirUsuario(
  permitido?: (u: Usuario) => boolean,
  opciones: { permitirSinCambiarPassword?: boolean } = {},
): Promise<Usuario> {
  const usuario = await usuarioActual();
  if (!usuario) throw new ErrorApi(401, "Tu sesión expiró. Volvé a iniciar sesión.");
  if (usuario.debeCambiarPassword && !opciones.permitirSinCambiarPassword) {
    throw new ErrorApi(403, "Antes de seguir tenés que cambiar tu contraseña (Mi cuenta).");
  }
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
  // Tope de un INTEGER de Postgres: un número más grande no puede existir.
  if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) throw new ErrorApi(400, "Id inválido.");
  return id;
}

export function respuestaError(error: unknown, contexto: string, mensajesUnicidad: Record<string, string> = {}) {
  if (error instanceof ErrorApi) {
    // Los rechazos esperables (datos inválidos, sin permiso…) también quedan en
    // el diagnóstico: sirven para entender por qué "no se guardó". La sesión
    // vencida (401) no, porque es lo normal al pasar un rato sin usar la app.
    if (error.status !== 401) {
      after(() => registrarDiagnostico({ tipo: `rechazo_${error.status}`, mensaje: error.message, ruta: contexto }));
    }
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  for (const [constraint, mensaje] of Object.entries(mensajesUnicidad)) {
    if (esViolacionUnicidad(error, constraint)) return NextResponse.json({ error: mensaje }, { status: 409 });
  }
  console.error(`Error ${contexto}:`, error);
  const detalle = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error);
  after(() => registrarDiagnostico({ tipo: "error_servidor", mensaje: mensajeError(error), detalle, ruta: contexto }));
  // Al navegador nunca le llega el error crudo (nombres de tablas, SQL,
  // rutas del servidor): queda completo en Diagnóstico.
  return NextResponse.json({ error: mensajePublico(error) }, { status: 500 });
}

/** Campos de texto opcionales: undefined → "", recortados. */
export const textoOpcional = z.string().trim().max(5000).optional().default("");
/** ISO o null (las pantallas mandan ISO ya convertido desde hora Argentina). */
export const fechaOpcional = z.iso.datetime({ offset: true }).nullable().optional().default(null);
