import { db } from "./client";

export interface Configuracion {
  /** Cuántos minutos antes de cada horario se manda el aviso previo. */
  minutosAvisoPrevio: number;
  /** Mails extra que reciben todas las alertas de incumplimiento (separados por coma). */
  emailsNotificacion: string;
}

const POR_DEFECTO: Configuracion = { minutosAvisoPrevio: 60, emailsNotificacion: "" };

export async function obtenerConfiguracion(): Promise<Configuracion> {
  const sql = await db();
  const rows = await sql`SELECT clave, valor FROM configuracion WHERE clave IN ('minutos_aviso_previo', 'emails_notificacion')`;
  const valores = Object.fromEntries(rows.map((r) => [r.clave, r.valor as string]));
  const minutos = Number(valores.minutos_aviso_previo);
  return {
    minutosAvisoPrevio: Number.isFinite(minutos) && minutos >= 0 ? minutos : POR_DEFECTO.minutosAvisoPrevio,
    emailsNotificacion: valores.emails_notificacion ?? POR_DEFECTO.emailsNotificacion,
  };
}

export async function guardarConfiguracion(config: Configuracion): Promise<void> {
  const sql = await db();
  await sql`
    INSERT INTO configuracion (clave, valor) VALUES
      ('minutos_aviso_previo', ${String(config.minutosAvisoPrevio)}),
      ('emails_notificacion', ${config.emailsNotificacion})
    ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor
  `;
}
