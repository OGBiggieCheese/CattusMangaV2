"use client";
import Link from "next/link";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Play, X } from "lucide-react";
import { api, coverUrl } from "@/lib/api";
import type { HistoryGroup } from "@/lib/history";
import { groupByDay, timeAgo, toMs } from "@/lib/format";
import { toast } from "@/lib/toast";
import { Button, Cover, EmptyState, ErrorBox, PageHeader, Spinner } from "@/components/ui";

const PAGE = 40;

export default function HistoryPage() {
  const qc = useQueryClient();
  const [max, setMax] = useState(PAGE);
  const history = useQuery({
    queryKey: ["history", max],
    queryFn: () => api.history(max),
    placeholderData: keepPreviousData,
  });

  const hide = useMutation({
    mutationFn: (group: HistoryGroup) => api.hideMangaFromHistory(group.entry.manga.id),
    meta: { errorMessage: "No se pudo quitar del historial" },
    // Desaparece al instante; si falla, la lista se recarga y vuelve a aparecer.
    onMutate: (group) => {
      qc.setQueryData<HistoryGroup[]>(["history", max], (old) => old?.filter((g) => g.entry.manga.id !== group.entry.manga.id));
    },
    onSuccess: (ids, group) => {
      qc.invalidateQueries({ queryKey: ["history"] });
      toast.success(`«${group.entry.manga.title}» quitado del historial.`, {
        key: "history-hide",
        action: {
          label: "Deshacer",
          run: () =>
            api
              .unhideFromHistory(ids)
              .then(() => qc.invalidateQueries({ queryKey: ["history"] }))
              .catch((e) => toast.error(`No se pudo deshacer: ${(e as Error).message}`)),
        },
      });
    },
    onError: () => qc.invalidateQueries({ queryKey: ["history"] }),
  });

  const groups = history.data ?? [];
  const days = groupByDay(groups, (g) => toMs(g.entry.lastReadAt));

  return (
    <>
      <PageHeader title="Historial" subtitle="Lo último que leíste de cada manga." />
      {history.isPending ? (
        <Spinner />
      ) : history.isError ? (
        <ErrorBox error={history.error} onRetry={() => history.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState icon={History} title="Sin historial" text="Cuando leas un capítulo aparecerá aquí." />
      ) : (
        <>
          <div className="space-y-6">
            {days.map((day) => (
              <section key={day.key} aria-labelledby={`day-${day.key}`}>
                <h2 id={`day-${day.key}`} className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">
                  {day.label}
                </h2>
                <ul className="space-y-2">
                  {day.items.map((group) => (
                    <HistoryRow key={group.entry.manga.id} group={group} onHide={() => hide.mutate(group)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {groups.length >= max && (
            <div className="mt-6 text-center">
              <Button onClick={() => setMax((m) => m + PAGE)} loading={history.isFetching}>
                Cargar más
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function HistoryRow({ group, onHide }: { group: HistoryGroup; onHide: () => void }) {
  const h = group.entry;
  const progress = h.isRead ? "Terminado" : h.pageCount > 0 ? `Página ${h.lastPageRead + 1} de ${h.pageCount}` : "";
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-2.5 pr-2">
      <Link href={`/manga/${h.manga.id}`} className="shrink-0" tabIndex={-1} aria-hidden>
        <Cover src={coverUrl(h.manga)} alt="" className="h-20 w-14 rounded-lg" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/manga/${h.manga.id}`} className="line-clamp-1 font-semibold hover:text-accent">
          {h.manga.title}
        </Link>
        <p className="truncate text-sm text-muted">{h.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {timeAgo(h.lastReadAt)}
          {progress && ` · ${progress}`}
          {group.count > 1 && ` · ${group.count} capítulos leídos`}
        </p>
      </div>
      <Link
        href={`/leer/${h.id}`}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-fg transition hover:scale-105"
        aria-label={`Seguir leyendo ${h.manga.title}`}
        title="Seguir leyendo"
      >
        <Play className="size-4 fill-current" />
      </Link>
      <button
        onClick={onHide}
        className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg"
        aria-label={`Quitar ${h.manga.title} del historial`}
        title="Quitar del historial"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}
