"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CampoFechaHora from "@/components/CampoFechaHora";
import MensajeError from "@/components/MensajeError";
import { mensajeDe, pedir } from "@/lib/cliente";
import { reportar } from "@/lib/diagnostico";
import { isoALocal, localAIso } from "@/lib/fechas";
import { ESTADOS_EVENTO, NOMBRE_ESTADO_EVENTO, type EstadoEvento, type Evento, type Institucion, type Usuario } from "@/lib/db/types";

interface Campos {
  nombre: string;
  tipoCapacitacion: string;
  inicio: string;
  fin: string;
  sede: string;
  direccion: string;
  institucionId: string;
  instructorId: string;
  vendedorId: string;
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
    instructorId: e?.instructorId ? String(e.instructorId) : "",
    vendedorId: e?.vendedorId ? String(e.vendedorId) : "",
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
  const [instructores, setInstructores] = useState<Usuario[]>([]);
  const [vendedores, setVendedores] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const errorRef = useRef<HTMLDivElement | null>(null);

  function mostrarError(mensaje: string) {
    setError(mensaje);
    reportar("guardado_evento", `No se guardó: ${mensaje}`, `inicio=${campos.inicio} fin=${campos.fin}`);
    // En el celular el mensaje puede quedar fuera de pantalla: se lo acerca.
    setTimeout(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  /** Al elegir el inicio, el fin se completa solo el mismo día (si estaba vacío o quedaba antes del inicio). */
  function cambiarInicio(inicio: string) {
    setCampos((c) => {
      const finPropuesto = inicio ? `${inicio.slice(0, 10)}T${inicio.slice(11) < "18:00" ? "18:00" : inicio.slice(11)}` : "";
      const fin = !c.fin || (inicio && c.fin < inicio) ? finPropuesto : c.fin;
      return { ...c, inicio, fin };
    });
  }

  useEffect(() => {
    pedir<Institucion[]>("/api/instituciones").then(setInstituciones).catch((e) => setError(mensajeDe(e)));
    pedir<Usuario[]>("/api/usuarios?rol=instructor")
      .then((u) => setInstructores(u.filter((r) => r.activo)))
      .catch((e) => setError(mensajeDe(e)));
    pedir<Usuario[]>("/api/usuarios?rol=vendedor")
      .then((u) => setVendedores(u.filter((r) => r.activo)))
      .catch((e) => setError(mensajeDe(e)));
  }, []);

  const set = (clave: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setCampos((c) => ({ ...c, [clave]: e.target.value }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    reportar("guardado_evento", evento ? "Intento de guardar cambios" : "Intento de crear evento", `inicio=${campos.inicio} fin=${campos.fin}`);
    // Validación propia (form noValidate) para que el aviso se vea siempre,
    // en vez del globito del navegador que en el celular pasa desapercibido.
    if (!campos.nombre.trim()) return mostrarError("Falta el nombre del curso.");
    if (!campos.inicio) return mostrarError("Falta el día de inicio del curso.");
    if (!campos.fin) return mostrarError("Falta el día de fin del curso.");
    if (campos.fin < campos.inicio) return mostrarError("El fin no puede ser anterior al inicio.");
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
        instructorId: campos.instructorId ? Number(campos.instructorId) : null,
        vendedorId: campos.vendedorId ? Number(campos.vendedorId) : null,
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
      mostrarError(mensajeDe(err));
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-5">
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
          <CampoFechaHora valor={campos.inicio} onCambio={cambiarInicio} />
        </div>
        <div>
          <label className="etiqueta">Fin * (puede ser otro día)</label>
          <CampoFechaHora valor={campos.fin} onCambio={(fin) => setCampos((c) => ({ ...c, fin }))} horaPorDefecto="18:00" />
        </div>
        <div>
          <label className="etiqueta">Cantidad de alumnos</label>
          <input className="campo" type="number" min={0} value={campos.cantidadAlumnos} onChange={set("cantidadAlumnos")} />
        </div>
      </section>

      <section className="tarjeta grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">A cargo por MedicalSim</h2>
        <div>
          <label className="etiqueta">Instructor a cargo</label>
          <select className="campo" value={campos.instructorId} onChange={set("instructorId")}>
            <option value="">— Sin asignar —</option>
            {instructores.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiqueta">Representante de ventas</label>
          <select className="campo" value={campos.vendedorId} onChange={set("vendedorId")}>
            <option value="">— Sin asignar —</option>
            {vendedores.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">Se completa con el que atiende la institución; se puede cambiar.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="etiqueta">Otros instructores / ayudantes</label>
          <input className="campo" value={campos.instructores} onChange={set("instructores")} placeholder="Nombres separados por coma (opcional)" />
        </div>
        <p className="text-xs text-zinc-500 sm:col-span-2">
          El instructor y el representante de ventas ven el evento y reciben los avisos de incumplimiento. Se dan de alta en Usuarios.
        </p>
      </section>

      <section className="tarjeta grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">Lugar</h2>
        <div>
          <label className="etiqueta">Institución / cliente</label>
          <select
            className="campo"
            value={campos.institucionId}
            onChange={(e) => {
              const institucion = instituciones.find((i) => String(i.id) === e.target.value);
              // Se propone el representante de ventas que atiende esa institución (se puede cambiar).
              setCampos((c) => ({
                ...c,
                institucionId: e.target.value,
                vendedorId: institucion?.vendedorId ? String(institucion.vendedorId) : c.vendedorId,
              }));
            }}
          >
            <option value="">— Sin institución —</option>
            {instituciones.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">El representante de la institución (ej. el jefe médico) ve todos sus eventos.</p>
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
          <CampoFechaHora valor={campos.armadoEn} onCambio={(armadoEn) => setCampos((c) => ({ ...c, armadoEn }))} horaPorDefecto="08:00" opcional />
          <p className="mt-1 text-xs text-zinc-500">A esta hora las cosas tienen que estar descargadas en la sede.</p>
        </div>
        <div>
          <label className="etiqueta">Horario de desarmado</label>
          <CampoFechaHora valor={campos.desarmadoEn} onCambio={(desarmadoEn) => setCampos((c) => ({ ...c, desarmadoEn }))} horaPorDefecto="18:00" opcional />
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

      <div ref={errorRef}>{error && <MensajeError mensaje={error} />}</div>
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
