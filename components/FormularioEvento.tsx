"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MensajeError from "@/components/MensajeError";
import { mensajeDe, pedir } from "@/lib/cliente";
import { isoALocal, localAIso } from "@/lib/fechas";
import { ESTADOS_EVENTO, NOMBRE_ESTADO_EVENTO, type EstadoEvento, type Evento, type Institucion } from "@/lib/db/types";

interface Campos {
  nombre: string;
  tipoCapacitacion: string;
  inicio: string;
  fin: string;
  sede: string;
  direccion: string;
  institucionId: string;
  cantidadAlumnos: string;
  instructores: string;
  estado: EstadoEvento;
  observaciones: string;
  armadoEn: string;
  desarmadoEn: string;
  emailsNotificacion: string;
}

function desdeEvento(e?: Evento): Campos {
  return {
    nombre: e?.nombre ?? "",
    tipoCapacitacion: e?.tipoCapacitacion ?? "",
    inicio: isoALocal(e?.inicio),
    fin: isoALocal(e?.fin),
    sede: e?.sede ?? "",
    direccion: e?.direccion ?? "",
    institucionId: e?.institucionId ? String(e.institucionId) : "",
    cantidadAlumnos: e ? String(e.cantidadAlumnos) : "",
    instructores: e?.instructores ?? "",
    estado: e?.estado ?? "planificado",
    observaciones: e?.observaciones ?? "",
    armadoEn: isoALocal(e?.armadoEn),
    desarmadoEn: isoALocal(e?.desarmadoEn),
    emailsNotificacion: e?.emailsNotificacion ?? "",
  };
}

/** Alta y edición de un evento — solo el encargado general. Las fechas se cargan en hora de Argentina. */
export default function FormularioEvento({ evento }: { evento?: Evento }) {
  const router = useRouter();
  const [campos, setCampos] = useState<Campos>(desdeEvento(evento));
  const [instituciones, setInstituciones] = useState<Institucion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    pedir<Institucion[]>("/api/instituciones").then(setInstituciones).catch((e) => setError(mensajeDe(e)));
  }, []);

  const set = (clave: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setCampos((c) => ({ ...c, [clave]: e.target.value }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = {
        ...campos,
        inicio: localAIso(campos.inicio),
        fin: localAIso(campos.fin),
        armadoEn: localAIso(campos.armadoEn),
        desarmadoEn: localAIso(campos.desarmadoEn),
        institucionId: campos.institucionId ? Number(campos.institucionId) : null,
        cantidadAlumnos: Number(campos.cantidadAlumnos) || 0,
      };
      if (!cuerpo.inicio || !cuerpo.fin) throw new Error("Completá la fecha y hora de inicio y de fin.");
      if (evento) {
        await pedir(`/api/eventos/${evento.id}`, { method: "PUT", body: cuerpo });
        router.push(`/eventos/${evento.id}`);
      } else {
        const { id } = await pedir<{ id: number }>("/api/eventos", { method: "POST", body: cuerpo });
        router.push(`/eventos/${id}?tab=objetos`);
      }
    } catch (err) {
      setError(mensajeDe(err));
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-5">
      <section className="tarjeta grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">Curso</h2>
        <div className="sm:col-span-2">
          <label className="etiqueta">Nombre del curso *</label>
          <input className="campo" required value={campos.nombre} onChange={set("nombre")} />
        </div>
        <div>
          <label className="etiqueta">Tipo de capacitación</label>
          <input className="campo" value={campos.tipoCapacitacion} onChange={set("tipoCapacitacion")} placeholder="Ej: Sutura laparoscópica" />
        </div>
        <div>
          <label className="etiqueta">Estado</label>
          <select className="campo" value={campos.estado} onChange={set("estado")}>
            {ESTADOS_EVENTO.map((e) => (
              <option key={e} value={e}>
                {NOMBRE_ESTADO_EVENTO[e]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiqueta">Inicio *</label>
          <input className="campo" type="datetime-local" required value={campos.inicio} onChange={set("inicio")} />
        </div>
        <div>
          <label className="etiqueta">Fin * (puede ser otro día)</label>
          <input className="campo" type="datetime-local" required value={campos.fin} onChange={set("fin")} />
        </div>
        <div>
          <label className="etiqueta">Cantidad de alumnos</label>
          <input className="campo" type="number" min={0} value={campos.cantidadAlumnos} onChange={set("cantidadAlumnos")} />
        </div>
        <div>
          <label className="etiqueta">Instructores</label>
          <input className="campo" value={campos.instructores} onChange={set("instructores")} placeholder="Nombres separados por coma" />
        </div>
      </section>

      <section className="tarjeta grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">Lugar</h2>
        <div>
          <label className="etiqueta">Institución / cliente</label>
          <select className="campo" value={campos.institucionId} onChange={set("institucionId")}>
            <option value="">— Sin institución —</option>
            {instituciones.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">El representante de esta institución va a ver el evento.</p>
        </div>
        <div>
          <label className="etiqueta">Sede</label>
          <input className="campo" value={campos.sede} onChange={set("sede")} placeholder="Ej: Hospital X — Aula 3" />
        </div>
        <div className="sm:col-span-2">
          <label className="etiqueta">Dirección</label>
          <input className="campo" value={campos.direccion} onChange={set("direccion")} />
        </div>
      </section>

      <section className="tarjeta grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">Armado y desarmado</h2>
        <div>
          <label className="etiqueta">Horario de armado</label>
          <input className="campo" type="datetime-local" value={campos.armadoEn} onChange={set("armadoEn")} />
          <p className="mt-1 text-xs text-zinc-500">A esta hora las cosas tienen que estar descargadas en la sede.</p>
        </div>
        <div>
          <label className="etiqueta">Horario de desarmado</label>
          <input className="campo" type="datetime-local" value={campos.desarmadoEn} onChange={set("desarmadoEn")} />
        </div>
        <p className="text-xs text-zinc-500 sm:col-span-2">
          Los horarios de carga en depósito, salida, retiro y devolución, el chofer y el vehículo los carga el encargado de logística desde la
          pantalla del evento.
        </p>
      </section>

      <section className="tarjeta grid gap-4 p-5">
        <h2 className="font-bold">Otros</h2>
        <div>
          <label className="etiqueta">Observaciones</label>
          <textarea className="campo" rows={3} value={campos.observaciones} onChange={set("observaciones")} />
        </div>
        <div>
          <label className="etiqueta">Mails extra para avisos de incumplimiento de este evento</label>
          <input
            className="campo"
            value={campos.emailsNotificacion}
            onChange={set("emailsNotificacion")}
            placeholder="ejemplo@institucion.com, otro@mail.com"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Además de los encargados general y de logística. Para mails que reciban los avisos de todos los eventos, usá Configuración.
          </p>
        </div>
      </section>

      {error && <MensajeError mensaje={error} />}
      <div className="flex gap-2">
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? "Guardando…" : evento ? "Guardar cambios" : "Crear evento y cargar objetos"}
        </button>
        <button type="button" className="boton-secundario" onClick={() => router.back()}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
