"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

export default function AccessPage() {
  return (
    <Suspense>
      <Access />
    </Suspense>
  );
}

function Access() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "wrong">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || state === "checking") return;
    setState("checking");
    const res = await fetch("/api/acceso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (res?.ok) {
      // Solo rutas internas, para que el parámetro no pueda mandar a otra web.
      const next = params.get("next");
      window.location.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
      return;
    }
    setPassword("");
    setState("wrong");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg px-4">
      <form onSubmit={submit} className="w-full max-w-xs">
        <label htmlFor="password" className="mb-2 block text-sm font-medium">
          Ingresa la contraseña:
        </label>
        <div className={`flex gap-2 ${state === "wrong" ? "animate-shake" : ""}`} onAnimationEnd={() => setState((s) => (s === "wrong" ? "idle" : s))}>
          <input
            id="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`h-11 min-w-0 flex-1 rounded-xl border bg-surface px-3 text-sm outline-none transition focus:border-accent ${
              state === "wrong" ? "border-danger" : "border-border"
            }`}
          />
          <button
            type="submit"
            aria-label="Entrar"
            disabled={!password || state === "checking"}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg transition hover:brightness-110 disabled:opacity-50"
          >
            {state === "checking" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
