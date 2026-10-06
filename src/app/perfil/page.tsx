"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookCheck,
  BookOpen,
  Cat,
  ChevronRight,
  Download,
  Flame,
  HardDrive,
  Library,
  Puzzle,
  Settings,
  Trophy,
} from "lucide-react";
import { api, coverUrl, type StatsData } from "@/lib/api";
import { STATUS_LABEL } from "@/lib/format";
import { activityByDay, intensity, streaks, topCounts, type ActivityDay } from "@/lib/stats";
import { useDownloads } from "@/lib/downloads";
import { Cover, ErrorBox, PageHeader, Spinner } from "@/components/ui";
import { NavBadge } from "@/components/Shell";

/** Semanas que muestra el mapa de actividad (cabe en la pantalla de un móvil). */
const WEEKS = 18;

export default function ProfilePage() {
  const stats = useQuery({ queryKey: ["stats"], queryFn: api.stats, staleTime: 5 * 60_000 });

  return (
    <>
      <PageHeader title="Perfil" />
      <ProfileCard />
      <MobileShortcuts />
      {stats.isPending ? (
        <Spinner label="Calculando estadísticas…" />
      ) : stats.isError ? (
        <ErrorBox error={stats.error} onRetry={() => stats.refetch()} />
      ) : (
        <Stats data={stats.data} />
      )}
    </>
  );
}

function ProfileCard() {
  return (
    <div className="mb-6 flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent text-accent-fg">
        <Cat className="size-7" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-bold">Lector</p>
        <p className="text-sm text-muted">Tus estadísticas de lectura en este servidor.</p>
      </div>
    </div>
  );
}

/** En el móvil, la barra inferior solo tiene 5 pestañas: el resto de secciones se abren desde aquí. */
function MobileShortcuts() {
  const downloads = useDownloads();
  const queued = downloads.data?.queue.filter((i) => i.state !== "FINISHED").length ?? 0;
  const links = [
    { href: "/descargas", label: "Descargas", icon: Download, badge: queued },
    { href: "/extensiones", label: "Extensiones", icon: Puzzle, badge: 0 },
    { href: "/ajustes", label: "Ajustes", icon: Settings, badge: 0 },
  ];
  return (
    <nav aria-label="Más secciones" className="mb-8 overflow-hidden rounded-2xl border border-border bg-surface md:hidden">
      {links.map(({ href, label, icon: Icon, badge }) => (
        <Link key={href} href={href} className="flex min-h-14 items-center gap-3 border-b border-border px-4 last:border-b-0 active:bg-surface-2">
          <Icon className="size-5 text-muted" />
          <span className="flex-1 font-medium">{label}</span>
          {badge > 0 && <NavBadge count={badge} />}
          <ChevronRight className="size-4 text-muted" />
        </Link>
      ))}
    </nav>
  );
}

function Stats({ data }: { data: StatsData }) {
  const s = useMemo(() => {
    const lib = data.library;
    const readOf = (m: StatsData["library"][number]) => Math.max(0, m.chapters.totalCount - m.unreadCount);
    const year = activityByDay(data.recentReads, 366);
    // El mapa empieza en lunes para que cada fila sea un día de la semana.
    const todayMon0 = (new Date().getDay() + 6) % 7;
    const heatmap = year.slice(-((WEEKS - 1) * 7 + todayMon0 + 1));
    const last30 = year.slice(-30);
    return {
      mangas: lib.length,
      unread: lib.reduce((n, m) => n + m.unreadCount, 0),
      upToDate: lib.filter((m) => m.chapters.totalCount > 0 && m.unreadCount === 0).length,
      finished: lib.filter(
        (m) => m.chapters.totalCount > 0 && m.unreadCount === 0 && ["COMPLETED", "PUBLISHING_FINISHED", "CANCELLED"].includes(m.status),
      ).length,
      heatmap,
      streak: streaks(year),
      last30: last30.reduce((n, d) => n + d.count, 0),
      activeDays30: last30.filter((d) => d.count > 0).length,
      topMangas: [...lib]
        .map((m) => ({ manga: m, read: readOf(m) }))
        .filter((x) => x.read > 0)
        .sort((a, b) => b.read - a.read)
        .slice(0, 5),
      genres: topCounts(lib.flatMap((m) => m.genre), 12),
      sources: topCounts(lib.map((m) => m.source?.displayName ?? ""), 5),
      statuses: topCounts(lib.map((m) => STATUS_LABEL[m.status] ?? m.status), 6),
    };
  }, [data]);

  return (
    <div className="space-y-8">
      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Library} label="En la biblioteca" value={s.mangas} />
        <StatTile icon={BookCheck} label="Capítulos leídos" value={data.readChapters} />
        <StatTile icon={BookOpen} label="Capítulos sin leer" value={s.unread} />
        <StatTile icon={HardDrive} label="Capítulos descargados" value={data.downloadedChapters} />
        <StatTile icon={Flame} label="Racha actual" value={s.streak.current} unit={s.streak.current === 1 ? "día" : "días"} />
        <StatTile icon={Trophy} label="Mejor racha (1 año)" value={s.streak.best} unit={s.streak.best === 1 ? "día" : "días"} />
        <StatTile icon={BookCheck} label="Mangas al día" value={s.upToDate} />
        <StatTile icon={Trophy} label="Series terminadas" value={s.finished} hint="Finalizadas y leídas enteras" />
      </section>

      <Card title="Actividad" subtitle={`${s.last30} capítulos en los últimos 30 días · ${s.activeDays30} días con lectura`}>
        <Heatmap days={s.heatmap} />
        <p className="mt-3 text-xs text-muted">
          Cuenta la última vez que abriste cada capítulo: si relees uno, se mueve al día en que lo releíste.
        </p>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card title="Lo que más has leído">
          {s.topMangas.length === 0 ? (
            <Empty />
          ) : (
            <ol className="space-y-3">
              {s.topMangas.map(({ manga, read }, i) => (
                <li key={manga.id}>
                  <Link href={`/manga/${manga.id}`} className="group flex items-center gap-3">
                    <span className="w-4 text-center text-sm font-bold text-muted">{i + 1}</span>
                    <Cover src={coverUrl(manga)} alt="" className="h-14 w-10 shrink-0 rounded-md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold group-hover:text-accent">{manga.title}</p>
                      <Bar value={read} max={s.topMangas[0].read} />
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-muted">{read}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Géneros favoritos" subtitle="Según los mangas de tu biblioteca">
          {s.genres.length === 0 ? (
            <Empty />
          ) : (
            <ul className="flex flex-wrap gap-2">
              {s.genres.map(([genre, count]) => (
                <li key={genre} className="rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent">
                  {genre} <span className="font-normal opacity-70">· {count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Fuentes que más usas">
          <RankedBars rows={s.sources} />
        </Card>

        <Card title="Estado de las series">
          <RankedBars rows={s.statuses} />
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4" title={hint}>
      <Icon className="mb-3 size-5 text-accent" />
      <p className="text-2xl font-extrabold tabular-nums tracking-tight">
        {value.toLocaleString("es")}
        {unit && <span className="ml-1 text-sm font-semibold text-muted">{unit}</span>}
      </p>
      <p className="mt-0.5 text-xs font-medium text-muted">{label}</p>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="font-bold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
      <div className="h-full rounded-full bg-accent" style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%` }} />
    </div>
  );
}

function RankedBars({ rows }: { rows: [string, number][] }) {
  if (!rows.length) return <Empty />;
  return (
    <ul className="space-y-3">
      {rows.map(([label, count]) => (
        <li key={label}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate font-medium">{label}</span>
            <span className="tabular-nums text-muted">{count}</span>
          </div>
          <Bar value={count} max={rows[0][1]} />
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return <p className="text-sm text-muted">Aún no hay datos suficientes.</p>;
}

const LEVELS = ["bg-surface-2", "bg-accent/25", "bg-accent/50", "bg-accent/75", "bg-accent"];

function Heatmap({ days }: { days: ActivityDay[] }) {
  const max = Math.max(0, ...days.map((d) => d.count));
  const total = days.reduce((n, d) => n + d.count, 0);
  const label = (d: ActivityDay) =>
    `${new Date(d.date).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}: ${d.count} ${
      d.count === 1 ? "capítulo" : "capítulos"
    }`;

  return (
    <div className="overflow-x-auto pb-1">
      <div
        role="img"
        aria-label={`Mapa de actividad de las últimas ${WEEKS} semanas: ${total} capítulos leídos`}
        className="grid w-max grid-flow-col grid-rows-7 gap-[3px]"
      >
        {days.map((d) => (
          <span key={d.key} title={label(d)} className={`size-3 rounded-[3px] sm:size-3.5 ${LEVELS[intensity(d.count, max)]}`} />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-muted" aria-hidden>
        Menos
        {LEVELS.map((c) => (
          <span key={c} className={`size-3 rounded-[3px] ${c}`} />
        ))}
        Más
      </div>
    </div>
  );
}
