"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import CampoPassword from "@/components/CampoPassword";
import { mensajeDe, pedir } from "@/lib/cliente";

function FormularioLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await pedir("/api/login", { method: "POST", body: { email, password } });
      const destino = searchParams.get("from");
      // Solo rutas internas: evita redirigir a otro sitio con ?from=https://...
      router.push(destino && destino.startsWith("/") && !destino.startsWith("//") ? destino : "/");
      router.refresh();
    } catch (err) {
      setError(mensajeDe(err));
      setPassword("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="tarjeta w-full max-w-sm p-6">
      <Image src="/logo.png" alt="MedicalSim" width={148} height={33} className="mx-auto mb-2 h-8 w-auto" />
      <p className="mb-6 text-center text-sm font-bold text-brand-navy">Eventos y capacitaciones</p>
      <label className="etiqueta" htmlFor="email">
        Mail
      </label>
      <input
        id="email"
        type="email"
        autoComplete="username"
        autoFocus
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="campo mb-3"
      />
      <label className="etiqueta" htmlFor="password">
        Contraseña
      </label>
      <CampoPassword id="password" valor={password} onCambio={setPassword} autoComplete="current-password" requerido />
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button type="submit" disabled={enviando} className="boton mt-5 w-full">
        {enviando ? "Entrando…" : "Entrar"}
      </button>
      <p className="mt-4 text-center text-xs text-zinc-500">¿Te olvidaste la contraseña? Pedile al encargado general que te la cambie.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-6">
      <Suspense fallback={null}>
        <FormularioLogin />
      </Suspense>
    </div>
  );
}
