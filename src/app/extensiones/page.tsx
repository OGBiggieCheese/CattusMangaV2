"use client";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpCircle, Database, Download, GripVertical, Plus, Puzzle, RefreshCw, Trash2, X } from "lucide-react";
import { api, swUrl, type Extension } from "@/lib/api";
import { langName } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import { Button, EmptyState, ErrorBox, PageHeader, SearchInput, Spinner, Toggle } from "@/components/ui";
import { confirmAction } from "@/components/Confirm";

const PAGE = 60;

export default function ExtensionsPage() {
  const qc = useQueryClient();
  const { extLang, showNsfw, sourceOrder, set } = useSettings();
  const [search, setSearch] = useState("");
  const [showStores, setShowStores] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  // Descarga los índices de los repositorios una vez por sesión (luego usa la caché).
  const exts = useQuery({ queryKey: ["extensions"], queryFn: api.refreshExtensions, staleTime: 30 * 60_000 });

  const action = useMutation({
    mutationFn: ({ ext, op }: { ext: Extension; op: "install" | "uninstall" | "update" }) =>
      api.updateExtension(ext.pkgName, { [op]: true }),
    meta: { errorMessage: "No se pudo completar la operación con la extensión" },
    onSettled: async () => {
      qc.setQueryData(["extensions"], await api.extensions());
      qc.invalidateQueries({ queryKey: ["sources"] });
    },
  });

  const langs = useMemo(() => {
    const count = new Map<string, number>();
    for (const e of exts.data ?? []) if (e.lang !== "all") count.set(e.lang, (count.get(e.lang) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
  }, [exts.data]);

  const { updates, installed, available } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (e: Extension) => !q || e.name.toLowerCase().includes(q) || e.pkgName.includes(q);
    const list = (exts.data ?? [])
      .filter((e) => !e.isObsolete || e.isInstalled)
      .filter((e) => showNsfw || e.contentWarning !== "NSFW" || e.isInstalled)
      .filter((e) => !extLang || e.lang === extLang || e.lang === "all" || e.isInstalled);

    // El orden de las instaladas se conserva completo (sin el filtro de búsqueda) para no perder posiciones al arrastrar.
    const orderIndex = (name: string) => {
      const i = sourceOrder.indexOf(name);
      return i === -1 ? Infinity : i;
    };
    const installedAll = list
      .filter((e) => e.isInstalled && !e.hasUpdate)
      .sort((a, b) => orderIndex(a.name) - orderIndex(b.name) || a.name.localeCompare(b.name));

    return {
      updates: list.filter((e) => e.hasUpdate && matches(e)).sort((a, b) => a.name.localeCompare(b.name)),
      installed: installedAll.filter(matches),
      available: list.filter((e) => !e.isInstalled && matches(e)).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [exts.data, search, showNsfw, extLang, sourceOrder]);

  const canReorder = !search.trim();
  const dragIndex = useRef<number | null>(null);
  const reorderInstalled = (from: number, to: number) => {
    if (from === to) return;
    const names = installed.map((e) => e.name);
    const [moved] = names.splice(from, 1);
    names.splice(to, 0, moved);
    set({ sourceOrder: names });
  };

  const uninstall = async (ext: Extension) => {
    const ok = await confirmAction({
      title: `¿Quitar la extensión «${ext.name}»?`,
      message: "Los mangas de esta fuente seguirán en tu biblioteca, pero no podrás buscar capítulos nuevos ni leer los no descargados hasta que la vuelvas a instalar.",
      confirmLabel: "Quitar",
      danger: true,
    });
    if (ok) action.mutate({ ext, op: "uninstall" });
  };

  const busy = (pkg: string) => action.isPending && action.variables?.ext.pkgName === pkg;

  return (
    <>
      <PageHeader
        title="Extensiones"
        subtitle="Cada extensión es una fuente de manga. Instala las que quieras y aparecerán en Explorar."
        actions={
          <>
            <Button onClick={() => setShowStores((v) => !v)}>
              <Database className="size-4" /> Repositorios
            </Button>
            <Button onClick={() => exts.refetch()} loading={exts.isFetching}>
              {!exts.isFetching && <RefreshCw className="size-4" />} Actualizar
            </Button>
          </>
        }
      />

      {showStores && <StoresPanel onClose={() => setShowStores(false)} />}

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar extensión…" className="flex-1" />
        <select
          value={extLang}
          onChange={(e) => set({ extLang: e.target.value })}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
        >
          <option value="">Todos los idiomas</option>
          {langs.map((l) => (
            <option key={l} value={l}>
              {langName(l)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2.5 px-1 text-sm text-muted">
          <Toggle checked={showNsfw} onChange={(v) => set({ showNsfw: v })} label="Mostrar +18" />
          Mostrar +18
        </label>
      </div>

      {exts.isPending ? (
        <Spinner label="Leyendo repositorios…" />
      ) : exts.isError ? (
        <ErrorBox error={exts.error} onRetry={() => exts.refetch()} />
      ) : (exts.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Puzzle}
          title="No hay repositorios"
          text="Añade un repositorio de extensiones (por ejemplo, Keiyoushi) para ver las fuentes disponibles."
          action={<Button variant="primary" onClick={() => setShowStores(true)}><Plus className="size-4" /> Añadir repositorio</Button>}
        />
      ) : (
        <div className="space-y-8">
          {updates.length > 0 && (
            <Section title="Actualizaciones" count={updates.length}>
              {updates.map((e) => (
                <ExtensionRow key={e.pkgName} ext={e} busy={busy(e.pkgName)}>
                  <Button size="sm" variant="primary" onClick={() => action.mutate({ ext: e, op: "update" })} loading={busy(e.pkgName)}>
                    {!busy(e.pkgName) && <ArrowUpCircle className="size-3.5" />} Actualizar
                  </Button>
                </ExtensionRow>
              ))}
            </Section>
          )}
          <Section title="Instaladas" count={installed.length}>
            {installed.length === 0 ? (
              <p className="px-1 py-3 text-sm text-muted">Aún no has instalado ninguna. Elige una de la lista de abajo.</p>
            ) : (
              installed.map((e, i) => (
                <ExtensionRow
                  key={e.pkgName}
                  ext={e}
                  busy={busy(e.pkgName)}
                  draggable={canReorder}
                  onDragStart={() => (dragIndex.current = i)}
                  onDragOver={(ev) => ev.preventDefault()}
                  onDrop={() => {
                    if (dragIndex.current !== null) reorderInstalled(dragIndex.current, i);
                    dragIndex.current = null;
                  }}
                >
                  <Button size="sm" variant="danger" onClick={() => uninstall(e)} loading={busy(e.pkgName)}>
                    {!busy(e.pkgName) && <Trash2 className="size-3.5" />} Quitar
                  </Button>
                </ExtensionRow>
              ))
            )}
          </Section>
          <Section title="Disponibles" count={available.length}>
            {available.slice(0, limit).map((e) => (
              <ExtensionRow key={e.pkgName} ext={e} busy={busy(e.pkgName)}>
                <Button size="sm" variant="primary" onClick={() => action.mutate({ ext: e, op: "install" })} loading={busy(e.pkgName)}>
                  {!busy(e.pkgName) && <Download className="size-3.5" />} Instalar
                </Button>
              </ExtensionRow>
            ))}
            {available.length > limit && (
              <div className="pt-2 text-center sm:col-span-2 xl:col-span-3">
                <Button onClick={() => setLimit((l) => l + PAGE)}>Mostrar más ({available.length - limit})</Button>
              </div>
            )}
          </Section>
        </div>
      )}
    </>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted">
        {title}
        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-semibold normal-case">{count}</span>
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function ExtensionRow({
  ext,
  busy,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  children,
}: {
  ext: Extension;
  busy: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition ${busy ? "opacity-70" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {draggable && <GripVertical className="size-4 shrink-0 text-muted" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={swUrl(ext.iconUrl)} alt="" loading="lazy" className="size-11 shrink-0 rounded-xl bg-surface-2" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{ext.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          <span className="rounded bg-surface-2 px-1.5 py-px font-semibold uppercase">{ext.lang}</span>
          <span>v{ext.versionName}</span>
          {ext.contentWarning === "NSFW" && <span className="rounded bg-danger/15 px-1.5 py-px font-bold text-danger">+18</span>}
          {ext.isObsolete && <span className="rounded bg-danger/15 px-1.5 py-px font-bold text-danger">Obsoleta</span>}
        </div>
      </div>
      {children}
    </div>
  );
}

function StoresPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const stores = useQuery({ queryKey: ["stores"], queryFn: api.stores });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stores"] });
    qc.invalidateQueries({ queryKey: ["extensions"] });
  };
  const add = useMutation({
    mutationFn: (u: string) => api.addStore(u),
    // El error se muestra junto al formulario.
    meta: { silent: true },
    onSuccess: () => {
      setUrl("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (u: string) => api.removeStore(u),
    meta: { errorMessage: "No se pudo quitar el repositorio" },
    onSuccess: refresh,
  });
  const confirmRemove = async (store: { name: string; indexUrl: string }) => {
    const ok = await confirmAction({
      title: `¿Quitar el repositorio «${store.name}»?`,
      message: "Dejarás de ver sus extensiones disponibles y sus actualizaciones. Las ya instaladas no se borran.",
      confirmLabel: "Quitar",
      danger: true,
    });
    if (ok) remove.mutate(store.indexUrl);
  };

  return (
    <div className="mb-6 rounded-2xl border border-accent/40 bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold">Repositorios de extensiones</h2>
          <p className="mt-1 text-sm text-muted">
            Compatibles con Mihon. Pega la URL del índice (<code className="text-xs">index.pb</code> o{" "}
            <code className="text-xs">index.min.json</code>).
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Cerrar">
          <X className="size-4" />
        </button>
      </div>

      {stores.isPending ? (
        <Spinner />
      ) : stores.isError ? (
        <ErrorBox error={stores.error} onRetry={() => stores.refetch()} />
      ) : (
        <ul className="mb-4 space-y-2">
          {stores.data.length === 0 && <li className="text-sm text-muted">No hay repositorios todavía.</li>}
          {stores.data.map((s) => (
            <li key={s.indexUrl} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
              <span className="rounded-md bg-accent-soft px-2 py-1 text-[11px] font-bold text-accent">{s.badgeLabel || "REPO"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {s.name} <span className="font-normal text-muted">· {s.extensions.totalCount} extensiones</span>
                </p>
                <p className="truncate text-xs text-muted">{s.indexUrl}</p>
              </div>
              <Button size="sm" variant="ghost" aria-label={`Quitar el repositorio ${s.name}`} onClick={() => confirmRemove(s)} loading={remove.isPending && remove.variables === s.indexUrl}>
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) add.mutate(url.trim());
        }}
      >
        <label htmlFor="store-url" className="sr-only">
          URL del índice del repositorio
        </label>
        <input
          id="store-url"
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.pb"
          className="h-11 flex-1 rounded-xl border border-border bg-bg px-3 text-base outline-none sm:h-10 sm:text-sm placeholder:text-muted focus:border-accent"
        />
        <Button variant="primary" type="submit" loading={add.isPending} disabled={!url.trim()}>
          <Plus className="size-4" /> Añadir
        </Button>
      </form>
      {add.isError && <p role="alert" className="mt-2 text-sm text-danger">{(add.error as Error).message}</p>}
    </div>
  );
}
