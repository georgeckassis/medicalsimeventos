import { db } from "@/lib/db/client";
import { obtenerConfiguracion } from "@/lib/db/configuracion";
import { contactosNotificacion } from "@/lib/db/usuarios";
import { ETAPAS, NOMBRE_ETAPA, type Etapa, type Rol } from "@/lib/db/types";
import { aIsoONull, formatoFechaHora, formatoHora } from "@/lib/fechas";
import { emailConfigurado, enviarEmail } from "@/lib/notificaciones/email";
import { enviarWhatsapp, whatsappConfigurado } from "@/lib/notificaciones/whatsapp";

/**
 * Motor de alertas: revisa todos los eventos y tareas, y compara contra lo
 * que debería estar hecho a esta hora. Cada condición tiene una "clave"
 * estable, así una misma alerta no se crea (ni se manda por mail) dos veces;
 * cuando la condición deja de cumplirse (se tildó todo, se cerró la etapa,
 * se completó la tarea) la alerta se marca resuelta sola.
 *
 * Se ejecuta:
 *  - cada 5 minutos dentro del propio servidor (instrumentation.ts),
 *  - cada vez que alguien usa la app (con un mínimo de 1 minuto entre revisiones),
 *  - enseguida después de cada tilde / cierre de etapa / cambio de horario.
 */

interface AlertaDeseada {
  clave: string;
  tipo: string;
  severidad: "aviso" | "incumplimiento";
  mensaje: string;
  eventoId: number | null;
  tareaId: number | null;
  destinatarios: { roles: Rol[]; ids: number[]; emailsExtra: string[] };
}

const LOCK_MOTOR = 72_450_002;

function listaEmails(texto: string): string[] {
  return texto
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

function resumirNombres(nombres: string[]): string {
  return nombres.length <= 5 ? nombres.join(", ") : `${nombres.slice(0, 5).join(", ")} y ${nombres.length - 5} más`;
}

async function calcularAlertasDeseadas(ahora: Date): Promise<{ deseadas: AlertaDeseada[]; eventosRevisados: number[]; tareasRevisadas: number[] }> {
  const sql = await db();
  const config = await obtenerConfiguracion();
  const previoMs = config.minutosAvisoPrevio * 60_000;
  const emailsGlobales = listaEmails(config.emailsNotificacion);
  const deseadas: AlertaDeseada[] = [];

  // Eventos "vivos": de 3 días hacia adelante hasta 7 días después de la
  // devolución, más cualquiera que todavía tenga alertas abiertas.
  const eventos = await sql`
    SELECT e.* FROM eventos e
    WHERE e.estado <> 'cancelado' AND (
      (e.inicio < ${ahora}::timestamptz + interval '3 days'
        AND COALESCE(e.devolucion_en, e.desarmado_en, e.fin) > ${ahora}::timestamptz - interval '7 days')
      OR e.id IN (SELECT evento_id FROM alertas WHERE resuelta_en IS NULL AND evento_id IS NOT NULL)
    )
  `;
  const ids = eventos.map((e) => e.id as number);
  const items = ids.length
    ? await sql`
        SELECT ei.id, ei.evento_id, ei.cantidad, inv.nombre,
          COALESCE(json_object_agg(c.etapa, c.cantidad) FILTER (WHERE c.etapa IS NOT NULL), '{}'::json) AS checks
        FROM evento_items ei
        JOIN inventario inv ON inv.id = ei.inventario_id
        LEFT JOIN evento_checks c ON c.evento_item_id = ei.id
        WHERE ei.evento_id = ANY(${ids})
        GROUP BY ei.id, inv.nombre
      `
    : [];
  const cierres = ids.length ? await sql`SELECT evento_id, etapa FROM evento_etapas WHERE evento_id = ANY(${ids})` : [];

  for (const e of eventos) {
    const eventoId = e.id as number;
    const itemsEvento = items.filter((i) => i.evento_id === eventoId);
    const cerradas = new Set(cierres.filter((c) => c.evento_id === eventoId).map((c) => c.etapa as Etapa));
    const logistica = e.logistica_id ? { roles: [] as Rol[], ids: [e.logistica_id as number] } : { roles: ["logistica"] as Rol[], ids: [] };
    const emailsExtra = [...emailsGlobales, ...listaEmails(e.emails_notificacion)];
    const paraIncumplimiento = { roles: ["general", ...logistica.roles] as Rol[], ids: logistica.ids, emailsExtra };
    const paraAviso = { roles: logistica.roles, ids: [...logistica.ids, ...(e.chofer_id ? [e.chofer_id as number] : [])], emailsExtra: [] };

    const horaEtapa: Record<Etapa, string | null> = {
      carga_deposito: aIsoONull(e.carga_deposito_en),
      descarga_sede: aIsoONull(e.armado_en) ?? aIsoONull(e.inicio),
      carga_retiro: aIsoONull(e.retiro_en) ?? aIsoONull(e.desarmado_en),
      devolucion_deposito: aIsoONull(e.devolucion_en),
    };

    for (const etapa of ETAPAS) {
      if (itemsEvento.length === 0) break;
      const faltan = (i: (typeof itemsEvento)[number]) => Number((i.checks as Record<string, number>)[etapa] ?? 0) < Number(i.cantidad);

      if (cerradas.has(etapa)) {
        const conFaltantes = itemsEvento.filter(faltan);
        if (conFaltantes.length) {
          const detalle = conFaltantes.map((i) => `${i.nombre} (${Number((i.checks as Record<string, number>)[etapa] ?? 0)} de ${i.cantidad})`);
          deseadas.push({
            clave: `diferencia:${etapa}:${eventoId}`,
            tipo: "diferencia_etapa",
            severidad: "incumplimiento",
            mensaje: `${e.nombre}: se cerró "${NOMBRE_ETAPA[etapa]}" con objetos faltantes: ${resumirNombres(detalle)}.`,
            eventoId,
            tareaId: null,
            destinatarios: paraIncumplimiento,
          });
        }
        continue;
      }

      const hora = horaEtapa[etapa];
      if (!hora) continue;
      const t = new Date(hora).getTime();
      const pendientes = itemsEvento.filter(faltan).map((i) => i.nombre as string);
      const queFalta = pendientes.length
        ? `faltan tildar ${pendientes.length} objeto(s): ${resumirNombres(pendientes)}`
        : "todo está tildado pero falta cerrar la etapa con foto y firma";

      if (ahora.getTime() >= t) {
        deseadas.push({
          clave: `incumplimiento:${etapa}:${eventoId}:${hora}`,
          tipo: "incumplimiento_etapa",
          severidad: "incumplimiento",
          mensaje: `${e.nombre}: ya pasó la hora de "${NOMBRE_ETAPA[etapa]}" (${formatoFechaHora(hora)}) y ${queFalta}.`,
          eventoId,
          tareaId: null,
          destinatarios: paraIncumplimiento,
        });
      } else if (ahora.getTime() >= t - previoMs) {
        deseadas.push({
          clave: `previo:${etapa}:${eventoId}:${hora}`,
          tipo: "aviso_previo_etapa",
          severidad: "aviso",
          mensaje: `${e.nombre}: "${NOMBRE_ETAPA[etapa]}" está prevista a las ${formatoHora(hora)} y ${queFalta}.`,
          eventoId,
          tareaId: null,
          destinatarios: paraAviso,
        });
      }
    }

    // Logística sin organizar a menos de 48 h del evento.
    const inicio = new Date(e.inicio).getTime();
    if (inicio > ahora.getTime() && inicio - ahora.getTime() <= 48 * 3600_000) {
      const falta = [
        !e.carga_deposito_en && "horario de carga",
        !e.salida_en && "horario de salida",
        !e.chofer_id && "chofer",
        !e.vehiculo_id && "vehículo",
      ].filter(Boolean) as string[];
      if (falta.length) {
        deseadas.push({
          clave: `logistica_incompleta:${eventoId}`,
          tipo: "logistica_incompleta",
          severidad: "aviso",
          mensaje: `${e.nombre} empieza el ${formatoFechaHora(aIsoONull(e.inicio))} y todavía falta cargar: ${falta.join(", ")}.`,
          eventoId,
          tareaId: null,
          destinatarios: { roles: ["general", ...logistica.roles], ids: logistica.ids, emailsExtra: [] },
        });
      }
    }
  }

  const tareas = await sql`
    SELECT t.*, e.nombre AS evento_nombre FROM tareas t LEFT JOIN eventos e ON e.id = t.evento_id
    WHERE t.estado <> 'completada' AND t.vence_en IS NOT NULL AND t.vence_en <= ${ahora}::timestamptz + ${previoMs / 1000} * interval '1 second'
  `;
  for (const t of tareas) {
    const vence = aIsoONull(t.vence_en)!;
    const responsable = t.responsable_id ? [t.responsable_id as number] : [];
    const contexto = t.evento_nombre ? ` (evento ${t.evento_nombre})` : "";
    if (ahora.getTime() >= new Date(vence).getTime()) {
      deseadas.push({
        clave: `tarea_vencida:${t.id}:${vence}`,
        tipo: "tarea_vencida",
        severidad: "incumplimiento",
        mensaje: `Tarea vencida${contexto}: "${t.titulo}" vencía el ${formatoFechaHora(vence)} y sigue ${String(t.estado).replace("_", " ")}.`,
        eventoId: t.evento_id,
        tareaId: t.id,
        destinatarios: { roles: ["general"], ids: responsable, emailsExtra: [] },
      });
    } else {
      deseadas.push({
        clave: `tarea_previo:${t.id}:${vence}`,
        tipo: "aviso_previo_tarea",
        severidad: "aviso",
        mensaje: `La tarea "${t.titulo}"${contexto} vence a las ${formatoHora(vence)}.`,
        eventoId: t.evento_id,
        tareaId: t.id,
        destinatarios: { roles: [], ids: responsable, emailsExtra: [] },
      });
    }
  }

  const todasLasTareas = await sql`SELECT t.id FROM tareas t WHERE EXISTS (SELECT 1 FROM alertas a WHERE a.tarea_id = t.id AND a.resuelta_en IS NULL)`;
  return {
    deseadas,
    eventosRevisados: ids,
    tareasRevisadas: [...new Set([...tareas.map((t) => t.id as number), ...todasLasTareas.map((t) => t.id as number)])],
  };
}

async function notificar(alerta: AlertaDeseada): Promise<string> {
  const contactos = await contactosNotificacion(alerta.destinatarios.roles, alerta.destinatarios.ids);
  const emails = [...new Set([...contactos.map((c) => c.email), ...alerta.destinatarios.emailsExtra])];
  const resultado: string[] = [];

  if (emails.length === 0) {
    resultado.push("Sin destinatarios para avisar por mail.");
  } else if (!emailConfigurado()) {
    resultado.push("Mail no enviado: falta configurar SMTP.");
  } else {
    const url = process.env.APP_URL?.replace(/\/$/, "");
    const enlace = url && alerta.eventoId ? `${url}/eventos/${alerta.eventoId}` : url && alerta.tareaId ? `${url}/tareas` : null;
    const titulo = alerta.severidad === "incumplimiento" ? "⚠️ Incumplimiento" : "Aviso";
    try {
      await enviarEmail(
        emails,
        `${titulo} — ${alerta.mensaje.slice(0, 90)}`,
        `<p style="font-size:15px">${alerta.mensaje.replace(/</g, "&lt;")}</p>
         ${enlace ? `<p><a href="${enlace}">Abrir en MedicalSim Eventos</a></p>` : ""}
         <p style="color:#777;font-size:12px">Mensaje automático de MedicalSim Eventos.</p>`,
      );
      resultado.push(`Mail enviado a ${emails.length} destinatario(s).`);
    } catch (error) {
      console.error("Error enviando mail de alerta:", error);
      resultado.push(`Error al enviar el mail: ${error instanceof Error ? error.message : "desconocido"}.`);
    }
  }

  if (whatsappConfigurado()) {
    const telefonos = [...new Set(contactos.map((c) => c.telefono).filter(Boolean))];
    let enviados = 0;
    for (const tel of telefonos) {
      try {
        await enviarWhatsapp(tel, alerta.mensaje);
        enviados++;
      } catch (error) {
        console.error("Error enviando WhatsApp:", error);
      }
    }
    resultado.push(`WhatsApp enviado a ${enviados} de ${telefonos.length}.`);
  }
  return resultado.join(" ");
}

export async function revisarAlertas(ahora = new Date()): Promise<{ nuevas: number; resueltas: number } | null> {
  const sql = await db();
  const { deseadas, eventosRevisados, tareasRevisadas } = await calcularAlertasDeseadas(ahora);

  const resultado = await sql.begin(async (tx) => {
    // Si otra instancia ya está revisando, esta no hace nada (evita mails duplicados).
    const [{ ok }] = await tx`SELECT pg_try_advisory_xact_lock(${LOCK_MOTOR}) AS ok`;
    if (!ok) return null;

    const nuevas: Array<AlertaDeseada & { id: number }> = [];
    for (const a of deseadas) {
      // Inserta la alerta nueva, o reactiva una que se había resuelto sola
      // (ej. se reabrió una etapa). Las descartadas a mano no vuelven.
      const rows = await tx`
        INSERT INTO alertas (clave, tipo, severidad, mensaje, evento_id, tarea_id)
        VALUES (${a.clave}, ${a.tipo}, ${a.severidad}, ${a.mensaje}, ${a.eventoId}, ${a.tareaId})
        ON CONFLICT (clave) DO UPDATE SET resuelta_en = NULL, mensaje = EXCLUDED.mensaje, creada_en = now()
          WHERE alertas.resuelta_en IS NOT NULL AND NOT alertas.descartada
        RETURNING id
      `;
      if (rows.length) nuevas.push({ ...a, id: rows[0].id });
      else await tx`UPDATE alertas SET mensaje = ${a.mensaje} WHERE clave = ${a.clave} AND resuelta_en IS NULL`;
    }

    const claves = deseadas.map((a) => a.clave);
    const resueltas = await tx`
      UPDATE alertas SET resuelta_en = now()
      WHERE resuelta_en IS NULL AND clave <> ALL(${claves})
        AND ((evento_id = ANY(${eventosRevisados}) AND tarea_id IS NULL) OR tarea_id = ANY(${tareasRevisadas})
             OR (evento_id IS NULL AND tarea_id IS NULL))
      RETURNING id
    `;
    return { nuevas, resueltas: resueltas.length };
  });
  if (!resultado) return null;

  for (const alerta of resultado.nuevas) {
    const notificacion = await notificar(alerta);
    await sql`UPDATE alertas SET notificacion = ${notificacion} WHERE id = ${alerta.id}`;
  }
  return { nuevas: resultado.nuevas.length, resueltas: resultado.resueltas };
}

let ultimaRevision = 0;
let enCurso: Promise<unknown> | null = null;

/** Revisión "de paso" (cada vez que alguien usa la app): como mucho una por minuto por instancia. */
export async function revisarAlertasSiCorresponde(forzar = false): Promise<void> {
  if (enCurso) {
    if (!forzar) return;
    // Un cambio recién hecho (ej. un tilde) tiene que verse en la próxima revisión.
    await enCurso;
    // Otra revisión pudo haber arrancado mientras esperábamos.
    if ((enCurso as Promise<unknown> | null) !== null) return;
  }
  if (!forzar && Date.now() - ultimaRevision < 60_000) return;
  ultimaRevision = Date.now();
  enCurso = revisarAlertas()
    .catch((error) => console.error("Error revisando alertas:", error))
    .finally(() => {
      enCurso = null;
    });
  await enCurso;
}
