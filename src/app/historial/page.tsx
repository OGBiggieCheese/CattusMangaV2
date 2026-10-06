"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Play, X } from "lucide-react";
import { api, coverUrl } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { Cover, EmptyState, ErrorBox, PageHeader, Spinner } from "@/components/ui";

export default function HistoryPage() {
  const queryClient = useQueryClient();
  const history = useQuery({ queryKey: ["history", "full"], queryFn: () => api.history(150) });
  const hide = useMutation({
    mutationFn: api.hideFromHistory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["history"] }),
  });
  const visible = history.data?.filter((h) => !api.isHiddenFromHistory(h));

  return (
    <>
      <PageHeader title="Historial" subtitle="Los últimos capítulos que abriste." />
      {history.isPending ? (
        <Spinner />
      ) : history.isError ? (
        <ErrorBox error={history.error} onRetry={() => history.refetch()} />
      ) : visible!.length === 0 ? (
        <EmptyState icon={History} title="Sin historial" text="Cuando leas un capítulo aparecerá aquí." />
      ) : (
        <ul className="space-y-2">
          {visible!.map((h) => (
            <li key={h.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-2.5 pr-3">
              <Link href={`/manga/${h.manga.id}`} className="shrink-0">
                <Cover src={coverUrl(h.manga)} alt={h.manga.title} className="h-20 w-14 rounded-lg" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/manga/${h.manga.id}`} className="line-clamp-1 font-semibold hover:text-accent">
                  {h.manga.title}
                </Link>
                <p className="truncate text-sm text-muted">{h.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {timeAgo(h.lastReadAt)}
                  {h.isRead ? " · Terminado" : h.pageCount ? ` · Página ${h.lastPageRead + 1} de ${h.pageCount}` : ""}
                </p>
              </div>
              <Link
                href={`/leer/${h.id}`}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-fg transition hover:scale-105"
                title="Seguir leyendo"
              >
                <Play className="size-4 fill-current" />
              </Link>
              <button
                onClick={() => hide.mutate(h.id)}
                disabled={hide.isPending}
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-border hover:text-fg disabled:opacity-50"
                title="Quitar del historial"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
