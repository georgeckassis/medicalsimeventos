"use client";

import { useEffect, useState } from "react";
import Encabezado from "@/components/Encabezado";
import MensajeError from "@/components/MensajeError";
import { mensajeDe, pedir } from "@/lib/cliente";

interface Config {
  minutosAvisoPrevio: number;
  emailsNotificacion: string;
  emailConfigurado: boolean;
  whatsappConfigurado: boolean;
}

function Estado({ ok, si, no }: { ok: boolean; si: string; no: string }) {
  return (
    <p className={`text-sm ${ok ? "text-emerald-700" : "text-amber-700"}`}>
      {ok ? "✔" : "⚠️"} {ok ? si : no}
    </p>
  );
}

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    pedir<Config>("/api/configuracion")
      .then(setConfig)
      .catch((e) => setError(mensajeDe(e)));
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setError(null);
    setGuardado(false);
    try {
      await pedir("/api/configuracion", {
        method: "PUT",
        body: { minutosAvisoPrevio: Number(config.minutosAvisoPrevio) || 0, emailsNotificacion: config.emailsNotificacion },
      });
      setGuardado(true);
    } catch (err) {
      setError(mensajeDe(err));
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Encabezado titulo="Configuración de alertas" />
      {error && <MensajeError mensaje={error} />}
      {config && (
        <form onSubmit={guardar} className="flex flex-col gap-5">
          <section className="tarjeta grid gap-4 p-5">
            <div>
              <label className="etiqueta">Minutos de aviso previo</label>
              <input
                className="campo w-32"
                type="number"
                min={0}
                value={config.minutosAvisoPrevio}
                onChange={(e) => setConfig({ ...config, minutosAvisoPrevio: Number(e.target.value) })}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Cuánto antes de cada horario (carga, descarga, retiro, devolución, vencimiento de tareas) se avisa si todavía falta algo.
              </p>
            </div>
            <div>
              <label className="etiqueta">Mails extra que reciben todos los incumplimientos</label>
              <input
                className="campo"
                value={config.emailsNotificacion}
                onChange={(e) => setConfig({ ...config, emailsNotificacion: e.target.value })}
                placeholder="uno@mail.com, otro@mail.com"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Los incumplimientos ya les llegan a todos los encargados generales y al encargado de logística del evento. Cada evento también
                tiene su propio campo de mails extra.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" className="boton">
                Guardar
              </button>
              {guardado && <span className="text-sm text-emerald-700">Guardado.</span>}
            </div>
          </section>
          <section className="tarjeta grid gap-2 p-5">
            <h2 className="font-bold">Canales de envío</h2>
            <Estado
              ok={config.emailConfigurado}
              si="Mail configurado (SMTP)."
              no="Mail sin configurar: las alertas se ven en la app pero no se mandan por mail. Faltan SMTP_USER y SMTP_APP_PASSWORD."
            />
            <Estado
              ok={config.whatsappConfigurado}
              si="WhatsApp configurado."
              no="WhatsApp preparado pero sin activar: faltan las credenciales de WhatsApp Business (ver README)."
            />
          </section>
        </form>
      )}
    </div>
  );
}
