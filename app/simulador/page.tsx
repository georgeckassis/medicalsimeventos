"use client";

import dynamic from "next/dynamic";
import AccesoSimulador from "@/components/simulador/AccesoSimulador";

// El simulador vive solo en el navegador (cámara, WebGL, almacenamiento local).
const MenuSimulador = dynamic(() => import("@/components/simulador/MenuSimulador"), { ssr: false });

export default function SimuladorPage() {
  return (
    <AccesoSimulador>
      <MenuSimulador />
    </AccesoSimulador>
  );
}
