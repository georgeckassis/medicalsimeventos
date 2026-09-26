"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ProveedorSesion, useSesion } from "@/components/Sesion";
import { NOMBRE_ROL, type Rol } from "@/lib/db/types";
import { reportar } from "@/lib/diagnostico";
import {
  IconActivity,
  IconBell,
  IconBox,
  IconBuilding,
  IconCalendar,
  IconChecklist,
  IconClose,
  IconHome,
  IconMenu,
  IconSettings,
  IconTruck,
  IconUser,
  IconUsers,
} from "@/components/icons";

type Icono = (props: { size?: number; className?: string }) => React.ReactElement;

const GESTORES: Rol[] = ["superadmin", "general"];
const LOGISTICA: Rol[] = [...GESTORES, "logistica"];

const NAV: Array<{ href: string; label: string; icon: Icono; roles?: Rol[] }> = [
  { href: "/", label: "Inicio", icon: IconHome },
  { href: "/calendario", label: "Calendario", icon: IconCalendar },
  { href: "/tareas", label: "Tareas", icon: IconChecklist },
  { href: "/alertas", label: "Alertas", icon: IconBell },
  { href: "/inventario", label: "Inventario", icon: IconBox, roles: LOGISTICA },
  { href: "/vehiculos", label: "Vehículos", icon: IconTruck, roles: LOGISTICA },
  { href: "/instituciones", label: "Instituciones", icon: IconBuilding, roles: GESTORES },
  { href: "/usuarios", label: "Usuarios", icon: IconUsers, roles: GESTORES },
  { href: "/configuracion", label: "Configuración", icon: IconSettings, roles: GESTORES },
  { href: "/diagnostico", label: "Diagnóstico", icon: IconActivity, roles: GESTORES },
  { href: "/cuenta", label: "Mi cuenta", icon: IconUser },
];

function claseItem(activo: boolean) {
  return `flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
    activo
      ? "border-brand-cyan/40 bg-brand-cyan/15 font-bold text-brand-navy-dark"
      : "border-transparent font-medium text-zinc-700 hover:bg-white/70 dark:text-zinc-300 dark:hover:bg-white/5"
  }`;
}

function Marco({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { sesion } = useSesion();
  const [navAbierto, setNavAbierto] = useState(false);
  const rol = sesion?.usuario.rol;

  const items = NAV.filter((i) => !i.roles || (rol && i.roles.includes(rol)));
  const activo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-16 flex-shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 sm:px-6 dark:border-zinc-800 dark:bg-zinc-950">
        <button
          type="button"
          onClick={() => setNavAbierto((v) => !v)}
          className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 md:hidden dark:text-zinc-400 dark:hover:bg-zinc-900"
          aria-label={navAbierto ? "Cerrar menú" : "Abrir menú"}
        >
          {navAbierto ? <IconClose size={20} /> : <IconMenu size={20} />}
        </button>
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="MedicalSim" width={148} height={33} priority className="h-7 w-auto" />
          <span className="hidden text-sm font-bold text-brand-navy sm:inline">Eventos</span>
        </Link>
        <div className="ml-auto flex items-center gap-4">
          {sesion && sesion.alertasActivas > 0 && (
            <Link
              href="/alertas"
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                sesion.incumplimientos > 0
                  ? "animate-pulse bg-red-600 text-white"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
              }`}
            >
              <IconBell size={14} />
              {sesion.alertasActivas}
            </Link>
          )}
          {sesion && (
            <span className="hidden text-right text-xs leading-tight text-zinc-500 sm:block">
              <span className="block font-semibold text-zinc-700 dark:text-zinc-300">{sesion.usuario.nombre}</span>
              {NOMBRE_ROL[sesion.usuario.rol]}
            </span>
          )}
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/login", { method: "DELETE" });
              router.push("/login");
              router.refresh();
            }}
            className="text-sm font-medium text-zinc-500 hover:text-brand-navy dark:text-zinc-400 dark:hover:text-brand-cyan"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {navAbierto && <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setNavAbierto(false)} />}
        <aside
          className={`fixed inset-y-0 top-16 left-0 z-30 w-60 flex-shrink-0 overflow-y-auto border-r border-zinc-200 bg-[#f2fafd] px-3 py-4 transition-transform duration-200 md:sticky md:h-[calc(100vh-4rem)] md:translate-x-0 dark:border-zinc-800 dark:bg-zinc-950 ${
            navAbierto ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <nav className="flex flex-col gap-0.5">
            {items.map((item) => {
              const Icono = item.icon;
              const esActivo = activo(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={() => setNavAbierto(false)} className={claseItem(esActivo)}>
                  <Icono size={17} className={`flex-shrink-0 ${esActivo ? "text-brand-navy" : "text-zinc-500"}`} />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/alertas" && sesion && sesion.alertasActivas > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-xs font-bold ${
                        sesion.incumplimientos > 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {sesion.alertasActivas}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          {sesion?.passwordInicial && (
            <div className="border-b border-amber-300 bg-amber-50 px-6 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Estás usando la contraseña inicial del super admin.{" "}
              <Link href="/cuenta" className="font-bold underline">
                Cambiala acá
              </Link>
              .
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

/** Pantallas sin barra ni sesión: login y el formulario público de inscripción por QR. */
function esPublica(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/inscripcion/");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publica = esPublica(pathname);

  useEffect(() => {
    // Marca que la app cargó bien (ver el aviso de app/layout.tsx para
    // navegadores donde no llega a arrancar).
    document.documentElement.setAttribute("data-hidratado", "1");
    document.getElementById("aviso-no-cargo")?.remove();
    if (publica) return;
    // Cualquier error de la pantalla queda en el registro de Diagnóstico.
    const alError = (e: ErrorEvent) => reportar("error_navegador", e.message || "Error", `${e.filename}:${e.lineno}:${e.colno}`);
    const alRechazo = (e: PromiseRejectionEvent) =>
      reportar("error_navegador", e.reason instanceof Error ? e.reason.message : String(e.reason), e.reason?.stack ?? "");
    window.addEventListener("error", alError);
    window.addEventListener("unhandledrejection", alRechazo);
    return () => {
      window.removeEventListener("error", alError);
      window.removeEventListener("unhandledrejection", alRechazo);
    };
  }, [publica]);
  return (
    <ProveedorSesion activo={!publica}>{publica ? <>{children}</> : <Marco>{children}</Marco>}</ProveedorSesion>
  );
}
