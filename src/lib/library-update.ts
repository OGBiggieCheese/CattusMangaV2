"use client";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type LibraryUpdateStatus } from "@/lib/api";
import { toast } from "@/lib/toast";

/**
 * Búsqueda de capítulos nuevos en toda la biblioteca. Suwayomi la hace en segundo plano: aquí se
 * lanza, se consulta su progreso mientras dura y, al terminar, se refrescan las listas y se avisa.
 */
export function useLibraryUpdate() {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["library-update"],
    queryFn: api.libraryUpdateStatus,
    staleTime: 0,
    refetchInterval: (q) => (q.state.data?.isRunning ? 1500 : false),
  });

  const wasRunning = useRef(false);

  const finished = (failed: number) => {
    qc.invalidateQueries({ queryKey: ["updates"] });
    qc.invalidateQueries({ queryKey: ["library"] });
    if (failed)
      toast.error(`Búsqueda terminada, pero ${failed} ${failed === 1 ? "manga falló" : "mangas fallaron"}.`, {
        key: "library-update",
      });
    else toast.success("Búsqueda de novedades terminada.", { key: "library-update" });
  };

  const start = useMutation({
    mutationFn: api.updateLibrary,
    meta: { errorMessage: "No se pudo iniciar la búsqueda de novedades" },
    onSuccess: (jobs) => {
      // Se usa el estado que devuelve la propia mutación: así el seguimiento empieza al momento.
      qc.setQueryData<LibraryUpdateStatus>(["library-update"], (old) =>
        old ? { ...old, ...jobs } : { ...jobs, failed: [], lastUpdate: Date.now() },
      );
      if (jobs.isRunning) wasRunning.current = true;
      else qc.invalidateQueries({ queryKey: ["library-update"] }).then(() => finished(0));
    },
  });

  // Detecta el paso de "buscando" a "terminado".
  const data = status.data;
  useEffect(() => {
    if (!data) return;
    if (wasRunning.current && !data.isRunning) finished(data.failed.length);
    wasRunning.current = data.isRunning;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return {
    status: data,
    isRunning: !!data?.isRunning || start.isPending,
    start: () => start.mutate(),
  };
}
