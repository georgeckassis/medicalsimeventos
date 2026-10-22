"use client";

import dynamic from "next/dynamic";
import AccesoSimulador from "@/components/simulador/AccesoSimulador";

const Calibracion = dynamic(() => import("@/components/simulador/Calibracion"), { ssr: false });

export default function CalibracionPage() {
  return (
    <AccesoSimulador>
      <Calibracion />
    </AccesoSimulador>
  );
}
