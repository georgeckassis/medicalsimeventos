/**
 * Reloj interno de las alertas: cuando la app corre como servidor Node
 * permanente (`npm start`, un VPS, Railway, Render…), revisa cada 5 minutos
 * si hay algo sin cumplir y manda los avisos, aunque nadie tenga la app
 * abierta. En Vercel las funciones se apagan entre pedidos, así que ahí la
 * revisión corre cada vez que alguien usa la app y, si el plan lo permite,
 * con el cron de vercel.json (ver README).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL || process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return;
  const { revisarAlertasSiCorresponde } = await import("./lib/alertas/motor");
  const CINCO_MINUTOS = 5 * 60_000;
  setInterval(() => void revisarAlertasSiCorresponde(true), CINCO_MINUTOS);
  setTimeout(() => void revisarAlertasSiCorresponde(true), 15_000);
}
