"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import AccesoSimulador from "@/components/simulador/AccesoSimulador";

const SesionSimulador = dynamic(() => import("@/components/simulador/SesionSimulador"), { ssr: false });

export default function EjercicioPage() {
  const { ejercicio } = useParams<{ ejercicio: string }>();
  return (
    <AccesoSimulador>
      <SesionSimulador id={ejercicio} />
    </AccesoSimulador>
  );
}
