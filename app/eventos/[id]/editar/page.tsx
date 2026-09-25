"use client";

import { use, useEffect, useState } from "react";
import Encabezado from "@/components/Encabezado";
import FormularioEvento from "@/components/FormularioEvento";
import MensajeError from "@/components/MensajeError";
import { mensajeDe, pedir } from "@/lib/cliente";
import type { Evento } from "@/lib/db/types";

export default function EditarEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pedir<{ evento: Evento }>(`/api/eventos/${id}`)
      .then((d) => setEvento(d.evento))
      .catch((e) => setError(mensajeDe(e)));
  }, [id]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Encabezado titulo="Editar evento" />
      {error && <MensajeError mensaje={error} />}
      {evento && <FormularioEvento evento={evento} />}
    </div>
  );
}
