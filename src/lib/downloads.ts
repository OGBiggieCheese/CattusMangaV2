"use client";
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type DownloadStatus } from "@/lib/api";

const isActive = (s?: DownloadStatus) =>
  !!s && s.state === "STARTED" && s.queue.some((i) => i.state === "QUEUED" || i.state === "DOWNLOADING");

/** Estado de la cola de descargas. Se consulta a menudo solo mientras hay algo descargándose. */
export function useDownloads(enabled = true) {
  return useQuery({
    queryKey: ["downloads"],
    queryFn: api.downloadStatus,
    enabled,
    staleTime: 0,
    refetchInterval: (q) => (isActive(q.state.data) ? 1500 : false),
  });
}

/**
 * Cuando un capítulo sale de la cola (o termina), refresca las listas que muestran qué está descargado.
 * Se monta una sola vez, en el Shell.
 */
export function useDownloadWatcher(enabled: boolean) {
  const qc = useQueryClient();
  const { data } = useDownloads(enabled);
  const pending = useRef(new Set<number>());

  useEffect(() => {
    if (!data) return;
    const now = new Set(data.queue.filter((i) => i.state !== "FINISHED").map((i) => i.chapter.id));
    const finished = [...pending.current].some((id) => !now.has(id));
    pending.current = now;
    if (!finished) return;
    qc.invalidateQueries({ queryKey: ["chapters"] });
    qc.invalidateQueries({ queryKey: ["library"] });
    qc.invalidateQueries({ queryKey: ["downloaded"] });
  }, [data, qc]);

  return data;
}

/** Refresca todo lo relacionado tras encolar, cancelar o borrar descargas. */
export function useInvalidateDownloads() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["downloads"] });
    qc.invalidateQueries({ queryKey: ["chapters"] });
    qc.invalidateQueries({ queryKey: ["library"] });
    qc.invalidateQueries({ queryKey: ["downloaded"] });
  };
}
