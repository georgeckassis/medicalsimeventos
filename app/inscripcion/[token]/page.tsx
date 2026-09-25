"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { mensajeDe, pedir } from "@/lib/cliente";
import { formatoFechaHora } from "@/lib/fechas";

interface EventoPublico {
  nombre: string;
  inicio: string;
  fin: string;
  sede: string;
  institucionNombre: string | null;
  abierto: boolean;
}

const CAMPOS = [
  { clave: "nombre", etiqueta: "Nombre", requerido: true, tipo: "text", auto: "given-name" },
  { clave: "apellido", etiqueta: "Apellido", requerido: true, tipo: "text", auto: "family-name" },
  { clave: "dni", etiqueta: "DNI", requerido: true, tipo: "text", auto: "off" },
  { clave: "email", etiqueta: "Mail", requerido: true, tipo: "email", auto: "email" },
  { clave: "telefono", etiqueta: "Teléfono", requerido: false, tipo: "tel", auto: "tel" },
  { clave: "institucion", etiqueta: "Institución donde trabajás / estudiás", requerido: false, tipo: "text", auto: "organization" },
  { clave: "especialidad", etiqueta: "Especialidad", requerido: false, tipo: "text", auto: "off" },
] as const;

type Clave = (typeof CAMPOS)[number]["clave"];

/** Formulario público que abre el alumno al escanear el QR del evento (no necesita usuario). */
export default function InscripcionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [evento, setEvento] = useState<EventoPublico | null>(null);
  const [valores, setValores] = useState<Record<Clave, string>>({
    nombre: "",
    apellido: "",
    dni: "",
    email: "",
    telefono: "",
    institucion: "",
    especialidad: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    pedir<EventoPublico>(`/api/inscripcion/${token}`)
      .then(setEvento)
      .catch((e) => setError(mensajeDe(e)));
  }, [token]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await pedir<{ nombre: string }>(`/api/inscripcion/${token}`, { method: "POST", body: valores });
      setListo(r.nombre);
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
      <Image src="/logo.png" alt="MedicalSim" width={148} height={33} className="mx-auto mb-6 h-8 w-auto" />
      {evento && (
        <div className="mb-5 text-center">
          <h1 className="text-xl font-bold text-brand-navy-dark">{evento.nombre}</h1>
          <p className="text-sm text-zinc-500">
            {formatoFechaHora(evento.inicio)}
            {evento.sede && ` · ${evento.sede}`}
            {evento.institucionNombre && ` · ${evento.institucionNombre}`}
          </p>
        </div>
      )}
      {listo ? (
        <div className="tarjeta p-6 text-center">
          <p className="text-4xl">✅</p>
          <p className="mt-2 text-lg font-bold">¡Listo, {listo}!</p>
          <p className="text-sm text-zinc-500">Tu inscripción quedó registrada.</p>
        </div>
      ) : evento && !evento.abierto ? (
        <div className="tarjeta p-6 text-center text-sm">La inscripción a este evento está cerrada.</div>
      ) : (
        evento && (
          <form onSubmit={enviar} className="tarjeta flex flex-col gap-3 p-5">
            {CAMPOS.map((c) => (
              <div key={c.clave}>
                <label className="etiqueta">
                  {c.etiqueta}
                  {c.requerido && " *"}
                </label>
                <input
                  className="campo text-base"
                  type={c.tipo}
                  inputMode={c.clave === "dni" ? "numeric" : undefined}
                  autoComplete={c.auto}
                  required={c.requerido}
                  value={valores[c.clave]}
                  onChange={(e) => setValores((v) => ({ ...v, [c.clave]: e.target.value }))}
                />
              </div>
            ))}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="boton mt-2 py-3 text-base" disabled={enviando}>
              {enviando ? "Enviando…" : "Inscribirme"}
            </button>
          </form>
        )
      )}
      {!evento && error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
