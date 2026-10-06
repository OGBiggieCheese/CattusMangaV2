"use client";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ImageOff, Loader2, RotateCw } from "lucide-react";
import { coverUrl, type MangaCardData } from "@/lib/api";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dangerSolid";
  size?: "sm" | "md";
  loading?: boolean;
};

export function Button({ variant = "secondary", size = "md", loading, className = "", children, disabled, ...rest }: ButtonProps) {
  const variants = {
    primary: "bg-accent text-accent-fg hover:brightness-110",
    secondary: "bg-surface-2 text-fg hover:bg-border",
    ghost: "text-muted hover:bg-surface-2 hover:text-fg",
    danger: "bg-danger/15 text-danger hover:bg-danger/25",
    dangerSolid: "bg-danger text-white hover:brightness-110",
  };
  const sizes = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-10 px-4 text-sm gap-2" };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Chip({
  active,
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...rest}
      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-surface text-muted hover:border-muted/50 hover:text-fg"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Loader2 className="size-5 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-6 py-10 text-center">
      <AlertTriangle className="size-7 text-danger" />
      <p className="max-w-lg text-sm text-fg">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          <RotateCw className="size-3.5" /> Reintentar
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Icon className="size-7" />
      </span>
      <h2 className="text-lg font-bold">{title}</h2>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}

export function Cover({ src, alt, className = "" }: { src?: string | null; alt: string; className?: string }) {
  const [state, setState] = useState<"loading" | "ok" | "error">(src ? "loading" : "error");
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${state === "loading" ? "skeleton" : ""} ${className}`}>
      {src && state !== "error" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={`size-full object-cover transition-opacity duration-300 ${state === "ok" ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {state === "error" && (
        <div className="absolute inset-0 grid place-items-center text-muted">
          <ImageOff className="size-6" />
        </div>
      )}
    </div>
  );
}

export function MangaCard({
  manga,
  badge,
  showLibraryBadge = true,
  corner,
}: {
  manga: MangaCardData;
  badge?: React.ReactNode;
  showLibraryBadge?: boolean;
  /** Botón opcional anclado a la esquina inferior derecha de la portada (p. ej. categorías). */
  corner?: React.ReactNode;
}) {
  return (
    <div className="group block min-w-0">
      <Link href={`/manga/${manga.id}`} className="relative block">
        <Cover
          src={coverUrl(manga)}
          alt={manga.title}
          className="aspect-[2/3] rounded-xl ring-1 ring-border transition group-hover:ring-2 group-hover:ring-accent"
        />
        {badge && <div className="absolute left-2 top-2">{badge}</div>}
        {showLibraryBadge && manga.inLibrary && !badge && (
          <span className="absolute left-2 top-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent-fg">
            En biblioteca
          </span>
        )}
        {corner && (
          <div className="absolute bottom-2 right-2" onClick={(e) => e.preventDefault()}>
            {corner}
          </div>
        )}
      </Link>
      <Link href={`/manga/${manga.id}`}>
        <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug group-hover:text-accent">{manga.title}</p>
      </Link>
    </div>
  );
}

export const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

export function MangaGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className={GRID}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[2/3] rounded-xl" />
          <div className="skeleton mt-2 h-4 w-3/4 rounded" />
        </div>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-border"}`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className = "",
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  onSubmit?: () => void;
}) {
  return (
    <form
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <svg className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm outline-none transition placeholder:text-muted focus:border-accent"
      />
    </form>
  );
}
