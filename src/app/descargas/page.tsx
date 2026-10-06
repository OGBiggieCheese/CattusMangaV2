"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronDown, Download, HardDrive, Pause, Play, RotateCw, Trash2, X } from "lucide-react";
import { api, coverUrl, type DownloadedChapter, type DownloadItem, type MangaCardData } from "@/lib/api";
import { useDownloads, useInvalidateDownloads } from "@/lib/downloads";
import { Button, Cover, EmptyState, ErrorBox, PageHeader, Spinner } from "@/components/ui";
import { confirmAction } from "@/components/Confirm";

export default function DownloadsPage() {
  const status = useDownloads();
  const downloaded = useQuery({ queryKey: ["downloaded"], queryFn: api.downloadedChapters });
  const queue = (status.data?.queue ?? []).filter((i) => i.state !== "FINISHED");

  return (
    <>
      <PageHeader
        title="Descargas"
        subtitle="Los capítulos descargados se guardan en el servidor de CattusManga y se leen al instante, aunque la web original falle o desaparezca."
      />
      {status.isError && <ErrorBox error={status.error} onRetry={() => status.refetch()} />}
      {queue.length > 0 && status.data && <Queue items={queue} running={status.data.state === "STARTED"} />}

      {downloaded.isPending ? (
        <Spinner label="Cargando descargas…" />
      ) : downloaded.isError ? (
        <ErrorBox error={downloaded.error} onRetry={() => downloaded.refetch()} />
      ) : downloaded.data.length === 0 ? (
        !queue.length && (
          <EmptyState
            icon={Download}
            title="No tienes capítulos descargados"
            text="Abre un manga y pulsa el icono de descarga de un capítulo, o «Descargar» para bajar varios a la vez."
          />
        )
      ) : (
        <Downloaded chapters={downloaded.data} />
      )}
    </>
  );
}

const STATE_LABEL: Record<DownloadItem["state"], string> = {
  QUEUED: "En cola",
  DOWNLOADING: "Descargando",
  FINISHED: "Terminado",
  ERROR: "Error",
};

function Queue({ items, running }: { items: DownloadItem[]; running: boolean }) {
  const invalidate = useInvalidateDownloads();
  const action = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    meta: { errorMessage: "Error en la cola de descargas" },
    onSettled: invalidate,
  });

  const clearQueue = async () => {
    const ok = await confirmAction({
      title: `¿Vaciar la cola de descargas?`,
      message: `Se cancelarán ${items.length} ${items.length === 1 ? "descarga pendiente" : "descargas pendientes"}. Lo ya descargado no se borra.`,
      confirmLabel: "Vaciar cola",
      danger: true,
    });
    if (ok) action.mutate(api.clearDownloads);
  };
  const errors = items.filter((i) => i.state === "ERROR");

  return (
    <section className="mb-10">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold">Cola</h2>
        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">{items.length}</span>
        {!running && <span className="text-xs font-semibold text-muted">· En pausa</span>}
        <div className="ml-auto flex gap-2">
          {errors.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const ids = errors.map((i) => i.chapter.id);
                action.mutate(() => api.dequeue(ids).then(() => api.download(ids)));
              }}
            >
              <RotateCw className="size-3.5" /> Reintentar fallidos
            </Button>
          )}
          <Button size="sm" onClick={() => action.mutate(() => api.setDownloaderRunning(!running))}>
            {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {running ? "Pausar" : "Reanudar"}
          </Button>
          <Button size="sm" variant="danger" onClick={clearQueue}>
            <X className="size-3.5" /> Vaciar cola
          </Button>
        </div>
      </div>
      <ul className="space-y-1.5">
        {items.slice(0, 200).map((i) => (
          <li key={i.chapter.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                <Link href={`/manga/${i.manga.id}`} className="hover:text-accent">
                  {i.manga.title}
                </Link>
              </p>
              <p className="truncate text-xs text-muted">{i.chapter.name}</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full transition-all ${i.state === "ERROR" ? "bg-danger" : "bg-accent"}`}
                    style={{ width: `${Math.round(i.progress * 100)}%` }}
                  />
                </div>
                <span className={`w-24 text-right text-xs font-semibold tabular-nums ${i.state === "ERROR" ? "text-danger" : "text-muted"}`}>
                  {i.state === "DOWNLOADING" ? `${Math.round(i.progress * 100)}%` : STATE_LABEL[i.state]}
                </span>
              </div>
            </div>
            {i.state === "ERROR" && (
              <button
                onClick={() => action.mutate(() => api.dequeue([i.chapter.id]).then(() => api.download([i.chapter.id])))}
                className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
                title="Reintentar"
                aria-label={`Reintentar: ${i.chapter.name}`}
              >
                <RotateCw className="size-4" />
              </button>
            )}
            <button
              onClick={() => action.mutate(() => api.dequeue([i.chapter.id]))}
              className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger/15 hover:text-danger"
              title="Quitar de la cola"
              aria-label={`Quitar de la cola: ${i.chapter.name}`}
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {items.length > 200 && <p className="mt-3 text-center text-sm text-muted">Y {items.length - 200} más…</p>}
    </section>
  );
}

function Downloaded({ chapters }: { chapters: DownloadedChapter[] }) {
  const groups = useMemo(() => {
    const map = new Map<number, { manga: MangaCardData; chapters: DownloadedChapter[] }>();
    for (const c of chapters) {
      const g = map.get(c.manga.id);
      if (g) g.chapters.push(c);
      else map.set(c.manga.id, { manga: c.manga, chapters: [c] });
    }
    return [...map.values()].sort((a, b) => a.manga.title.localeCompare(b.manga.title));
  }, [chapters]);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-xl font-bold">Descargado</h2>
        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
          {chapters.length} capítulos · {groups.length} mangas
        </span>
      </div>
      <div className="space-y-2">
        {groups.map((g) => (
          <MangaDownloads key={g.manga.id} manga={g.manga} chapters={g.chapters} />
        ))}
      </div>
    </section>
  );
}

function MangaDownloads({ manga, chapters }: { manga: MangaCardData; chapters: DownloadedChapter[] }) {
  const [open, setOpen] = useState(false);
  const invalidate = useInvalidateDownloads();
  const remove = useMutation({
    mutationFn: api.deleteDownloads,
    meta: { errorMessage: "No se pudo borrar la descarga" },
    onSettled: invalidate,
  });

  const removeAll = async () => {
    const ok = await confirmAction({
      title: `¿Borrar los ${chapters.length} capítulos descargados?`,
      message: `De «${manga.title}». Podrás volver a descargarlos cuando quieras.`,
      confirmLabel: "Borrar",
      danger: true,
    });
    if (ok) remove.mutate(chapters.map((c) => c.id));
  };

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-3 p-2.5">
        <Link href={`/manga/${manga.id}`} className="shrink-0">
          <Cover src={coverUrl(manga)} alt={manga.title} className="h-16 w-11 rounded-lg" />
        </Link>
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{manga.title}</p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <HardDrive className="size-3" /> {chapters.length} {chapters.length === 1 ? "capítulo" : "capítulos"}
            </p>
          </div>
          <ChevronDown className={`size-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
        </button>
        <button
          onClick={removeAll}
          disabled={remove.isPending}
          className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger/15 hover:text-danger"
          title="Borrar todas las descargas de este manga"
          aria-label={`Borrar todas las descargas de ${manga.title}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {open && (
        <ul className="border-t border-border p-1.5">
          {chapters.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg pr-1 hover:bg-surface-2">
              <Link href={`/leer/${c.id}`} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm">
                <BookOpen className="size-3.5 shrink-0 text-muted" />
                <span className="truncate">{c.name}</span>
              </Link>
              <button
                onClick={() => remove.mutate([c.id])}
                disabled={remove.isPending}
                className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger/15 hover:text-danger"
                title="Borrar descarga"
                aria-label={`Borrar descarga: ${c.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
