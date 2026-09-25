"use client";

import { useState } from "react";
import Encabezado from "@/components/Encabezado";
import MensajeError from "@/components/MensajeError";
import { useSesion } from "@/components/Sesion";
import { mensajeDe, pedir } from "@/lib/cliente";
import { NOMBRE_ROL } from "@/lib/db/types";

export default function CuentaPage() {
  const { sesion, recargar } = useSesion();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function cambiar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (nueva !== repetida) {
      setError("Las dos contraseñas nuevas no coinciden.");
      return;
    }
    try {
      await pedir("/api/cuenta/password", { method: "PUT", body: { actual, nueva } });
      setActual("");
      setNueva("");
      setRepetida("");
      setOk(true);
      recargar();
    } catch (err) {
      setError(mensajeDe(err));
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
      <Encabezado titulo="Mi cuenta" />
      {sesion && (
        <section className="tarjeta mb-5 p-5 text-sm">
          <p className="font-semibold">{sesion.usuario.nombre}</p>
          <p className="text-zinc-500">{sesion.usuario.email}</p>
          <p className="mt-1">
            {NOMBRE_ROL[sesion.usuario.rol]}
            {sesion.usuario.institucionNombre && ` — ${sesion.usuario.institucionNombre}`}
          </p>
        </section>
      )}
      <form onSubmit={cambiar} className="tarjeta grid gap-3 p-5">
        <h2 className="font-bold">Cambiar contraseña</h2>
        <div>
          <label className="etiqueta">Contraseña actual</label>
          <input className="campo" type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta">Contraseña nueva (mínimo 8 caracteres)</label>
          <input className="campo" type="password" autoComplete="new-password" required minLength={8} value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta">Repetí la contraseña nueva</label>
          <input className="campo" type="password" autoComplete="new-password" required value={repetida} onChange={(e) => setRepetida(e.target.value)} />
        </div>
        {error && <MensajeError mensaje={error} />}
        {ok && <p className="text-sm text-emerald-700">Contraseña actualizada.</p>}
        <div>
          <button type="submit" className="boton">
            Cambiar contraseña
          </button>
        </div>
      </form>
    </div>
  );
}
