"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BellDot, Check, ChevronDown, Circle, HardDrive, RefreshCw, TriangleAlert } from "lucide-react";
import { api, coverUrl, type UpdateEntry } from "@/lib/api";
import { groupByDay, timeAgo, toMs } from "@/lib/format";
import { groupConsecutiveByManga } from "@/lib/updates";
import { useLibraryUpdate } from "@/lib/library-update";
import { Button, Cover, EmptyState, ErrorBox, PageHeader, Spinner } from "@/components/ui";

/** Capítulos que se muestran por manga antes de "Ver N más". */
const COLLAPSED = 3;

export default function UpdatesPage() {
  const update = useLibraryUpdate();
  const updates = useInfiniteQuery({
    queryKey: ["updates"],
    queryFn: ({ pageParam }) => api.updates(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset,
    staleTime: 60_000,
  });

  const items = (updates.data?.pages ?? []).flatMap((p) => p.items);
  const days = groupByDay(items, (c) => toMs(c.fetchedAt));

  // Una página puede quedarse vacía (solo tenía capítulos de la primera carga de algún manga):
  // en ese caso se pide la siguiente sola, para no mostrar "sin novedades" cuando sí las hay.
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isError } = updates;
  const lastPageEmpty = updates.data?.pages.at(-1)?.items.length === 0;
  useEffect(() => {
    if (lastPageEmpty && hasNextPage && !isFetchingNextPage && !isError) fetchNextPage();
  }, [lastPageEmpty, hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  // Carga automática al llegar al final.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage || isFetchingNextPage || isError) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && fetchNextPage(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage, items.length]);

  const status = update.status;
  const progress = status && status.totalJobs > 0 ? status.finishedJobs / status.totalJobs : 0;

  return (
    <>
      <PageHeader
        title="Novedades"
        subtitle={
          status?.lastUpdate
            ? `Capítulos nuevos de tu biblioteca · última búsqueda ${timeAgo(status.lastUpdate)}`
            : "Capítulos nuevos de tu biblioteca"
        }
        actions={
          <Button variant="primary" onClick={update.start} disabled={update.isRunning}>
            <RefreshCw className={`size-4 ${update.isRunning ? "animate-spin" : ""}`} />
            {update.isRunning ? "Buscando…" : "Buscar actualizaciones"}
          </Button>
        }
      />

      {update.isRunning && status && status.totalJobs > 0 && (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-medium">Buscando capítulos nuevos…</span>
            <span className="tabular-nums text-muted">
              {status.finishedJobs} / {status.totalJobs}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Progreso de la búsqueda"
            aria-valuemin={0}
            aria-valuemax={status.totalJobs}
            aria-valuenow={status.finishedJobs}
            className="h-2 overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}

      {!update.isRunning && status && status.failed.length > 0 && <FailedMangas failed={status.failed} />}

      {updates.isPending ? (
        <Spinner label="Cargando novedades…" />
      ) : updates.isError && !items.length ? (
        <ErrorBox error={updates.error} onRetry={() => updates.refetch()} />
      ) : !items.length ? (
        hasNextPage || isFetchingNextPage ? (
          <Spinner label="Buscando novedades…" />
        ) : (
          <EmptyState
            icon={BellDot}
            title="Sin novedades todavía"
            text="Cuando tus mangas tengan capítulos nuevos aparecerán aquí. Pulsa «Buscar actualizaciones» para comprobarlo ahora."
          />
        )
      ) : (
        <div className="space-y-8">
          {days.map((day) => (
            <section key={day.key} aria-labelledby={`upd-${day.key}`}>
              <h2 id={`upd-${day.key}`} className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
                {day.label}
              </h2>
              <div className="space-y-3">
                {groupConsecutiveByManga(day.items).map((g) => (
                  <MangaUpdates key={`${g.mangaId}-${g.items[0].id}`} chapters={g.items} />
                ))}
              </div>
            </section>
          ))}
          <div ref={sentinel} className="flex justify-center">
            {isFetchingNextPage ? (
              <Spinner />
            ) : isError ? (
              <Button onClick={() => fetchNextPage()}>Reintentar</Button>
            ) : hasNextPage ? (
              <Button onClick={() => fetchNextPage()}>Cargar más</Button>
            ) : (
              <p className="text-sm text-muted">No hay más novedades.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FailedMangas({ failed }: { failed: { id: number; title: string }[] }) {
  return (
    <details className="group mb-6 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-danger">
        <TriangleAlert className="size-4 shrink-0" />
        {failed.length} {failed.length === 1 ? "manga no se pudo actualizar" : "mangas no se pudieron actualizar"}
        <ChevronDown className="ml-auto size-4 transition group-open:rotate-180" />
      </summary>
      <p className="mt-2 text-muted">Suele ser la fuente caída o bloqueando (Cloudflare). Abre el manga para reintentarlo.</p>
      <ul className="mt-2 space-y-1">
        {failed.map((m) => (
          <li key={m.id}>
            <Link href={`/manga/${m.id}`} className="font-medium hover:text-accent hover:underline">
              {m.title}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

function MangaUpdates({ chapters }: { chapters: UpdateEntry[] }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const manga = chapters[0].manga;
  const shown = expanded ? chapters : chapters.slice(0, COLLAPSED);

  const mark = useMutation({
    mutationFn: ({ id, isRead }: { id: number; isRead: boolean }) => api.updateChapter(id, { isRead }),
    meta: { errorMessage: "No se pudo marcar el capítulo" },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["updates"] });
      qc.invalidateQueries({ queryKey: ["library"] });
    },
  });

  return (
    <article className="flex gap-3 rounded-2xl border border-border bg-surface p-2.5">
      <Link href={`/manga/${manga.id}`} className="shrink-0" tabIndex={-1} aria-hidden>
        <Cover src={coverUrl(manga)} alt="" className="h-20 w-14 rounded-lg" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/manga/${manga.id}`} className="line-clamp-1 font-semibold hover:text-accent">
          {manga.title}
        </Link>
        <ul className="mt-1">
          {shown.map((c) => {
            const inProgress = !c.isRead && c.lastPageRead > 0 && c.pageCount > 0;
            return (
              <li key={c.id} className="-mx-1 flex items-center gap-1">
                <Link
                  href={`/leer/${c.id}`}
                  className={`flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-sm hover:text-accent ${c.isRead ? "text-muted" : ""}`}
                >
                  {!c.isRead && <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />}
                  <span className="truncate">{c.name}</span>
                  {c.isRead && <span className="sr-only">(leído)</span>}
                  {c.isDownloaded && <HardDrive className="size-3.5 shrink-0 text-muted" aria-label="Descargado" />}
                  {inProgress && (
                    <span className="shrink-0 text-xs font-semibold text-accent">
                      {c.lastPageRead + 1}/{c.pageCount}
                    </span>
                  )}
                </Link>
                <button
                  onClick={() => mark.mutate({ id: c.id, isRead: !c.isRead })}
                  disabled={mark.isPending}
                  className={`grid size-10 shrink-0 place-items-center rounded-lg transition hover:bg-surface-2 ${c.isRead ? "text-success" : "text-muted"}`}
                  aria-label={`${c.isRead ? "Marcar como no leído" : "Marcar como leído"}: ${c.name}`}
                  aria-pressed={c.isRead}
                  title={c.isRead ? "Marcar como no leído" : "Marcar como leído"}
                >
                  {c.isRead ? <Check className="size-4" strokeWidth={3} /> : <Circle className="size-4" />}
                </button>
              </li>
            );
          })}
        </ul>
        {chapters.length > COLLAPSED && (
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-1 min-h-9 text-sm font-medium text-accent hover:underline"
          >
            {expanded ? "Ver menos" : `Ver ${chapters.length - COLLAPSED} más`}
          </button>
        )}
      </div>
    </article>
  );
}
