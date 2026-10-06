"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { Clock, ExternalLink, Flame, Globe, Loader2, Puzzle, RefreshCw, SearchX, SlidersHorizontal } from "lucide-react";
import { api, safeHref, swUrl, type FilterValues, type Source } from "@/lib/api";
import { langName } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import {
  Button,
  Chip,
  EmptyState,
  ErrorBox,
  GRID,
  MangaCard,
  MangaGridSkeleton,
  PageHeader,
  SearchInput,
  Spinner,
} from "@/components/ui";
import { ActiveFilters, FilterPanel, hasUsableFilters, parseFilters } from "@/components/SourceFilters";

const ALL = "todas";

export default function ExplorePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Explore />
    </Suspense>
  );
}

function Explore() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const sources = useQuery({ queryKey: ["sources"], queryFn: api.sources });
  const sourceOrder = useSettings((s) => s.sourceOrder);

  const list = sources.data ?? [];
  const selectedId = params.get("fuente") ?? ALL;
  const query = params.get("q") ?? "";
  const tab = (params.get("tab") as "POPULAR" | "LATEST" | null) ?? "POPULAR";
  const filters = parseFilters(params.get("filtros"));
  const source = list.find((s) => s.id === selectedId);

  // Una fuente puede tener varias variantes de idioma con el mismo nombre: se agrupan en un solo chip.
  const groups: SourceGroup[] = [];
  for (const s of list) {
    const g = groups.find((g) => g.name === s.name);
    if (g) g.sources.push(s);
    else groups.push({ name: s.name, iconUrl: s.iconUrl, sources: [s] });
  }
  // Respeta el orden elegido arrastrando las extensiones en /extensiones; las nuevas van al final.
  const orderIndex = (name: string) => {
    const i = sourceOrder.indexOf(name);
    return i === -1 ? Infinity : i;
  };
  groups.sort((a, b) => orderIndex(a.name) - orderIndex(b.name));
  const siblings = source ? groups.find((g) => g.name === source.name)!.sources : [];

  const navigate = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  if (sources.isPending) return <Spinner label="Cargando fuentes…" />;
  if (sources.isError) return <ErrorBox error={sources.error} onRetry={() => sources.refetch()} />;
  if (!list.length)
    return (
      <>
        <PageHeader title="Explorar" />
        <EmptyState
          icon={Puzzle}
          title="No tienes fuentes instaladas"
          text="Instala al menos una extensión para explorar su catálogo."
          action={
            <Link href="/extensiones" className="mt-2 inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg">
              <Puzzle className="size-4" /> Ir a Extensiones
            </Link>
          }
        />
      </>
    );

  return (
    <>
      <PageHeader title="Explorar" subtitle="Elige una fuente para navegar por su catálogo, o busca en todas a la vez." />

      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <Chip active={selectedId === ALL} onClick={() => navigate({ fuente: ALL, tab: null, filtros: null })}>
          <Globe className="size-4" /> Todas
        </Chip>
        {groups.map((g) => (
          <Chip
            key={g.name}
            active={source?.name === g.name}
            onClick={() => navigate({ fuente: g.sources.find((s) => s.id === selectedId)?.id ?? g.sources[0].id, q: null, tab: null, filtros: null })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={swUrl(g.iconUrl)} alt="" className="size-5 rounded-md" />
            {g.name}
            {g.sources.length > 1 && <span className="text-[10px] font-normal text-muted">{g.sources.length}</span>}
          </Chip>
        ))}
      </div>

      {selectedId === ALL ? (
        <GlobalSearch groups={groups} query={query} onSearch={(q) => navigate({ q: q || null })} />
      ) : source ? (
        <SourceBrowser
          key={source.id}
          source={source}
          siblings={siblings}
          tab={tab}
          query={query}
          filters={filters}
          onTab={(t) => navigate({ tab: t === "POPULAR" ? null : t, q: null, filtros: null })}
          onSearch={(q) => navigate({ q: q || null })}
          onFilters={(f) => navigate({ filtros: Object.keys(f).length ? JSON.stringify(f) : null })}
          onLangChange={(id) => navigate({ fuente: id, q: null, tab: null, filtros: null })}
        />
      ) : (
        <ErrorBox error="Esa fuente ya no está instalada." />
      )}
    </>
  );
}

function SourceBrowser({
  source,
  siblings,
  tab,
  query,
  filters,
  onTab,
  onSearch,
  onFilters,
  onLangChange,
}: {
  source: Source;
  siblings: Source[];
  tab: "POPULAR" | "LATEST";
  query: string;
  filters: FilterValues;
  onTab: (t: "POPULAR" | "LATEST") => void;
  onSearch: (q: string) => void;
  onFilters: (f: FilterValues) => void;
  onLangChange: (id: string) => void;
}) {
  const [text, setText] = useState(query);
  useEffect(() => setText(query), [query]);
  const [showFilters, setShowFilters] = useState(false);
  const filterCount = Object.keys(filters).length;
  const filtered = filterCount > 0;
  const type = query || filtered ? "SEARCH" : tab;

  // Los filtros los declara la extensión: Suwayomi los devuelve sin consultar la web.
  const filterDefs = useQuery({
    queryKey: ["filters", source.id],
    queryFn: () => api.sourceFilters(source.id),
    staleTime: Infinity,
  });
  const canFilter = !!filterDefs.data && hasUsableFilters(filterDefs.data);

  const browse = useInfiniteQuery({
    queryKey: ["browse", source.id, type, query, filters],
    queryFn: ({ pageParam }) => api.browse(source.id, type, pageParam, query, filters),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.hasNextPage ? pages.length + 1 : undefined),
    staleTime: 10 * 60_000,
  });

  // Carga automática al llegar al final de la lista.
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = browse;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage || isFetchingNextPage || isError) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && fetchNextPage(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage, browse.data]);

  // Algunas fuentes repiten mangas entre páginas.
  const seen = new Set<number>();
  const mangas = (browse.data?.pages ?? []).flatMap((p) => p.mangas).filter((m) => !seen.has(m.id) && seen.add(m.id));

  return (
    <>
      <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={swUrl(source.iconUrl)} alt="" className="size-11 rounded-xl bg-surface-2" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-bold">
              {source.name}
              {safeHref(source.homeUrl) && (
                <a href={safeHref(source.homeUrl)!} target="_blank" rel="noreferrer" className="text-muted hover:text-accent" title="Abrir web original">
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </p>
            {siblings.length > 1 ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {siblings.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onLangChange(s.id)}
                    className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                      s.id === source.id ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-fg"
                    }`}
                  >
                    {langName(s.lang)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">{langName(source.lang)}</p>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={() => browse.refetch()} loading={browse.isRefetching}>
            {!browse.isRefetching && <RefreshCw className="size-3.5" />} Recargar
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
          <div className="flex gap-2">
            <Chip active={!query && !filtered && tab === "POPULAR"} onClick={() => onTab("POPULAR")}>
              <Flame className="size-4" /> Populares
            </Chip>
            {source.supportsLatest && (
              <Chip active={!query && !filtered && tab === "LATEST"} onClick={() => onTab("LATEST")}>
                <Clock className="size-4" /> Últimos
              </Chip>
            )}
          </div>
          <SearchInput
            value={text}
            onChange={setText}
            onSubmit={() => onSearch(text.trim())}
            placeholder={`Buscar en ${source.name}…`}
            className="flex-1 sm:ml-auto sm:max-w-sm"
          />
          {canFilter && (
            <Chip active={showFilters || filtered} onClick={() => setShowFilters((v) => !v)}>
              <SlidersHorizontal className="size-4" /> Filtros
              {filtered && (
                <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-fg">
                  {filterCount}
                </span>
              )}
            </Chip>
          )}
        </div>
        {showFilters && filterDefs.data && (
          <FilterPanel
            key={JSON.stringify(filters)}
            filters={filterDefs.data}
            values={filters}
            onApply={(f) => {
              setShowFilters(false);
              onFilters(f);
            }}
          />
        )}
      </div>

      {filterDefs.data && <ActiveFilters filters={filterDefs.data} values={filters} onChange={onFilters} />}

      {query && (
        <p className="mb-4 text-sm text-muted">
          Resultados para <strong className="text-fg">«{query}»</strong>{" "}
          <button className="ml-1 text-accent hover:underline" onClick={() => onSearch("")}>
            Limpiar
          </button>
        </p>
      )}

      {browse.isPending ? (
        <MangaGridSkeleton />
      ) : browse.isError && !mangas.length ? (
        <ErrorBox error={browse.error} onRetry={() => browse.refetch()} />
      ) : !mangas.length ? (
        <EmptyState icon={SearchX} title="Sin resultados" text="La fuente no devolvió ningún manga." />
      ) : (
        <>
          <div className={GRID}>
            {mangas.map((m) => (
              <MangaCard key={m.id} manga={m} />
            ))}
          </div>
          <div ref={sentinel} className="mt-8 flex justify-center">
            {browse.isFetchingNextPage ? (
              <Spinner />
            ) : browse.isError ? (
              <Button onClick={() => browse.fetchNextPage()}>Reintentar</Button>
            ) : browse.hasNextPage ? (
              <Button onClick={() => browse.fetchNextPage()}>Cargar más</Button>
            ) : (
              <p className="text-sm text-muted">Has llegado al final.</p>
            )}
          </div>
        </>
      )}
    </>
  );
}

type SourceGroup = { name: string; iconUrl: string; sources: Source[] };

function GlobalSearch({ groups, query, onSearch }: { groups: SourceGroup[]; query: string; onSearch: (q: string) => void }) {
  const [text, setText] = useState(query);
  useEffect(() => setText(query), [query]);
  const [picking, setPicking] = useState(false);
  const { extLang, globalSearchExclude, set } = useSettings();

  // Una sola variante por fuente (la de tu idioma, la multi-idioma o la primera): buscar en las
  // diez variantes de idioma de una misma web multiplica las peticiones sin aportar casi nada.
  const pick = (g: SourceGroup) =>
    g.sources.find((s) => s.lang === extLang) ?? g.sources.find((s) => s.lang === "all") ?? g.sources[0];
  const targets = groups.filter((g) => !globalSearchExclude.includes(g.name)).map(pick);

  const results = useQueries({
    queries: targets.map((s) => ({
      queryKey: ["global-search", s.id, query],
      queryFn: () => api.globalSearch(s.id, query),
      enabled: !!query,
      staleTime: 10 * 60_000,
      retry: 0,
    })),
  });

  const rows = targets.map((source, i) => ({ source, r: results[i] }));
  // Las fuentes con resultados se añaden al final según van llegando, para que nada salte de sitio.
  const found = rows.filter((x) => x.r.data?.mangas.length).sort((a, b) => a.r.dataUpdatedAt - b.r.dataUpdatedAt);
  const pending = rows.filter((x) => x.r.isFetching && !x.r.data);
  const empty = rows.filter((x) => x.r.data && !x.r.data.mangas.length);
  const failed = rows.filter((x) => x.r.isError && !x.r.isFetching);

  const toggle = (name: string) =>
    set({
      globalSearchExclude: globalSearchExclude.includes(name)
        ? globalSearchExclude.filter((n) => n !== name)
        : [...globalSearchExclude, name],
    });

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={text}
          onChange={setText}
          onSubmit={() => onSearch(text.trim())}
          placeholder={`Buscar en ${targets.length} ${targets.length === 1 ? "fuente" : "fuentes"}…`}
          className="max-w-xl flex-1"
        />
        <Chip active={picking} onClick={() => setPicking((v) => !v)}>
          <SlidersHorizontal className="size-4" /> Fuentes
          <span className="text-xs text-muted">
            {targets.length}/{groups.length}
          </span>
        </Chip>
      </div>

      {picking && (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted">Elige en qué fuentes buscar. Se recuerda en este navegador.</p>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => set({ globalSearchExclude: [] })}>
                Todas
              </Button>
              <Button size="sm" variant="ghost" onClick={() => set({ globalSearchExclude: groups.map((g) => g.name) })}>
                Ninguna
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => {
              const on = !globalSearchExclude.includes(g.name);
              const variant = pick(g);
              return (
                <button
                  key={g.name}
                  onClick={() => toggle(g.name)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition ${
                    on ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-muted line-through hover:text-fg"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={swUrl(g.iconUrl)} alt="" className="size-4 rounded" />
                  {g.name}
                  {g.sources.length > 1 && <span className="font-normal opacity-70">{langName(variant.lang)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!query ? (
        <EmptyState icon={Globe} title="Búsqueda global" text="Escribe un título y lo buscaremos en todas tus fuentes a la vez." />
      ) : !targets.length ? (
        <EmptyState icon={SearchX} title="No hay fuentes seleccionadas" text="Pulsa «Fuentes» y elige al menos una." />
      ) : (
        <div className="space-y-8">
          {found.map(({ source: s, r }) => (
            <section key={s.id}>
              <h2 className="mb-3 flex items-center gap-2 font-bold">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={swUrl(s.iconUrl)} alt="" className="size-6 rounded-md" />
                {s.name}
                <span className="text-sm font-normal text-muted">· {r.data!.mangas.length}</span>
                <Link href={`/explorar?fuente=${s.id}&q=${encodeURIComponent(query)}`} className="ml-auto text-sm font-medium text-accent hover:underline">
                  Ver todo
                </Link>
              </h2>
              <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
                {r.data!.mangas.map((m) => (
                  <div key={m.id} className="w-32 shrink-0 sm:w-36">
                    <MangaCard manga={m} />
                  </div>
                ))}
              </div>
            </section>
          ))}

          {pending.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted">
              <Loader2 className="size-4 animate-spin text-accent" />
              Buscando en {pending.length} de {targets.length}:
              {pending.map(({ source: s }) => (
                <span key={s.id} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={swUrl(s.iconUrl)} alt="" className="size-3.5 rounded" />
                  {s.name}
                </span>
              ))}
            </div>
          )}

          {!pending.length && !found.length && (
            <EmptyState icon={SearchX} title="Sin resultados" text={`Ninguna fuente encontró «${query}».`} />
          )}

          {(empty.length > 0 || failed.length > 0) && (
            <div className="space-y-2 text-sm">
              {empty.length > 0 && (
                <p className="text-muted">
                  <span className="font-semibold">Sin resultados en:</span> {empty.map((x) => x.source.name).join(", ")}
                </p>
              )}
              {failed.map(({ source: s, r }) => (
                <p key={s.id} className="flex flex-wrap items-center gap-x-2 text-danger">
                  <span className="font-semibold">{s.name}:</span>
                  <span className="text-muted">{(r.error as Error).message}</span>
                  <button onClick={() => r.refetch()} className="font-medium text-accent hover:underline">
                    Reintentar
                  </button>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
