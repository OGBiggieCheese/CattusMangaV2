"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { applyTheme, useSettings } from "@/lib/settings";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
        },
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

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
