"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Command, Search } from "lucide-react";
import { api, coverUrl } from "@/lib/api";
import { Cover } from "@/components/ui";

/** Buscador rápido de la biblioteca (Ctrl/Cmd+K), disponible en toda la web salvo el lector. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const library = useQuery({ queryKey: ["library"], queryFn: api.library, enabled: open });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = library.data ?? [];
    if (!q) return all.slice(0, 8);
    return all.filter((m) => m.title.toLowerCase().includes(q)).slice(0, 20);
  }, [library.data, query]);

  // Ctrl/Cmd+K abre el buscador desde cualquier página (salvo el lector).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("cattus:open-search", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("cattus:open-search", onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  const go = (id: number) => {
    setOpen(false);
    router.push(`/manga/${id}`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en tu biblioteca…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[index]) {
                go(results[index].id);
              }
            }}
          />
          <kbd className="hidden shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted sm:block">
            Esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {library.isPending ? (
            <p className="px-3 py-6 text-center text-sm text-muted">Cargando biblioteca…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">
              {query ? `Nada coincide con «${query}».` : "Tu biblioteca está vacía."}
            </p>
          ) : (
            results.map((m, i) => (
              <button
                key={m.id}
                onClick={() => go(m.id)}
                onMouseEnter={() => setIndex(i)}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${
                  i === index ? "bg-accent-soft" : "hover:bg-surface-2"
                }`}
              >
                <Cover src={coverUrl(m)} alt={m.title} className="h-12 w-9 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className={`line-clamp-1 text-sm font-semibold ${i === index ? "text-accent" : ""}`}>{m.title}</p>
                  {m.source && <p className="truncate text-xs text-muted">{m.source.displayName}</p>}
                </div>
                {m.unreadCount > 0 && (
                  <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-fg">
                    {m.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-1.5 border-t border-border px-4 py-2 text-[11px] text-muted">
          <Command className="size-3" /> K para abrir · ↑↓ para moverte · Enter para abrir
        </div>
      </div>
    </div>
  );
}
