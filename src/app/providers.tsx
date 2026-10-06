"use client";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { applyTheme, useSettings } from "@/lib/settings";
import { errorMessage, toast } from "@/lib/toast";
import { Toaster } from "@/components/Toaster";
import { ConfirmHost } from "@/components/Confirm";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** Texto que precede al error en el aviso, p. ej. "No se pudo instalar la extensión". */
      errorMessage?: string;
      /** No mostrar aviso: el componente ya enseña el error por su cuenta. */
      silent?: boolean;
    };
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
        },
        // Cualquier acción que falle (instalar, borrar, marcar…) avisa, en vez de fallar en silencio.
        // Las consultas no: sus errores ya se muestran en la propia página con un botón de reintentar.
        mutationCache: new MutationCache({
          onError: (error, _vars, _ctx, mutation) => {
            if (mutation.meta?.silent) return;
            const prefix = mutation.meta?.errorMessage;
            toast.error(prefix ? `${prefix}: ${errorMessage(error)}` : errorMessage(error));
          },
        }),
      }),
  );
  const theme = useSettings((s) => s.theme);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    Promise.resolve(useSettings.persist.rehydrate()).finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, hydrated]);

  return (
    <QueryClientProvider client={client}>
      {children}
      <ConfirmHost />
      <Toaster />
    </QueryClientProvider>
  );
}
