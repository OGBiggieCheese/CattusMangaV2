"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, DatabaseBackup, Download, Palette, Server, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { useSettings, type ReaderFit, type ReaderMode, type Theme } from "@/lib/settings";
import { toast } from "@/lib/toast";
import { Button, PageHeader, Toggle } from "@/components/ui";
import { confirmAction } from "@/components/Confirm";

/** Una biblioteca grande puede tardar, pero si en media hora no ha terminado algo va mal. */
const RESTORE_TIMEOUT_MS = 30 * 60_000;

export default function SettingsPage() {
  const s = useSettings();

  return (
    <>
      <PageHeader title="Ajustes" subtitle="Estas preferencias se guardan en este navegador." />
      <div className="grid max-w-3xl gap-5">
        <Card icon={Palette} title="Apariencia">
          <Row label="Tema">
            <Select<Theme>
              label="Tema"
              value={s.theme}
              onChange={(v) => s.set({ theme: v })}
              options={[["dark", "Oscuro"], ["light", "Claro"], ["system", "Según el sistema"]]}
            />
          </Row>
          <Row label="Mostrar contenido +18" hint="Muestra extensiones marcadas como adultas.">
            <Toggle checked={s.showNsfw} onChange={(v) => s.set({ showNsfw: v })} label="Mostrar contenido +18" />
          </Row>
        </Card>

        <Card icon={BookOpen} title="Lector">
          <Row label="Modo de lectura por defecto">
            <Select<ReaderMode>
              label="Modo de lectura por defecto"
              value={s.readerMode}
              onChange={(v) => s.set({ readerMode: v })}
              options={[["webtoon", "Cascada continua (webtoon)"], ["paged", "Página a página"]]}
            />
          </Row>
          <Row label="Dirección (modo páginas)">
            <Select
              label="Dirección (modo páginas)"
              value={s.readerDirection}
              onChange={(v) => s.set({ readerDirection: v })}
              options={[["ltr", "Izquierda a derecha"], ["rtl", "Derecha a izquierda (manga)"]]}
            />
          </Row>
          <Row label="Ajuste de imagen">
            <Select<ReaderFit>
              label="Ajuste de imagen"
              value={s.readerFit}
              onChange={(v) => s.set({ readerFit: v })}
              options={[["width", "Ajustar al ancho"], ["height", "Ajustar al alto"], ["original", "Tamaño original"]]}
            />
          </Row>
        </Card>

        <BackupCard />
        <ServerCard />
      </div>
    </>
  );
}

function Card({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-4 flex items-center gap-3 font-bold">
        <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon className="size-[18px]" />
        </span>
        {title}
      </h2>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-10 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

function BackupCard() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<{ kind: "info" | "ok" | "error"; text: string } | null>(null);

  const create = async () => {
    setCreating(true);
    setStatus(null);
    try {
      const url = await api.createBackup();
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.click();
      setStatus({ kind: "ok", text: "Copia creada. La descarga debería empezar ahora." });
    } catch (e) {
      setStatus({ kind: "error", text: (e as Error).message });
    } finally {
      setCreating(false);
    }
  };

  // La restauración sigue en el servidor aunque salgas de Ajustes: el estado en pantalla solo se
  // actualiza si la página sigue abierta, y el resultado final llega siempre como aviso.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const show = (s: typeof status) => mounted.current && setStatus(s);

  const restore = async (file: File) => {
    const ok = await confirmAction({
      title: "¿Importar esta copia de seguridad?",
      message: `«${file.name}». Sus mangas, categorías y progreso se combinarán con tu biblioteca actual. Puede tardar varios minutos.`,
      confirmLabel: "Importar",
    });
    if (!ok) return;

    show({ kind: "info", text: "Subiendo copia…" });
    try {
      const id = await api.restoreBackup(file);
      const deadline = Date.now() + RESTORE_TIMEOUT_MS;
      for (;;) {
        await new Promise((r) => setTimeout(r, 1000));
        if (Date.now() > deadline)
          throw new Error("La restauración está tardando demasiado. Revisa los registros de Suwayomi (docker compose logs suwayomi).");
        const st = await api.restoreStatus(id);
        if (!st) continue;
        if (st.state === "SUCCESS") {
          const text = `Restauración completada (${st.totalManga} mangas).`;
          show({ kind: "ok", text });
          toast.success(text);
          qc.invalidateQueries();
          return;
        }
        if (st.state === "FAILURE") throw new Error("La restauración falló. ¿Es un archivo .tachibk válido?");
        show({ kind: "info", text: `Restaurando… ${st.mangaProgress}/${st.totalManga}` });
      }
    } catch (e) {
      show({ kind: "error", text: (e as Error).message });
      toast.error((e as Error).message, { key: "restore" });
    }
  };

  return (
    <Card icon={DatabaseBackup} title="Copia de seguridad">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Exporta o importa tu biblioteca, categorías e historial. Compatible con archivos <strong>.tachibk</strong> de
          Mihon / Tachiyomi / Suwayomi.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={create} loading={creating}>
            {!creating && <Download className="size-4" />} Exportar .tachibk
          </Button>
          <Button onClick={() => input.current?.click()}>
            <Upload className="size-4" /> Importar .tachibk
          </Button>
          <input
            ref={input}
            type="file"
            accept=".tachibk,.proto.gz,application/gzip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restore(f);
              e.target.value = "";
            }}
          />
        </div>
        {status && (
          <p role={status.kind === "error" ? "alert" : "status"} className={`text-sm ${status.kind === "error" ? "text-danger" : status.kind === "ok" ? "text-success" : "text-muted"}`}>
            {status.text}
          </p>
        )}
      </div>
    </Card>
  );
}

function ServerCard() {
  const about = useQuery({ queryKey: ["about"], queryFn: api.about, retry: 0 });
  return (
    <Card icon={Server} title="Servidor">
      <Row label="Suwayomi-Server" hint="Ejecuta las extensiones y descarga las páginas.">
        {about.isPending ? (
          <span className="text-sm text-muted">Comprobando…</span>
        ) : about.isError ? (
          <span className="text-sm text-danger">Sin conexión</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" /> {about.data.version}
          </span>
        )}
      </Row>
    </Card>
  );
}
