import nodemailer from "nodemailer";

/**
 * Misma cuenta de Gmail por SMTP que el panel interno (contraseña de
 * aplicación de Google) — no hace falta darse de alta en otro servicio.
 */
export function emailConfigurado(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_APP_PASSWORD);
}

export async function enviarEmail(destinatarios: string[], asunto: string, html: string): Promise<void> {
  if (!emailConfigurado()) throw new Error("Faltan las variables de entorno SMTP_USER / SMTP_APP_PASSWORD.");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_APP_PASSWORD },
  });
  await transporter.sendMail({
    from: `MedicalSim Eventos <${process.env.SMTP_USER}>`,
    // Cada destinatario en copia oculta: no se exponen los mails entre sí.
    to: process.env.SMTP_USER,
    bcc: destinatarios,
    subject: asunto,
    html,
  });
}
