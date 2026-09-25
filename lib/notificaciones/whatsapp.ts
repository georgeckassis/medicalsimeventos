/**
 * WhatsApp Cloud API (Meta). Queda listo para activar: cuando tengan la
 * cuenta de WhatsApp Business aprobada, se cargan WHATSAPP_TOKEN,
 * WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_TEMPLATE en las variables de entorno y
 * los mensajes empiezan a salir solos, sin tocar código.
 *
 * Meta solo deja iniciar conversaciones con plantillas aprobadas: la
 * plantilla (WHATSAPP_TEMPLATE) tiene que tener un único parámetro {{1}} en
 * el cuerpo, donde va el texto de la alerta.
 */
export function whatsappConfigurado(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE);
}

/** "11 5555-1234" / "+54 9 11 5555 1234" → "5491155551234" (formato internacional sin +). */
export function normalizarTelefono(telefono: string): string | null {
  let digitos = telefono.replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (!digitos.startsWith("54")) digitos = `54${digitos}`;
  // Celulares argentinos en WhatsApp llevan el 9 después del 54.
  if (!digitos.startsWith("549")) digitos = `549${digitos.slice(2)}`;
  return digitos.length >= 12 ? digitos : null;
}

export async function enviarWhatsapp(telefono: string, texto: string): Promise<void> {
  const numero = normalizarTelefono(telefono);
  if (!numero) throw new Error(`Teléfono inválido: ${telefono}`);
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: numero,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE,
        language: { code: process.env.WHATSAPP_TEMPLATE_IDIOMA || "es_AR" },
        components: [{ type: "body", parameters: [{ type: "text", text: texto.slice(0, 1000) }] }],
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
