import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requerirUsuario, respuestaError } from "@/lib/api";
import { esGestor } from "@/lib/auth/permisos";
import { db } from "@/lib/db/client";
import { mensajeError } from "@/lib/db/errores";
import { emailConfigurado } from "@/lib/notificaciones/email";

class Deshacer extends Error {}

/**
 * Prueba de punta a punta del guardado, del lado del servidor: conecta a la
 * base, crea un evento de prueba con su historial, lo vuelve a leer y deshace
 * todo (no queda nada guardado). Dice en qué paso falla y cuánto tarda cada uno.
 */
export async function POST() {
  try {
    const usuario = await requerirUsuario((u) => esGestor(u.rol));
    const pasos: Array<{ paso: string; ok: boolean; ms: number; detalle?: string }> = [];
    const medir = async (paso: string, fn: () => Promise<string | void>) => {
      const t = Date.now();
      try {
        const detalle = await fn();
        pasos.push({ paso, ok: true, ms: Date.now() - t, ...(detalle ? { detalle } : {}) });
        return true;
      } catch (error) {
        if (error instanceof Deshacer) throw error;
        pasos.push({ paso, ok: false, ms: Date.now() - t, detalle: mensajeError(error) + (error instanceof Error ? ` (${error.message})` : "") });
        return false;
      }
    };

    const sql = await db();
    await medir("Conexión con la base", async () => {
      const [{ ahora }] = await sql`SELECT now() AS ahora`;
      return `hora de la base: ${new Date(ahora).toISOString()}`;
    });

    await sql
      .begin(async (tx) => {
        let id = 0;
        const creado = await medir("Crear evento de prueba (31/10)", async () => {
          const rows = await tx`
            INSERT INTO eventos (nombre, inicio, fin, token_inscripcion, creado_por, estado)
            VALUES ('Prueba de diagnóstico', '2026-10-31T12:00:00Z', '2026-10-31T21:00:00Z', ${randomBytes(12).toString("base64url")},
              ${usuario.id}, 'planificado')
            RETURNING id
          `;
          id = rows[0].id;
          return `id ${id}`;
        });
        if (creado) {
          await medir("Registrar historial", async () => {
            await tx`INSERT INTO historial (evento_id, usuario_id, accion) VALUES (${id}, ${usuario.id}, 'Prueba de diagnóstico')`;
          });
          await medir("Leer el evento del calendario", async () => {
            const rows = await tx`SELECT count(*) AS n FROM eventos WHERE id = ${id} AND inicio >= '2026-10-01' AND inicio < '2026-11-01'`;
            if (Number(rows[0].n) !== 1) throw new Error("No aparece en octubre");
          });
        }
        throw new Deshacer(); // nunca queda guardado
      })
      .catch((error) => {
        if (!(error instanceof Deshacer)) pasos.push({ paso: "Transacción", ok: false, ms: 0, detalle: mensajeError(error) });
      });

    return NextResponse.json({
      pasos,
      servidor: {
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
        region: process.env.VERCEL_REGION ?? "—",
        mail: emailConfigurado() ? "configurado" : "sin configurar",
      },
    });
  } catch (error) {
    return respuestaError(error, "probando el guardado");
  }
}
