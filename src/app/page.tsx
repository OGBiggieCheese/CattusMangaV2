"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  BookOpen,
  Compass,
  FolderPlus,
  HardDrive,
  Layers,
  Library,
  Play,
  Puzzle,
  Settings2,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { api, coverUrl, type Category, type HistoryEntry, type LibraryManga } from "@/lib/api";
import { Button, Cover, EmptyState, ErrorBox, GRID, MangaCard, MangaGridSkeleton, PageHeader, SearchInput } from "@/components/ui";
import { NO_LIBRARY_FILTERS, useSettings, type LibrarySort } from "@/lib/settings";

const ALL = "todas";
const UNCATEGORIZED = "sin-categoria";

const SORTS: [LibrarySort, string][] = [
  ["added", "Fecha añadido"],
  ["lastRead", "Última lectura"],
  ["updated", "Último capítulo"],
  ["unread", "Capítulos sin leer"],
  ["title", "Título"],
];

/** Suwayomi mezcla segundos y milisegundos según el campo: se normaliza a ms. */
const ms = (v?: string | null) => {
  const n = Number(v ?? 0);
  return n < 1e12 ? n * 1000 : n;
};

function sortValue(m: LibraryManga, by: LibrarySort): number | string {
  switch (by) {
    case "added":
      return ms(m.inLibraryAt);
    case "lastRead":
      return ms(m.lastReadChapter?.lastReadAt);
    case "updated":
      return ms(m.latestUploadedChapter?.uploadDate) || ms(m.latestFetchedChapter?.fetchedAt);
    case "unread":
      return m.unreadCount;
    case "title":
      return m.title.toLowerCase();
  }
}

export default function LibraryPage() {
  const library = useQuery({ queryKey: ["library"], queryFn: api.library });
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string>(ALL);
  const [managing, setManaging] = useState(false);
  const { librarySort, librarySortDesc, libraryFilters: f } = useSettings();

  const mangas = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const out = (library.data ?? []).filter((m) => {
      if (q && !m.title.toLowerCase().includes(q)) return false;
      if (f.unread && m.unreadCount === 0) return false;
      if (f.downloaded && m.downloadCount === 0) return false;
      if (f.source && m.source?.id !== f.source) return false;
      if (selected === ALL) return true;
      if (selected === UNCATEGORIZED) return m.categories.nodes.length === 0;
      return m.categories.nodes.some((c) => String(c.id) === selected);
    });
    const dir = librarySortDesc ? -1 : 1;
    return out.sort((a, b) => {
      const va = sortValue(a, librarySort);
      const vb = sortValue(b, librarySort);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
      return cmp * dir || a.title.localeCompare(b.title);
    });
  }, [library.data, filter, selected, f, librarySort, librarySortDesc]);
  const filtered = f.unread || f.downloaded || !!f.source;

  const cats = categories.data ?? [];

  return (
    <>
      <ContinueReading />
      <PageHeader
        title="Biblioteca"
        subtitle={
          !library.data
            ? "Tus mangas guardados"
            : mangas.length === library.data.length
              ? `${library.data.length} títulos guardados`
              : `${mangas.length} de ${library.data.length} títulos`
        }
        actions={
          (library.data?.length ?? 0) > 0 && (
            <SearchInput value={filter} onChange={setFilter} placeholder="Filtrar biblioteca…" className="w-full sm:w-64" />
          )
        }
      />

      {(library.data?.length ?? 0) > 0 && (
        <div className="no-scrollbar -mx-4 mb-5 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          <CategoryChip active={selected === ALL} onClick={() => setSelected(ALL)}>
            <Layers className="size-4" /> Todas
          </CategoryChip>
          {cats.map((c) => (
            <CategoryChip key={c.id} active={selected === String(c.id)} onClick={() => setSelected(String(c.id))}>
              {c.name}
            </CategoryChip>
          ))}
          <CategoryChip active={selected === UNCATEGORIZED} onClick={() => setSelected(UNCATEGORIZED)}>
            Sin categoría
          </CategoryChip>
          <button
            onClick={() => setManaging(true)}
            className="ml-1 grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-border text-muted transition hover:border-accent hover:text-accent"
            title="Gestionar categorías"
          >
            <Settings2 className="size-4" />
          </button>
        </div>
      )}

      {(library.data?.length ?? 0) > 0 && <LibraryToolbar library={library.data ?? []} />}

      {library.isPending ? (
        <MangaGridSkeleton />
      ) : library.isError ? (
        <ErrorBox error={library.error} onRetry={() => library.refetch()} />
      ) : library.data.length === 0 ? (
        <EmptyState
          icon={Library}
          title="Tu biblioteca está vacía"
          text="Instala una extensión, explora su catálogo y pulsa «Añadir a biblioteca» en cualquier manga."
          action={
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Link href="/extensiones" className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg">
                <Puzzle className="size-4" /> Instalar extensiones
              </Link>
              <Link href="/explorar" className="inline-flex h-10 items-center gap-2 rounded-xl bg-surface-2 px-4 text-sm font-semibold">
                <Compass className="size-4" /> Explorar
              </Link>
            </div>
          }
        />
      ) : mangas.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted">
          Nada coincide con los filtros actuales.
          {filtered && (
            <button className="ml-1 font-medium text-accent hover:underline" onClick={() => useSettings.getState().set({ libraryFilters: NO_LIBRARY_FILTERS })}>
              Quitar filtros
            </button>
          )}
        </div>
      ) : (
        <div className={GRID}>
          {mangas.map((m) => (
            <MangaCard
              key={m.id}
              manga={m}
              showLibraryBadge={false}
              badge={
                (m.unreadCount > 0 || m.downloadCount > 0) && (
                  <span className="flex gap-1">
                    {m.unreadCount > 0 && (
                      <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-fg" title="Sin leer">
                        {m.unreadCount}
                      </span>
                    )}
                    {m.downloadCount > 0 && (
                      <span className="flex items-center gap-0.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white backdrop-blur" title="Descargados">
                        <HardDrive className="size-3" /> {m.downloadCount}
                      </span>
                    )}
                  </span>
                )
              }
              corner={cats.length > 0 && <CategoryButton manga={m} categories={cats} />}
            />
          ))}
        </div>
      )}

      {managing && <ManageCategoriesModal categories={cats} onClose={() => setManaging(false)} />}
    </>
  );
}

/** Filtros y orden de la biblioteca. Se recuerdan en este navegador. */
function LibraryToolbar({ library }: { library: LibraryManga[] }) {
  const { librarySort, librarySortDesc, libraryFilters: f, set } = useSettings();
  const setFilter = (patch: Partial<typeof f>) => set({ libraryFilters: { ...f, ...patch } });

  const sources = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of library) if (m.source) map.set(m.source.id, m.source.displayName);
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [library]);

  const select =
    "h-9 rounded-full border border-border bg-surface px-3 text-sm font-medium text-muted outline-none transition hover:text-fg focus:border-accent";

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <CategoryChip active={f.unread} onClick={() => setFilter({ unread: !f.unread })}>
        <BookOpen className="size-4" /> Sin leer
      </CategoryChip>
      <CategoryChip active={f.downloaded} onClick={() => setFilter({ downloaded: !f.downloaded })}>
        <HardDrive className="size-4" /> Descargados
      </CategoryChip>
      {sources.length > 1 && (
        <select
          value={f.source}
          onChange={(e) => setFilter({ source: e.target.value })}
          className={`${select} max-w-48 ${f.source ? "!border-accent !bg-accent-soft !text-accent" : ""}`}
          aria-label="Fuente"
        >
          <option value="">Todas las fuentes</option>
          {sources.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        <select
          value={librarySort}
          onChange={(e) => {
            const by = e.target.value as LibrarySort;
            // El título se lee mejor de la A a la Z; el resto, de más a menos.
            set({ librarySort: by, librarySortDesc: by !== "title" });
          }}
          className={select}
          aria-label="Ordenar por"
        >
          {SORTS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <button
          onClick={() => set({ librarySortDesc: !librarySortDesc })}
          className="grid size-9 place-items-center rounded-full border border-border bg-surface text-muted transition hover:text-fg"
          title={librarySortDesc ? "Descendente" : "Ascendente"}
        >
          {librarySortDesc ? <ArrowDownWideNarrow className="size-4" /> : <ArrowUpNarrowWide className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function CategoryChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition ${
        active ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-muted hover:border-muted/50 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

/** Botón sobre la portada para asignar el manga a una o varias categorías. */
function CategoryButton({ manga, categories }: { manga: LibraryManga; categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const memberOf = new Set(manga.categories.nodes.map((c) => c.id));

  const toggle = useMutation({
    mutationFn: (categoryId: number) =>
      api.updateMangaCategories(
        manga.id,
        memberOf.has(categoryId) ? { removeFromCategories: [categoryId] } : { addToCategories: [categoryId] },
      ),
    onMutate: (categoryId) => {
      qc.setQueryData<LibraryManga[]>(["library"], (old) =>
        old?.map((m) =>
          m.id !== manga.id
            ? m
            : {
                ...m,
                categories: {
                  nodes: memberOf.has(categoryId)
                    ? m.categories.nodes.filter((c) => c.id !== categoryId)
                    : [...m.categories.nodes, { id: categoryId }],
                },
              },
        ),
      );
    },
  });

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`grid size-8 place-items-center rounded-full backdrop-blur transition ${
          memberOf.size > 0 ? "bg-accent text-accent-fg" : "bg-black/50 text-white hover:bg-black/70"
        }`}
        title="Categorías"
      >
        <Tag className="size-3.5" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-border bg-surface p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="line-clamp-1 font-bold">{manga.title}</p>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted hover:bg-surface-2" aria-label="Cerrar">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-1">
              {categories.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={memberOf.has(c.id)}
                    onChange={() => toggle.mutate(c.id)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ManageCategoriesModal({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["categories"] });

  const create = useMutation({
    mutationFn: (n: string) => api.createCategory(n),
    onSuccess: () => {
      setName("");
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteCategory(id),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["library"] });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="font-bold">Categorías</p>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-2" aria-label="Cerrar">
            <X className="size-4" />
          </button>
        </div>

        <ul className="mb-4 max-h-64 space-y-1 overflow-y-auto">
          {categories.length === 0 && <li className="py-2 text-sm text-muted">Aún no tienes categorías.</li>}
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-surface-2">
              <span className="truncate text-sm">{c.name}</span>
              <button
                onClick={() => remove.mutate(c.id)}
                disabled={remove.isPending}
                className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger/15 hover:text-danger"
                title="Eliminar categoría"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate(name.trim());
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nueva categoría…"
            className="h-10 flex-1 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent"
          />
          <Button type="submit" variant="primary" loading={create.isPending} disabled={!name.trim()}>
            {!create.isPending && <FolderPlus className="size-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

function ContinueReading() {
  const history = useQuery({ queryKey: ["history"], queryFn: () => api.history(40) });
  const items = useMemo(() => {
    const seen = new Set<number>();
    const out: HistoryEntry[] = [];
    for (const h of history.data ?? []) {
      if (api.isHiddenFromHistory(h) || seen.has(h.manga.id)) continue;
      seen.add(h.manga.id);
      out.push(h);
    }
    return out.slice(0, 12);
  }, [history.data]);

  if (!items.length) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted">
        <BookOpen className="size-4" /> Continuar leyendo
      </h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        {items.map((h) => {
          const progress = h.isRead ? 1 : h.pageCount ? (h.lastPageRead + 1) / h.pageCount : 0;
          return (
            <Link
              key={h.id}
              href={`/leer/${h.id}`}
              className="group flex w-72 shrink-0 gap-3 rounded-2xl border border-border bg-surface p-2.5 transition hover:border-accent"
            >
              <Cover src={coverUrl(h.manga)} alt={h.manga.title} className="h-24 w-16 shrink-0 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{h.manga.title}</p>
                <p className="mt-1 truncate text-xs text-muted">{h.name}</p>
                <div className="mt-auto flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                  <span className="grid size-7 place-items-center rounded-full bg-accent text-accent-fg transition group-hover:scale-110">
                    <Play className="size-3.5 fill-current" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
