"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Loader2,
  RotateCw,
  Settings2,
} from "lucide-react";
import { api, type Chapter } from "@/lib/api";
import { useSettings, type ReaderFit } from "@/lib/settings";
import { previousPath } from "@/lib/nav";
import { Button, ErrorBox, Toggle } from "@/components/ui";
import { isModalOpen, Modal } from "@/components/Modal";
import { toast } from "@/lib/toast";

/** Imágenes del siguiente capítulo que se descargan por adelantado. */
const PRELOAD_IMAGES = 5;

export default function ReaderPage() {
  const id = Number(useParams<{ id: string }>().id);
  // `key` reinicia todo el estado del lector al cambiar de capítulo.
  return <Reader key={id} id={id} />;
}

function Reader({ id }: { id: number }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { readerMode, readerDirection, readerFit, webtoonMaxWidth, webtoonGap, preloadNext } = useSettings();

  const chapter = useQuery({ queryKey: ["chapter", id], queryFn: () => api.chapter(id), staleTime: 0 });
  const pages = useQuery({ queryKey: ["pages", id], queryFn: () => api.pages(id), staleTime: Infinity, retry: 1 });
  const mangaId = chapter.data?.mangaId;
  const siblings = useQuery({
    queryKey: ["chapters", mangaId],
    queryFn: () => api.chapters(mangaId!),
    enabled: !!mangaId,
  });

  const ordered = useMemo(
    () => [...(siblings.data ?? [])].sort((a, b) => a.sourceOrder - b.sourceOrder),
    [siblings.data],
  );
  const pos = ordered.findIndex((c) => c.id === id);
  const prev: Chapter | undefined = pos > 0 ? ordered[pos - 1] : undefined;
  const next: Chapter | undefined = pos >= 0 ? ordered[pos + 1] : undefined;

  const total = pages.data?.length ?? 0;
  const [page, setPage] = useState<number | null>(null);
  const [ui, setUi] = useState(true);
  const [panel, setPanel] = useState(false);
  const onScrollDir = useCallback((down: boolean) => setUi(!down), []);
  const toggleUi = useCallback(() => setUi((v) => !v), []);

  // Página inicial: retoma donde se dejó si el capítulo no estaba terminado.
  const startPage = useRef<number | null>(null);
  if (startPage.current === null && chapter.data && total) {
    const c = chapter.data;
    startPage.current = !c.isRead && c.lastPageRead > 0 ? Math.min(c.lastPageRead, total - 1) : 0;
  }
  useEffect(() => {
    if (page === null && startPage.current !== null) setPage(startPage.current);
  }, [page, total]);

  // Guarda el progreso en Suwayomi (con un pequeño retardo para no saturar).
  const pendingSave = useRef<(() => Promise<unknown>) | null>(null);
  useEffect(() => {
    if (page === null || !total) return;
    const done = page >= total - 1;
    const save = () => {
      pendingSave.current = null;
      return api
        .updateChapter(id, done ? { lastPageRead: page, isRead: true } : { lastPageRead: page })
        .catch((e) => toast.error(`No se pudo guardar el progreso: ${(e as Error).message}`, { key: "reader-progress" }));
    };
    pendingSave.current = save;
    const t = setTimeout(save, 600);
    return () => clearTimeout(t);
  }, [id, page, total]);

  // Al salir del lector: guarda lo pendiente (p. ej. la última página, si se pasa de capítulo
  // enseguida) y luego refresca las listas que dependen del progreso.
  useEffect(
    () => () => {
      Promise.resolve(pendingSave.current?.()).finally(() => {
        qc.invalidateQueries({ queryKey: ["chapters"] });
        qc.invalidateQueries({ queryKey: ["history"] });
        qc.invalidateQueries({ queryKey: ["library"] });
      });
    },
    [qc],
  );

  // Precarga del siguiente capítulo, en dos fases para no gastar datos si se abandona pronto:
  // pasado el 60 % (o a 5 páginas del final) se pide la lista de páginas a la fuente, y en las
  // últimas páginas se descargan sus primeras imágenes. Al pasar de capítulo ya están en caché.
  const nearEnd = page !== null && total > 0 && page >= Math.min(total - 5, Math.floor(total * 0.6));
  const atEnd = page !== null && total > 0 && page >= total - 4;
  const nextPages = useQuery({
    queryKey: ["pages", next?.id],
    queryFn: () => api.pages(next!.id),
    enabled: preloadNext && !!next && nearEnd,
    staleTime: Infinity,
    retry: 0,
  });
  const preloaded = useRef<HTMLImageElement[]>([]);
  useEffect(() => {
    if (!preloadNext || !atEnd || !nextPages.data || preloaded.current.length) return;
    preloaded.current = nextPages.data.slice(0, PRELOAD_IMAGES).map((src) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      return img;
    });
  }, [preloadNext, atEnd, nextPages.data]);
  useEffect(() => {
    if (preloadNext && next && nearEnd) qc.prefetchQuery({ queryKey: ["chapter", next.id], queryFn: () => api.chapter(next.id) });
  }, [preloadNext, next, nearEnd, qc]);

  // Cambiar de capítulo reemplaza la entrada del historial: así "atrás" sale del lector de una vez
  // en vez de recorrer cada capítulo leído.
  const goChapter = useCallback((c?: Chapter | number) => c && router.replace(`/leer/${typeof c === "number" ? c : c.id}`), [router]);
  const backHref = mangaId ? `/manga/${mangaId}` : "/";
  // Volver a la ficha: si se vino de ella se retrocede (para que su propio "Volver" lleve a donde
  // estabas antes); si no, se reemplaza el lector por la ficha, sin dejarlo detrás en el historial.
  const goBack = useCallback(() => {
    if (previousPath() === backHref) router.back();
    else router.replace(backHref);
  }, [router, backHref]);
  const onBackClick = (e: React.MouseEvent) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return; // abrir en otra pestaña sigue funcionando
    e.preventDefault();
    goBack();
  };

  const paged = readerMode === "paged";
  const step = useCallback(
    (delta: number) => {
      if (page === null) return;
      const target = page + delta;
      if (target >= total) return goChapter(next);
      if (target < 0) return goChapter(prev);
      setPage(target);
    },
    [page, total, next, prev, goChapter],
  );

  // Teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Con una ventana abierta, Esc la cierra a ella (y las flechas no pasan página por detrás).
      if (isModalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement)?.tagName === "SELECT" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const rtl = readerDirection === "rtl";
      if (e.key === "Escape") goBack();
      else if (paged && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        step((e.key === "ArrowRight") !== rtl ? 1 : -1);
      } else if (paged && (e.key === " " || e.key === "PageDown")) {
        e.preventDefault();
        step(1);
      } else if (e.key === "n" || e.key === "N") goChapter(next);
      else if (e.key === "p" || e.key === "P") goChapter(prev);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paged, readerDirection, step, goBack, goChapter, next, prev]);

  const c = chapter.data;

  return (
    <div className="min-h-dvh bg-bg">
      {/* Barra superior */}
      <header
        className={`fixed inset-x-0 top-0 z-40 border-b border-border bg-surface/95 backdrop-blur transition-transform duration-300 ${
          ui ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3">
          <Link href={backHref} onClick={onBackClick} className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg" title="Volver (Esc)" aria-label="Volver a la ficha">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{c?.manga.title ?? "…"}</p>
            {ordered.length > 0 ? (
              <select
                aria-label="Capítulo"
                value={id}
                onChange={(e) => goChapter(Number(e.target.value))}
                className="-ml-1 max-w-full truncate rounded bg-transparent text-xs text-muted outline-none hover:text-fg"
              >
                {[...ordered].reverse().map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="truncate text-xs text-muted">{c?.name}</p>
            )}
          </div>
          <button
            onClick={() => setPanel(true)}
            className={`grid size-10 place-items-center rounded-xl hover:bg-surface-2 ${panel ? "text-accent" : "text-muted"}`}
            title="Ajustes del lector"
            aria-label="Ajustes del lector"
            aria-haspopup="dialog"
          >
            <Settings2 className="size-5" />
          </button>
        </div>

      </header>

      <ReaderPanel open={panel} onClose={() => setPanel(false)} />

      {/* Contenido */}
      {pages.isPending || chapter.isPending ? (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-sm text-muted">
          <Loader2 className="size-7 animate-spin text-accent" />
          Cargando páginas desde la fuente…
        </div>
      ) : pages.isError || chapter.isError ? (
        <div className="mx-auto max-w-xl px-4 pt-24">
          <ErrorBox error={pages.error ?? chapter.error} onRetry={() => pages.refetch()} />
        </div>
      ) : total === 0 ? (
        <div className="mx-auto max-w-xl px-4 pt-24">
          <ErrorBox error="Este capítulo no tiene páginas." />
        </div>
      ) : paged ? (
        <PagedView
          pages={pages.data}
          page={page ?? 0}
          fit={readerFit}
          rtl={readerDirection === "rtl"}
          onStep={step}
          onToggleUi={toggleUi}
        />
      ) : (
        <WebtoonView
          pages={pages.data}
          startPage={startPage.current ?? 0}
          fit={readerFit}
          maxWidth={webtoonMaxWidth}
          gap={webtoonGap}
          onPage={setPage}
          onToggleUi={toggleUi}
          onScrollDir={onScrollDir}
          footer={<ChapterEnd next={next} backHref={backHref} onBack={onBackClick} onNext={() => goChapter(next)} />}
        />
      )}

      {/* Barra inferior */}
      {total > 0 && (
        <footer
          className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform duration-300 ${
            ui ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-3">
            <Button size="sm" variant="ghost" disabled={!prev} onClick={() => goChapter(prev)} title="Capítulo anterior (P)">
              <ChevronLeft className="size-4" /> <span className="hidden sm:inline">Anterior</span>
            </Button>
            <input
              type="range"
              min={0}
              max={total - 1}
              value={page ?? 0}
              dir={paged && readerDirection === "rtl" ? "rtl" : "ltr"}
              onChange={(e) => {
                const p = Number(e.target.value);
                setPage(p);
                if (!paged) document.getElementById(`page-${p}`)?.scrollIntoView({ block: "start" });
              }}
              className="flex-1 accent-[var(--accent)]"
              aria-label="Página"
            />
            <span className="w-16 text-center text-xs font-semibold tabular-nums text-muted">
              {(page ?? 0) + 1} / {total}
            </span>
            <Button size="sm" variant="ghost" disabled={!next} onClick={() => goChapter(next)} title="Capítulo siguiente (N)">
              <span className="hidden sm:inline">Siguiente</span> <ChevronRight className="size-4" />
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Imagen con reintento
function PageImage({
  src,
  index,
  className,
  eager,
  onSettle,
}: {
  src: string;
  index: number;
  className: string;
  eager?: boolean;
  /** Se llama cuando la imagen termina de cargar o falla. */
  onSettle?: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const url = attempt ? `${src}${src.includes("?") ? "&" : "?"}r=${attempt}` : src;

  if (state === "error")
    return (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 text-sm text-muted">
        <ImageOff className="size-8" />
        No se pudo cargar la página {index + 1}
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setState("loading");
            setAttempt((a) => a + 1);
          }}
        >
          <RotateCw className="size-3.5" /> Reintentar
        </Button>
      </div>
    );

  return (
    <>
      {state === "loading" && (
        <div className="flex min-h-[70vh] w-full items-center justify-center text-muted">
          <Loader2 className="size-6 animate-spin" />
          <span className="ml-2 text-xs tabular-nums">{index + 1}</span>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Página ${index + 1}`}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onLoad={() => {
          setState("ok");
          onSettle?.();
        }}
        onError={() => {
          setState("error");
          onSettle?.();
        }}
        className={`${className} select-none ${state === "ok" ? "" : "absolute h-px w-px opacity-0"}`}
      />
    </>
  );
}

// ---------------------------------------------------------------- Modo cascada
function WebtoonView({
  pages,
  startPage,
  fit,
  maxWidth,
  gap,
  onPage,
  onToggleUi,
  onScrollDir,
  footer,
}: {
  pages: string[];
  startPage: number;
  fit: ReaderFit;
  maxWidth: number;
  gap: boolean;
  onPage: (p: number) => void;
  onToggleUi: () => void;
  onScrollDir: (down: boolean) => void;
  footer: React.ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  // Hasta saltar a la página donde se dejó, no se informa la página visible: si no, la primera
  // (que es la que está en pantalla al abrir) pisaría el progreso guardado.
  const jumped = useRef(startPage === 0);

  // Página actual = la que cruza el centro de la pantalla.
  useEffect(() => {
    const els = container.current?.querySelectorAll<HTMLElement>("[data-page]");
    if (!els) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!jumped.current) return;
        for (const e of entries) if (e.isIntersecting) onPage(Number(e.target.getAttribute("data-page")));
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pages, onPage]);

  // Oculta las barras al bajar y las muestra al subir.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) > 40) {
        onScrollDir(y > last && y > 120);
        last = y;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScrollDir]);

  // Salta a la página donde se dejó la lectura.
  useEffect(() => {
    if (!jumped.current) document.getElementById(`page-${startPage}`)?.scrollIntoView({ block: "start" });
  }, [startPage]);

  const imgClass = fit === "original" ? "mx-auto max-w-full" : "w-full h-auto";

  return (
    <div
      ref={container}
      className="mx-auto pb-24 pt-14"
      style={{ maxWidth: maxWidth > 0 && fit !== "original" ? maxWidth : undefined }}
      onClick={onToggleUi}
    >
      {pages.map((src, i) => (
        <div key={src} id={`page-${i}`} data-page={i} className={`relative ${gap ? "mb-3" : ""}`}>
          <PageImage
            src={src}
            index={i}
            eager={Math.abs(i - startPage) < 3}
            className={imgClass}
            onSettle={
              i === startPage && !jumped.current
                ? () => {
                    jumped.current = true;
                    document.getElementById(`page-${i}`)?.scrollIntoView({ block: "start" });
                  }
                : undefined
            }
          />
        </div>
      ))}
      <div onClick={(e) => e.stopPropagation()}>{footer}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Modo por páginas
function PagedView({
  pages,
  page,
  fit,
  rtl,
  onStep,
  onToggleUi,
}: {
  pages: string[];
  page: number;
  fit: ReaderFit;
  rtl: boolean;
  onStep: (d: number) => void;
  onToggleUi: () => void;
}) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  const imgClass =
    fit === "height"
      ? "mx-auto max-h-dvh w-auto max-w-full object-contain"
      : fit === "width"
        ? "mx-auto w-full max-w-5xl h-auto"
        : "mx-auto max-w-none";

  const onClick = (e: React.MouseEvent) => {
    const x = e.clientX / window.innerWidth;
    if (x > 0.3 && x < 0.7) return onToggleUi();
    const forward = x >= 0.7 ? !rtl : rtl;
    onStep(forward ? 1 : -1);
  };

  return (
    <div className="relative flex min-h-dvh cursor-pointer items-center justify-center overflow-x-auto" onClick={onClick}>
      <PageImage key={pages[page]} src={pages[page]} index={page} eager className={imgClass} />
      {/* Precarga de las siguientes páginas */}
      <div className="hidden">
        {[1, 2, 3].map((d) =>
          pages[page + d] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={pages[page + d]} src={pages[page + d]} alt="" loading="eager" />
          ) : null,
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Fin del capítulo
function ChapterEnd({
  next,
  backHref,
  onBack,
  onNext,
}: {
  next?: Chapter;
  backHref: string;
  onBack: (e: React.MouseEvent) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
      <p className="text-sm text-muted">Fin del capítulo</p>
      {next ? (
        <button
          onClick={onNext}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-bold text-accent-fg transition hover:brightness-110"
        >
          Siguiente: {next.name} <ChevronRight className="size-4" />
        </button>
      ) : (
        <p className="font-semibold">¡Estás al día! No hay más capítulos.</p>
      )}
      <Link href={backHref} onClick={onBack} className="text-sm font-medium text-accent hover:underline">
        Volver a la ficha
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------- Ajustes rápidos
/** Selector segmentado (un grupo de botones conmutables). */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-semibold text-muted">{label}</span>
      <div role="group" aria-label={label} className="flex rounded-xl bg-surface-2 p-1 text-xs font-semibold">
        {options.map(([v, text]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            aria-pressed={value === v}
            className={`min-h-10 flex-1 rounded-lg px-3 py-2 ${value === v ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-fg"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReaderPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSettings();

  return (
    <Modal open={open} onClose={onClose} title="Ajustes del lector">
      <div className="space-y-4 text-sm">
        <Segmented
          label="Modo de lectura"
          value={s.readerMode}
          onChange={(v) => s.set({ readerMode: v })}
          options={[["webtoon", "Cascada"], ["paged", "Páginas"]]}
        />
        {s.readerMode === "paged" && (
          <Segmented
            label="Dirección"
            value={s.readerDirection}
            onChange={(v) => s.set({ readerDirection: v })}
            options={[["ltr", "Izq. → Der."], ["rtl", "Der. → Izq. (manga)"]]}
          />
        )}
        <Segmented
          label="Ajuste de imagen"
          value={s.readerFit}
          onChange={(v) => s.set({ readerFit: v })}
          options={[["width", "Ancho"], ["height", "Alto"], ["original", "Original"]]}
        />
        {s.readerMode === "webtoon" && (
          <>
            <label className="block space-y-1.5">
              <span className="flex justify-between text-xs font-semibold text-muted">
                Ancho máximo <span>{s.webtoonMaxWidth ? `${s.webtoonMaxWidth}px` : "Completo"}</span>
              </span>
              <input
                type="range"
                min={400}
                max={1700}
                step={50}
                value={s.webtoonMaxWidth || 1700}
                aria-valuetext={s.webtoonMaxWidth ? `${s.webtoonMaxWidth} píxeles` : "Ancho completo"}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  s.set({ webtoonMaxWidth: v >= 1700 ? 0 : v });
                }}
                className="h-8 w-full accent-[var(--accent)]"
              />
            </label>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">Separación entre páginas</span>
              <Toggle checked={s.webtoonGap} onChange={(v) => s.set({ webtoonGap: v })} label="Separación entre páginas" />
            </div>
          </>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted">
            Precargar siguiente capítulo
            <span className="block font-normal">Al acercarte al final, para que se abra al instante.</span>
          </span>
          <Toggle checked={s.preloadNext} onChange={(v) => s.set({ preloadNext: v })} label="Precargar siguiente capítulo" />
        </div>
        <p className="hidden border-t border-border pt-3 text-xs text-muted sm:block">
          Atajos: ← → pasar página · N / P capítulo · Esc salir
        </p>
      </div>
    </Modal>
  );
}
