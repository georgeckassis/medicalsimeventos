"use client";

import { useState } from "react";
import Link from "next/link";
import Encabezado from "@/components/Encabezado";
import {
  guardarConfiguracion,
  leerConfiguracion,
  nombreTecla,
  type Configuracion,
  type Rotacion,
} from "@/lib/simulador/configuracion";
import { EJERCICIOS, buscarEjercicio } from "@/lib/simulador/ejercicios/catalogo";
import { leerHistorial } from "@/lib/simulador/historial";
import { listarCamaras } from "@/lib/simulador/tracking/webcam";

/** Se monta solo en el navegador (sin SSR): puede leer el almacenamiento local directo. */
export default function MenuSimulador() {
  const [config, setConfig] = useState<Configuracion>(leerConfiguracion);
  const [historial] = useState(leerHistorial);
  const [camaras, setCamaras] = useState<MediaDeviceInfo[]>([]);
  const [errorCamaras, setErrorCamaras] = useState<string | null>(null);

  function cambiar(parcial: Partial<Configuracion>) {
    const nueva = { ...config, ...parcial };
    setConfig(nueva);
    guardarConfiguracion(nueva);
  }

  async function detectarCamaras() {
    setErrorCamaras(null);
    try {
      // Sin un permiso previo el navegador no da los nombres de las cámaras.
      const flujo = await navigator.mediaDevices.getUserMedia({ video: true });
      for (const pista of flujo.getTracks()) pista.stop();
      setCamaras(await listarCamaras());
    } catch {
      setErrorCamaras("No se pudo acceder a la cámara. Revisá el permiso en el candado de la barra de direcciones.");
    }
  }

  const calibracion = config.calibracion;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Encabezado
        titulo="Simulador de cirugía robótica"
        descripcion="Práctica de los movimientos de la consola con la cámara de la PC. Versión inicial (MVP)."
      />

      <section className="tarjeta mb-5 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-bold">1. Calibración</h2>
          <p className="text-sm text-zinc-500">
            {calibracion
              ? `Calibrado el ${new Date(calibracion.fecha).toLocaleString("es-AR")}. Repetila si cambia la cámara, la luz o la persona.`
              : "Todavía no se calibró en esta PC. Hacela antes del primer ejercicio."}
          </p>
        </div>
        <Link href="/simulador/calibracion" className={calibracion ? "boton-secundario" : "boton"}>
          {calibracion ? "Volver a calibrar" : "Calibrar"}
        </Link>
      </section>

      <h2 className="mb-3 font-bold">2. Ejercicios</h2>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {EJERCICIOS.map((e) => (
          <Link key={e.id} href={`/simulador/${e.id}`} className="tarjeta tarjeta-interactiva flex flex-col gap-1 p-5">
            <span className="font-bold text-brand-navy-dark dark:text-brand-cyan">{e.nombre}</span>
            <span className="text-sm">{e.descripcion}</span>
            <span className="mt-auto pt-2 text-xs text-zinc-500">{e.habilidades}</span>
          </Link>
        ))}
      </div>

      <section className="tarjeta mb-6 p-5">
        <h2 className="mb-1 font-bold">Cómo se usa</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>La cámara apunta a las manos desde arriba. Las manos quedan en el aire, como sosteniendo los controles de la consola.</li>
          <li>Mover la mano mueve la punta de la pinza; girar la muñeca la orienta; juntar pulgar e índice cierra la pinza.</li>
          <li>
            <b>Clutch</b> ({config.teclasClutch.map(nombreTecla).join(" o ")}): mientras está pisado las pinzas quedan quietas y
            podés reubicar las manos.
          </li>
          <li>
            <b>Cámara</b> ({config.teclasCamara.map(nombreTecla).join(" o ")}): mientras está pisado, mover las manos mueve la vista.
          </li>
          <li>La línea vertical bajo cada punta y las sombras ayudan a calcular la profundidad.</li>
        </ul>
      </section>

      <section className="tarjeta mb-6 p-5">
        <h2 className="mb-3 font-bold">Configuración de este puesto</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiqueta">Cámara</label>
            {camaras.length > 0 ? (
              <select className="campo" value={config.camaraId} onChange={(e) => cambiar({ camaraId: e.target.value })}>
                <option value="">Predeterminada</option>
                {camaras.map((c, i) => (
                  <option key={c.deviceId} value={c.deviceId}>
                    {c.label || `Cámara ${i + 1}`}
                  </option>
                ))}
              </select>
            ) : (
              <button type="button" className="boton-secundario" onClick={detectarCamaras}>
                Elegir cámara
              </button>
            )}
            {errorCamaras && <p className="mt-1 text-xs text-red-600">{errorCamaras}</p>}
          </div>
          <div>
            <label className="etiqueta">Ubicación de la cámara</label>
            <select
              className="campo"
              value={config.rotacion}
              onChange={(e) => cambiar({ rotacion: Number(e.target.value) as Rotacion })}
            >
              <option value={0}>Arriba de las manos, con el borde superior hacia el monitor</option>
              <option value={180}>En el monitor, inclinada hacia el escritorio</option>
              <option value={90}>Girada 90° (a la derecha)</option>
              <option value={270}>Girada 90° (a la izquierda)</option>
            </select>
          </div>
          <div>
            <label className="etiqueta">Escala de movimiento</label>
            <select className="campo" value={config.escala} onChange={(e) => cambiar({ escala: Number(e.target.value) })}>
              <option value={1.5}>1,5 : 1 (rápida)</option>
              <option value={2}>2 : 1</option>
              <option value={3}>3 : 1 (fina)</option>
              <option value={4}>4 : 1</option>
            </select>
          </div>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.espejar} onChange={(e) => cambiar({ espejar: e.target.checked })} />
              La cámara entrega la imagen espejada
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.ayudaProfundidad}
                onChange={(e) => cambiar({ ayudaProfundidad: e.target.checked })}
              />
              Mostrar ayuda de profundidad
            </label>
          </div>
        </div>
      </section>

      <section className="tarjeta p-5">
        <h2 className="mb-3 font-bold">Últimos resultados en esta PC</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-zinc-500">Todavía no se completó ningún ejercicio.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="py-1 pr-3">Fecha</th>
                  <th className="py-1 pr-3">Ejercicio</th>
                  <th className="py-1">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((r) => (
                  <tr key={r.fecha} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.fecha).toLocaleString("es-AR")}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{buscarEjercicio(r.ejercicio)?.nombre ?? r.ejercicio}</td>
                    <td className="py-2 text-zinc-600 dark:text-zinc-400">
                      {r.datos.map((d) => `${d.etiqueta}: ${d.valor}`).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
