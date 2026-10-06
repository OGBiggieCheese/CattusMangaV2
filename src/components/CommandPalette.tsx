"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Command, Search } from "lucide-react";
import { api, coverUrl } from "@/lib/api";
import { Cover } from "@/components/ui";
import { Modal } from "@/components/Modal";

const LIST_ID = "command-palette-results";
const optionId = (i: number) => `command-palette-option-${i}`;

/** Buscador rápido de la biblioteca (Ctrl/Cmd+K), disponible en toda la web salvo el lector. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

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
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  // Mantiene visible la opción seleccionada al moverse con el teclado.
  useEffect(() => {
    document.getElementById(optionId(index))?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const go = (id: number) => {
    setOpen(false);
    router.push(`/manga/${id}`);
  };

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Buscar en tu biblioteca" hideTitle position="top" width="lg">
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search className="size-4 shrink-0 text-muted" aria-hidden />
        <input
          data-autofocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en tu biblioteca…"
          aria-label="Buscar en tu biblioteca"
          role="combobox"
          aria-expanded
          aria-autocomplete="list"
          aria-controls={LIST_ID}
          aria-activedescendant={results[index] ? optionId(index) : undefined}
          enterKeyHint="go"
          // 16 px en móvil: con menos, iOS hace zoom al enfocar el campo.
          className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted sm:text-sm"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
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
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="-mr-2 shrink-0 rounded-lg px-2 py-2 text-sm font-medium text-accent sm:hidden"
        >
          Cancelar
        </button>
      </div>

      <div className="max-h-[60dvh] overflow-y-auto p-2">
        {library.isPending ? (
          <p className="px-3 py-6 text-center text-sm text-muted">Cargando biblioteca…</p>
        ) : results.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted" role="status">
            {query ? `Nada coincide con «${query}».` : "Tu biblioteca está vacía."}
          </p>
        ) : (
          <ul id={LIST_ID} role="listbox" aria-label="Resultados">
            {results.map((m, i) => (
              <li
                key={m.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === index}
                onClick={() => go(m.id)}
                onMouseEnter={() => setIndex(i)}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left ${
                  i === index ? "bg-accent-soft" : "hover:bg-surface-2"
                }`}
              >
                <Cover src={coverUrl(m)} alt="" className="h-12 w-9 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className={`line-clamp-1 text-sm font-semibold ${i === index ? "text-accent" : ""}`}>{m.title}</p>
                  {m.source && <p className="truncate text-xs text-muted">{m.source.displayName}</p>}
                </div>
                {m.unreadCount > 0 && (
                  <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-fg">
                    <span className="sr-only">Sin leer: </span>
                    {m.unreadCount}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hidden items-center gap-1.5 border-t border-border px-4 py-2 text-[11px] text-muted sm:flex">
        <Command className="size-3" /> K para abrir · ↑↓ para moverte · Enter para abrir
      </div>
    </Modal>
  );
}
