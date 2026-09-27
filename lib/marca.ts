/**
 * Marca con la que se muestra la app (logo, colores y nombre). Es el mismo
 * código para cada empresa: se elige con la variable de entorno
 * NEXT_PUBLIC_MARCA ("medicalsim" por defecto, o "icom"), y cada empresa
 * tiene su propio proyecto en Vercel con su propia base de datos.
 *
 * Al ser NEXT_PUBLIC_ el valor queda fijo al compilar: cambiarla en Vercel
 * requiere un nuevo deploy.
 */
export interface Marca {
  clave: string;
  /** Nombre de la empresa, como aparece en textos ("A cargo por …"). */
  nombre: string;
  /** Nombre de la app (título de la pestaña, mails, ícono en el celular). */
  nombreApp: string;
  nombreCorto: string;
  logo: { src: string; ancho: number; alto: number };
  colores: {
    principal: string;
    oscuro: string;
    acento: string;
    /** Fondo suave del menú lateral. */
    suave: string;
  };
  iconos: { favicon: string; apple: string; i192: string; i512: string; maskable: string };
}

const MARCAS: Record<string, Marca> = {
  medicalsim: {
    clave: "medicalsim",
    nombre: "MedicalSim",
    nombreApp: "MedicalSim Eventos",
    nombreCorto: "MS Eventos",
    logo: { src: "/logo.png", ancho: 148, alto: 33 },
    colores: { principal: "#2f71b8", oscuro: "#24578f", acento: "#14bbe7", suave: "#f2fafd" },
    iconos: {
      favicon: "/marcas/medicalsim/favicon.ico",
      apple: "/marcas/medicalsim/apple-icon.png",
      i192: "/icons/icon-192.png",
      i512: "/icons/icon-512.png",
      maskable: "/icons/icon-maskable-512.png",
    },
  },
  icom: {
    clave: "icom",
    nombre: "ICOM Salud",
    nombreApp: "ICOM Salud Eventos",
    nombreCorto: "ICOM Eventos",
    logo: { src: "/marcas/icom/logo.png", ancho: 640, alto: 132 },
    // Tomados del logo oficial: verde azulado, verde oscuro y verde lima.
    colores: { principal: "#087068", oscuro: "#064e48", acento: "#8cba37", suave: "#f3f8ef" },
    iconos: {
      favicon: "/marcas/icom/favicon.ico",
      apple: "/marcas/icom/apple-icon.png",
      i192: "/marcas/icom/icon-192.png",
      i512: "/marcas/icom/icon-512.png",
      maskable: "/marcas/icom/icon-maskable-512.png",
    },
  },
};

export const marca: Marca = MARCAS[(process.env.NEXT_PUBLIC_MARCA ?? "").trim().toLowerCase()] ?? MARCAS.medicalsim;
