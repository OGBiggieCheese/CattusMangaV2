"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellDot, Cat, CircleUser, Compass, Download, History, Library, Moon, Puzzle, Search, Settings, Sun } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { CommandPalette } from "@/components/CommandPalette";
import { useDownloadWatcher } from "@/lib/downloads";
import { useTrackNavigation } from "@/lib/nav";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; mobile?: boolean };

/** Escritorio: todo en la barra lateral. Móvil: las 5 marcadas con `mobile`; el resto se abre desde Perfil. */
export const NAV: NavItem[] = [
  { href: "/", label: "Biblioteca", icon: Library, mobile: true },
  { href: "/novedades", label: "Novedades", icon: BellDot, mobile: true },
  { href: "/explorar", label: "Explorar", icon: Compass, mobile: true },
  { href: "/historial", label: "Historial", icon: History, mobile: true },
  { href: "/descargas", label: "Descargas", icon: Download },
  { href: "/extensiones", label: "Extensiones", icon: Puzzle },
  { href: "/perfil", label: "Perfil", icon: CircleUser, mobile: true },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

/** Secciones que en el móvil cuelgan de Perfil. */
const UNDER_PROFILE = ["/descargas", "/extensiones", "/ajustes"];

const isActive = (pathname: string, href: string, mobile = false) => {
  if (href === "/") return pathname === "/" || pathname.startsWith("/manga");
  if (mobile && href === "/perfil") return pathname.startsWith(href) || UNDER_PROFILE.some((p) => pathname.startsWith(p));
  return pathname.startsWith(href);
};

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const theme = useSettings((s) => s.theme);
  const set = useSettings((s) => s.set);
  const bare = pathname.startsWith("/leer") || pathname.startsWith("/acceso");
  const downloads = useDownloadWatcher(!pathname.startsWith("/acceso"));
  const queued = downloads?.queue.filter((i) => i.state !== "FINISHED").length ?? 0;
  useTrackNavigation();

  // El lector y la pantalla de contraseña ocupan toda la pantalla.
  if (bare) return <>{children}</>;

  const isDark = theme !== "light";

  return (
    <div className="min-h-dvh md:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-6">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-fg">
            <Cat className="size-5" strokeWidth={2.4} />
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            Cattus<span className="text-accent">Manga</span>
          </span>
        </Link>
        <div className="px-3">
          <button
            onClick={() => window.dispatchEvent(new Event("cattus:open-search"))}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Search className="size-[18px]" />
            Buscar
            <kbd className="ml-auto rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold">Ctrl K</kbd>
          </button>
        </div>
        <nav aria-label="Principal" className="flex flex-1 flex-col gap-1 px-3 pt-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                <Icon className="size-[18px]" />
                {label}
                {href === "/descargas" && queued > 0 && <NavBadge count={queued} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <button
            onClick={() => set({ theme: isDark ? "light" : "dark" })}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            {isDark ? "Modo claro" : "Modo oscuro"}
          </button>
        </div>
      </aside>

      <CommandPalette />

      <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 md:pb-12 md:pt-8 lg:px-10">
        {children}
      </main>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV.filter((n) => n.mobile).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href, true);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon className="size-5" />
              <span className="max-w-full truncate px-0.5">{label}</span>
              {/* Las descargas viven en Perfil en el móvil: el contador se muestra ahí. */}
              {href === "/perfil" && queued > 0 && <NavBadge count={queued} className="absolute right-[22%] top-1.5" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function NavBadge({ count, className = "" }: { count: number; className?: string }) {
  return (
    <span aria-label={`${count} en cola`} className={`grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg ${className}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
