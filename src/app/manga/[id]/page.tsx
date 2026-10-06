"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownUp,
  ArrowLeft,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCheck,
  Circle,
  CircleAlert,
  Download,
  ExternalLink,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { api, coverUrl, safeHref, swUrl, type Chapter, type DownloadItem } from "@/lib/api";
import { useDownloads, useInvalidateDownloads } from "@/lib/downloads";
import { previousPath } from "@/lib/nav";
import { formatDate, STATUS_LABEL } from "@/lib/format";
import { Button, Cover, ErrorBox, SearchInput, Spinner } from "@/components/ui";

const STALE_MS = 30 * 60_000;
const CHAPTER_PAGE = 100;

export default function MangaPage() {
  const id = Number(useParams<{ id: string }>().id);
  const router = useRouter();
  const qc = useQueryClient();

  const manga = useQuery({ queryKey: ["manga", id], queryFn: () => api.manga(id) });
  const chapters = useQuery({ queryKey: ["chapters", id], queryFn: () => api.chapters(id) });

  const refresh = useMutation({
    mutationFn: () => api.refreshManga(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manga", id] });
      qc.invalidateQueries({ queryKey: ["chapters", id] });
    },
  });

  // Pide datos frescos a la fuente si nunca se cargaron o están desactualizados.
  const autoRefreshed = useRef(false);
  useEffect(() => {
    const m = manga.data;
    if (!m || autoRefreshed.current) return;
    const last = Number(m.chaptersLastFetchedAt ?? 0);
    const lastMs = last < 1e12 ? last * 1000 : last;
    if (!m.initialized || !last || Date.now() - lastMs > STALE_MS) {
      autoRefreshed.current = true;
      refresh.mutate();
    }
  }, [manga.data, refresh]);

  const toggleLibrary = useMutation({
    mutationFn: (v: boolean) => api.setInLibrary(id, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manga", id] });
      qc.invalidateQueries({ queryKey: ["library"] });
    },
  });

  const list = chapters.data ?? [];
  const continueChapter = useMemo(() => pickContinue(list), [list]);

  if (manga.isPending) return <Spinner label="Cargando manga…" />;
  if (manga.isError) return <ErrorBox error={manga.error} onRetry={() => manga.refetch()} />;
  const m = manga.data;
  const loadingChapters = chapters.isPending || (refresh.isPending && list.length === 0);

  return (
    <>
      <button onClick={() => (previousPath() ? router.back() : router.push("/"))} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Volver
      </button>

      <section className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-surface">
        {m.thumbnailUrl && (
          <div
            aria-hidden
            className="absolute inset-0 scale-110 bg-cover bg-center opacity-20 blur-2xl"
            style={{ backgroundImage: `url(${coverUrl(m)})` }}
          />
        )}
        <div className="relative flex flex-col gap-6 p-5 sm:flex-row sm:p-8">
          <Cover src={coverUrl(m)} alt={m.title} className="mx-auto aspect-[2/3] w-44 shrink-0 rounded-2xl shadow-2xl ring-1 ring-border sm:mx-0 sm:w-52" />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {m.source && (
                <Link
                  href={`/explorar?fuente=${m.source.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2 py-1 text-xs font-semibold hover:text-accent"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={swUrl(m.source.iconUrl)} alt="" className="size-4 rounded" />
                  {m.source.displayName}
                </Link>
              )}
              <span className="rounded-lg bg-accent-soft px-2 py-1 text-xs font-bold uppercase text-accent">{STATUS_LABEL[m.status]}</span>
            </div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">{m.title}</h1>
            {(m.author || m.artist) && (
              <p className="mt-2 text-sm text-muted">
                {[m.author, m.artist && m.artist !== m.author ? m.artist : null].filter(Boolean).join(" · ")}
              </p>
            )}
            {m.genre.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.genre.map((g) => (
                  <span key={g} className="rounded-md border border-border bg-bg/40 px-2 py-0.5 text-xs text-muted">
                    {g}
                  </span>
                ))}
              </div>
            )}
            {m.description && <Description text={m.description} />}

            <div className="mt-auto flex flex-wrap gap-2 pt-6">
              {continueChapter ? (
                <Link
                  href={`/leer/${continueChapter.chapter.id}`}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-accent-fg transition hover:brightness-110"
                >
                  <BookOpen className="size-4" />
                  {continueChapter.resume ? `Continuar · ${continueChapter.chapter.name}` : "Empezar a leer"}
                </Link>
              ) : (
                <Button variant="primary" disabled className="h-11">
                  <BookOpen className="size-4" /> Empezar a leer
                </Button>
              )}
              <Button
                onClick={() => toggleLibrary.mutate(!m.inLibrary)}
                loading={toggleLibrary.isPending}
                className={`h-11 ${m.inLibrary ? "!bg-accent-soft !text-accent" : ""}`}
              >
                {!toggleLibrary.isPending && (m.inLibrary ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />)}
                {m.inLibrary ? "En biblioteca" : "Añadir a biblioteca"}
              </Button>
              <Button variant="ghost" className="h-11" onClick={() => refresh.mutate()} loading={refresh.isPending} title="Actualizar desde la fuente">
                {!refresh.isPending && <RefreshCw className="size-4" />}
              </Button>
              {safeHref(m.realUrl) && (
                <a
                  href={safeHref(m.realUrl)!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-fg"
                  title="Abrir en la web original"
                >
                  <ExternalLink className="size-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {refresh.isError && (
        <div className="mb-6">
          <ErrorBox error={refresh.error} onRetry={() => refresh.mutate()} />
        </div>
      )}

      {loadingChapters ? (
        <Spinner label="Cargando capítulos desde la fuente…" />
      ) : chapters.isError ? (
        <ErrorBox error={chapters.error} onRetry={() => chapters.refetch()} />
      ) : (
        <ChapterList mangaId={id} chapters={list} updating={refresh.isPending} />
      )}
    </>
  );
}

/** Capítulo por el que seguir: el último abierto (o el siguiente si ya se terminó), o el primero. */
function pickContinue(list: Chapter[]): { chapter: Chapter; resume: boolean } | null {
  if (!list.length) return null;
  const asc = [...list].sort((a, b) => a.sourceOrder - b.sourceOrder);
  const last = asc.reduce<Chapter | null>(
    (best, c) => (Number(c.lastReadAt) > Number(best?.lastReadAt ?? 0) ? c : best),
    null,
  );
  if (last) {
    if (!last.isRead) return { chapter: last, resume: true };
    const next = asc.find((c) => c.sourceOrder > last.sourceOrder && !c.isRead);
    if (next) return { chapter: next, resume: true };
  }
  const firstUnread = asc.find((c) => !c.isRead);
  return { chapter: firstUnread ?? asc[0], resume: false };
}

function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 320;
  return (
    <div className="mt-4 max-w-3xl">
      <p className={`whitespace-pre-line text-sm leading-relaxed text-fg/85 ${!open && long ? "line-clamp-4" : ""}`}>{text}</p>
      {long && (
        <button onClick={() => setOpen((v) => !v)} className="mt-1 text-sm font-semibold text-accent hover:underline">
          {open ? "Ver menos" : "Ver más"}
        </button>
      )}
    </div>
  );
}

function ChapterList({ mangaId, chapters, updating }: { mangaId: number; chapters: Chapter[]; updating: boolean }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [asc, setAsc] = useState(false);
  const [limit, setLimit] = useState(CHAPTER_PAGE);

  const mark = useMutation({
    mutationFn: ({ ids, isRead }: { ids: number[]; isRead: boolean }) => api.updateChapters(ids, { isRead }),
    onMutate: ({ ids, isRead }) => {
      qc.setQueryData<Chapter[]>(["chapters", mangaId], (old) =>
        old?.map((c) => (ids.includes(c.id) ? { ...c, isRead } : c)),
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["chapters", mangaId] });
      qc.invalidateQueries({ queryKey: ["library"] });
    },
  });

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const out = chapters.filter((c) => (!unreadOnly || !c.isRead) && (!q || c.name.toLowerCase().includes(q)));
    return asc ? [...out].reverse() : out;
  }, [chapters, filter, unreadOnly, asc]);

  const unread = chapters.filter((c) => !c.isRead);
  const downloadedCount = chapters.filter((c) => c.isDownloaded).length;

  const downloads = useDownloads();
  const queued = useMemo(
    () => new Map((downloads.data?.queue ?? []).filter((i) => i.state !== "FINISHED").map((i) => [i.chapter.id, i])),
    [downloads.data],
  );
  const invalidateDownloads = useInvalidateDownloads();
  const dl = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSettled: invalidateDownloads });

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">Capítulos</h2>
        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">{chapters.length}</span>
        {downloadedCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted" title="Capítulos descargados">
            <HardDrive className="size-3.5" /> {downloadedCount}
          </span>
        )}
        {updating && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Loader2 className="size-3.5 animate-spin" /> Buscando nuevos…
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-xl bg-surface-2 p-1 text-xs font-semibold">
            <button onClick={() => setUnreadOnly(false)} className={`rounded-lg px-3 py-1.5 ${!unreadOnly ? "bg-surface text-fg shadow-sm" : "text-muted"}`}>
              Todos
            </button>
            <button onClick={() => setUnreadOnly(true)} className={`rounded-lg px-3 py-1.5 ${unreadOnly ? "bg-surface text-fg shadow-sm" : "text-muted"}`}>
              No leídos
            </button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setAsc((v) => !v)} title="Invertir orden">
            <ArrowDownUp className="size-4" />
          </Button>
          <DownloadMenu chapters={chapters} queued={queued} onAction={(fn) => dl.mutate(fn)} />
          {unread.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => mark.mutate({ ids: unread.map((c) => c.id), isRead: true })} title="Marcar todo como leído">
              <CheckCheck className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {chapters.length > 10 && (
        <SearchInput value={filter} onChange={setFilter} placeholder="Filtrar capítulo por nombre o número…" className="mb-3" />
      )}

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{chapters.length ? "Ningún capítulo coincide." : "Esta fuente no tiene capítulos para este manga."}</p>
      ) : (
        <ul className="space-y-1.5">
          {visible.slice(0, limit).map((c) => {
            const inProgress = !c.isRead && c.lastPageRead > 0 && c.pageCount > 0;
            return (
              <li key={c.id} className="group flex items-center gap-2 rounded-xl border border-border bg-surface pr-2 transition hover:border-accent">
                <Link href={`/leer/${c.id}`} className={`flex min-w-0 flex-1 flex-col px-4 py-3 ${c.isRead ? "opacity-50" : ""}`}>
                  <span className="truncate text-sm font-semibold">{c.name}</span>
                  <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                    {Number(c.uploadDate) > 0 && <span>{formatDate(c.uploadDate)}</span>}
                    {c.scanlator && <span className="truncate">{c.scanlator}</span>}
                    {inProgress && <span className="font-semibold text-accent">Página {c.lastPageRead + 1} de {c.pageCount}</span>}
                  </span>
                </Link>
                <DownloadButton chapter={c} item={queued.get(c.id)} onAction={(fn) => dl.mutate(fn)} />
                <button
                  onClick={() => mark.mutate({ ids: [c.id], isRead: !c.isRead })}
                  className={`grid size-9 shrink-0 place-items-center rounded-lg transition hover:bg-surface-2 ${c.isRead ? "text-success" : "text-muted"}`}
                  title={c.isRead ? "Marcar como no leído" : "Marcar como leído"}
                >
                  {c.isRead ? <Check className="size-4" strokeWidth={3} /> : <Circle className="size-4" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {dl.isError && <p className="mt-3 text-sm text-danger">{(dl.error as Error).message}</p>}
      {visible.length > limit && (
        <div className="mt-4 text-center">
          <Button onClick={() => setLimit((l) => l + CHAPTER_PAGE)}>Mostrar más ({visible.length - limit})</Button>
        </div>
      )}
    </section>
  );
}

type DownloadAction = (fn: () => Promise<unknown>) => void;

/** Botón de descarga de un capítulo: descarga, muestra el progreso, cancela o borra. */
function DownloadButton({ chapter: c, item, onAction }: { chapter: Chapter; item?: DownloadItem; onAction: DownloadAction }) {
  const base = "grid size-9 shrink-0 place-items-center rounded-lg transition hover:bg-surface-2";
  if (item?.state === "ERROR")
    return (
      <button
        onClick={() => onAction(() => api.dequeue([c.id]).then(() => api.download([c.id])))}
        className={`${base} text-danger`}
        title="La descarga falló. Clic para reintentar"
      >
        <CircleAlert className="size-4" />
      </button>
    );
  if (item)
    return (
      <button onClick={() => onAction(() => api.dequeue([c.id]))} className={`${base} text-accent`} title="Clic para cancelar la descarga">
        {item.state === "DOWNLOADING" ? <ProgressRing value={item.progress} /> : <Loader2 className="size-4 animate-spin opacity-60" />}
      </button>
    );
  if (c.isDownloaded)
    return (
      <button
        onClick={() => onAction(() => api.deleteDownloads([c.id]))}
        className={`${base} group/dl text-success hover:text-danger`}
        title="Descargado. Clic para borrar la descarga"
      >
        <HardDrive className="size-4 group-hover/dl:hidden" />
        <Trash2 className="hidden size-4 group-hover/dl:block" />
      </button>
    );
  return (
    <button onClick={() => onAction(() => api.download([c.id]))} className={`${base} text-muted hover:text-fg`} title="Descargar">
      <Download className="size-4" />
    </button>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 7;
  const len = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 18 18" className="size-[18px] -rotate-90">
      <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth="2.5" />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - Math.max(0.05, value))}
      />
    </svg>
  );
}

/** Descarga o borra varios capítulos de una vez. */
function DownloadMenu({
  chapters,
  queued,
  onAction,
}: {
  chapters: Chapter[];
  queued: Map<number, DownloadItem>;
  onAction: DownloadAction;
}) {
  const [open, setOpen] = useState(false);
  const asc = [...chapters].sort((a, b) => a.sourceOrder - b.sourceOrder);
  const pending = (list: Chapter[]) => list.filter((c) => !c.isDownloaded && !queued.has(c.id));
  // «Siguientes» = los no leídos posteriores al último capítulo leído.
  const lastRead = asc.findLast((c) => c.isRead)?.sourceOrder ?? -Infinity;
  const nextUnread = pending(asc.filter((c) => !c.isRead && c.sourceOrder > lastRead));
  const downloaded = chapters.filter((c) => c.isDownloaded);

  const options: { label: string; ids: number[] }[] = [
    { label: "Siguientes 5", ids: nextUnread.slice(0, 5).map((c) => c.id) },
    { label: "Siguientes 10", ids: nextUnread.slice(0, 10).map((c) => c.id) },
    { label: "Todos los no leídos", ids: pending(asc.filter((c) => !c.isRead)).map((c) => c.id) },
    { label: "Todos", ids: pending(asc).map((c) => c.id) },
  ];
  const run = (fn: () => Promise<unknown>) => {
    setOpen(false);
    onAction(fn);
  };

  return (
    <div className="relative">
      <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} title="Descargar capítulos">
        <Download className="size-4" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-60 rounded-xl border border-border bg-surface p-1.5 text-sm shadow-2xl">
            <p className="px-3 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Descargar</p>
            {options.map((o) => (
              <button
                key={o.label}
                disabled={!o.ids.length}
                onClick={() => run(() => api.download(o.ids))}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40"
              >
                {o.label}
                <span className="text-xs text-muted">{o.ids.length}</span>
              </button>
            ))}
            {downloaded.length > 0 && (
              <>
                <hr className="my-1.5 border-border" />
                <button
                  onClick={() => {
                    if (confirm(`¿Borrar los ${downloaded.length} capítulos descargados?`))
                      run(() => api.deleteDownloads(downloaded.map((c) => c.id)));
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-danger hover:bg-danger/10"
                >
                  <span className="flex items-center gap-2">
                    <Trash2 className="size-3.5" /> Borrar descargas
                  </span>
                  <span className="text-xs">{downloaded.length}</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
