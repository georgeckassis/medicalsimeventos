"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MensajeError from "@/components/MensajeError";
import Alumnos from "@/components/evento/Alumnos";
import Checklist from "@/components/evento/Checklist";
import Historial from "@/components/evento/Historial";
import ListaObjetos from "@/components/evento/ListaObjetos";
import PanelLogistica from "@/components/evento/PanelLogistica";
import Validaciones from "@/components/evento/Validaciones";
import { useSesion } from "@/components/Sesion";
import { mensajeDe, pedir } from "@/lib/cliente";
import { COLOR_ESTADO } from "@/lib/estilos";
import { formatoFechaHora } from "@/lib/fechas";
import { NOMBRE_ESTADO_EVENTO, type DetalleEvento } from "@/lib/db/types";

const PESTANAS = [
  { id: "resumen", label: "Resumen" },
  { id: "objetos", label: "Objetos" },
  { id: "checklist", label: "Checklist de carga" },
  { id: "alumnos", label: "Alumnos" },
  { id: "validacion", label: "Validación" },
  { id: "historial", label: "Historial" },
] as const;
type Pestana = (typeof PESTANAS)[number]["id"];

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-zinc-500">{titulo}</div>
      <div className="text-sm">{children || "—"}</div>
    </div>
  );
}

function PantallaEvento({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { recargar: recargarSesion } = useSesion();
  const [detalle, setDetalle] = useState<DetalleEvento | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const pestanaUrl = searchParams.get("tab") as Pestana | null;
  const pestana: Pestana = PESTANAS.some((p) => p.id === pestanaUrl) ? pestanaUrl! : "resumen";

  const cargar = useCallback(async () => {
    try {
      setDetalle(await pedir<DetalleEvento>(`/api/eventos/${id}`));
      setError(null);
    } catch (err) {
      setError(mensajeDe(err));
    }
  }, [id]);

  const alCambiar = useCallback(() => {
    setVersion((v) => v + 1);
    cargar();
    // El motor de alertas corre después de cada cambio; refrescar el contador un toque después.
    setTimeout(() => {
      cargar();
      recargarSesion();
    }, 2500);
  }, [cargar, recargarSesion]);

  useEffect(() => {
    // Carga inicial de datos al montar la página — patrón estándar de fetch-on-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // Todos ven el checklist en vivo mientras se va tildando.
    const intervalo = setInterval(cargar, 30_000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  if (error && !detalle) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <MensajeError mensaje={error} onReintentar={cargar} />
      </div>
    );
  }
  if (!detalle) return <div className="px-6 py-10 text-sm text-zinc-400">Cargando…</div>;

  const { evento, alertas, permisos } = detalle;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href="/calendario" className="text-sm text-brand-navy hover:underline">
        ← Calendario
      </Link>
      <div className="mt-2 mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy-dark dark:text-brand-cyan">{evento.nombre}</h1>
          <p className="text-sm text-zinc-500">
            {formatoFechaHora(evento.inicio)} → {formatoFechaHora(evento.fin)}
            {evento.institucionNombre && ` · ${evento.institucionNombre}`}
            {evento.sede && ` · ${evento.sede}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded border px-2 py-1 text-xs font-semibold ${COLOR_ESTADO[evento.estado]}`}>
            {NOMBRE_ESTADO_EVENTO[evento.estado]}
          </span>
          {permisos.editarEvento && (
            <>
              <Link href={`/eventos/${evento.id}/editar`} className="boton-secundario">
                Editar
              </Link>
              <button
                type="button"
                className="boton-peligro"
                onClick={async () => {
                  if (!confirm(`¿Eliminar "${evento.nombre}"? Se borra todo: lista, checklist, firmas y alumnos.`)) return;
                  try {
                    await pedir(`/api/eventos/${evento.id}`, { method: "DELETE" });
                    router.push("/calendario");
                  } catch (err) {
                    setError(mensajeDe(err));
                  }
                }}
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {alertas.map((a) => (
            <div
              key={a.id}
              className={`rounded-md border px-3 py-2 text-sm ${
                a.severidad === "incumplimiento"
                  ? "border-red-300 bg-red-50 font-semibold text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                  : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
              }`}
            >
              {a.severidad === "incumplimiento" ? "⚠️ " : "🔔 "}
              {a.mensaje}
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="mb-4">
          <MensajeError mensaje={error} />
        </div>
      )}

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => router.replace(`/eventos/${evento.id}?tab=${p.id}`, { scroll: false })}
            className={`border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${
              pestana === p.id ? "border-brand-navy text-brand-navy" : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {p.label}
            {p.id === "objetos" && ` (${detalle.items.length})`}
            {p.id === "alumnos" && ` (${evento.alumnosInscriptos})`}
          </button>
        ))}
      </div>

      {pestana === "resumen" && (
        <div className="flex flex-col gap-5">
          <section className="tarjeta grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Dato titulo="Tipo de capacitación">{evento.tipoCapacitacion}</Dato>
            <Dato titulo="Alumnos previstos">
              {evento.cantidadAlumnos} <span className="text-zinc-500">({evento.alumnosInscriptos} inscriptos)</span>
            </Dato>
            <Dato titulo="Instructor a cargo">{evento.instructorNombre}</Dato>
            <Dato titulo="Otros instructores / ayudantes">{evento.instructores}</Dato>
            <Dato titulo="Institución">{evento.institucionNombre}</Dato>
            <Dato titulo="Representante de ventas">{evento.vendedorNombre}</Dato>
            <Dato titulo="Sede">{evento.sede}</Dato>
            <Dato titulo="Dirección">{evento.direccion}</Dato>
            <Dato titulo="Armado">{formatoFechaHora(evento.armadoEn)}</Dato>
            <Dato titulo="Desarmado">{formatoFechaHora(evento.desarmadoEn)}</Dato>
            {evento.observaciones && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Dato titulo="Observaciones">
                  <span className="whitespace-pre-wrap">{evento.observaciones}</span>
                </Dato>
              </div>
            )}
          </section>
          <PanelLogistica key={`log-${version}`} detalle={detalle} onCambio={alCambiar} />
        </div>
      )}
      {pestana === "objetos" && <ListaObjetos detalle={detalle} onCambio={alCambiar} />}
      {pestana === "checklist" && <Checklist detalle={detalle} onCambio={alCambiar} />}
      {pestana === "alumnos" && <Alumnos detalle={detalle} />}
      {pestana === "validacion" && <Validaciones detalle={detalle} onCambio={alCambiar} />}
      {pestana === "historial" && <Historial eventoId={evento.id} version={version} />}
    </div>
  );
}

export default function EventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <PantallaEvento id={id} />
    </Suspense>
  );
}
