// app/page.tsx
import { prisma } from "@/lib/db";
import { PHASES, ZODIACS, tasksForDay, zodiacColor, type MoonPhase, type Zodiac } from "@/lib/rules";
import PrintButton from "@/components/PrintButton";
import YearPicker from "@/components/YearPicker";
import IcsButton from "@/components/IcsButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MONTHS_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

const DOW_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function toInt(v: unknown, fallback: number) {
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function clampYear(y: number) {
  const allowed = new Set([2025, 2026, 2027]);
  return allowed.has(y) ? y : 2026;
}

function daysInMonth(year: number, monthIndex0: number) {
  const start = new Date(Date.UTC(year, monthIndex0, 1));
  const end = new Date(Date.UTC(year, monthIndex0 + 1, 0));
  return { start, days: end.getUTCDate() };
}

function mondayFirstIndex(utcDay: number) {
  return (utcDay + 6) % 7; // 0=Mo
}

function toZodiac(value: string): Zodiac {
  return (ZODIACS as readonly string[]).includes(value) ? (value as Zodiac) : "OTHER";
}

function toPhase(value: string): MoonPhase {
  return (PHASES as readonly string[]).includes(value) ? (value as MoonPhase) : "OTHER";
}

// SKEMA-Gold
const SKEMA_GOLD = "#d4a61f";

function MoonBadge({ phase, size = 18 }: { phase: MoonPhase; size?: number }) {
  const s = `${size}px`;

  if (phase === "NEW") return <div style={{ width: s, height: s }} className="rounded-full bg-black" />;

  if (phase === "FULL") {
    return <div className="rounded-full" style={{ backgroundColor: SKEMA_GOLD, width: s, height: s }} />;
  }

  if (phase === "FIRST_QUARTER") {
    return (
      <div className="relative overflow-hidden rounded-full border border-zinc-900" style={{ width: s, height: s }}>
        <div className="absolute inset-0" style={{ backgroundColor: "black" }} />
        <div className="absolute right-0 top-0 h-full w-1/2" style={{ backgroundColor: SKEMA_GOLD }} />
      </div>
    );
  }

  if (phase === "LAST_QUARTER") {
    return (
      <div className="relative overflow-hidden rounded-full border border-zinc-900" style={{ width: s, height: s }}>
        <div className="absolute inset-0" style={{ backgroundColor: "black" }} />
        <div className="absolute left-0 top-0 h-full w-1/2" style={{ backgroundColor: SKEMA_GOLD }} />
      </div>
    );
  }

  return null;
}

function LegendPill({ dotClass, label }: { dotClass?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-900 bg-white px-3 py-1 text-xs">
      {dotClass ? <span className={`h-3 w-3 rounded-full border border-zinc-900 ${dotClass}`} /> : null}
      <span className="text-zinc-800">{label}</span>
    </span>
  );
}

function MoonLegendPill({ label, phase }: { label: string; phase: MoonPhase }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-900 bg-white px-3 py-1 text-xs">
      <MoonBadge phase={phase} size={14} />
      <span className="text-zinc-800">{label}</span>
    </span>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const year = clampYear(toInt(sp.year, 2026));

  const entries = await prisma.dayEntry.findMany({
    where: {
      date: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
    orderBy: { date: "asc" },
  });

  const byISO = new Map(entries.map((e) => [new Date(e.date).toISOString().slice(0, 10), e]));

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="mt-0.5 flex items-center gap-4">
              <div
                className="h-30 w-30 rounded-full"
                style={{
                  backgroundImage: "url(/skema-logo.png)",
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                }}
                aria-label="SKEMA"
                title="SKEMA"
              />
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-wide">SKEMA</div>
                <div className="text-sm text-zinc-600">Energie &amp; Kampfkunst</div>
                <div className="text-sm text-zinc-600">Akademie</div>
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-semibold">
                Haar-, Nagel- &amp; Pflanzenpflege <span className="text-zinc-400">{year}</span>
              </h1>
              <p className="mt-1 text-xs text-zinc-700">
                Löwe/Jungfrau = Haare · Fische = Pflanzen giess./Hnw · Krebs/Skorpion = Pflanzen · Steinbock = Nägel
              </p>

              <YearPicker years={[2025, 2026, 2027]} currentYear={year} />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <LegendPill dotClass="bg-rose-200" label="Löwe (Haare)" />
                <LegendPill dotClass="bg-green-200" label="Jungfrau (Haare)" />
                <LegendPill dotClass="bg-sky-200" label="Fische / Krebs / Skorpion (Pflanzen)" />
                <LegendPill dotClass="bg-orange-200" label="Steinbock (Nägel)" />
                <span className="mx-1 hidden h-5 w-px bg-zinc-300 md:inline" />
                <MoonLegendPill phase="NEW" label="Neumond" />
                <MoonLegendPill phase="FULL" label="Vollmond" />
                <MoonLegendPill phase="FIRST_QUARTER" label="zunehmend" />
                <MoonLegendPill phase="LAST_QUARTER" label="abnehmend" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PrintButton year={year} />

            <a href={`/admin?year=${year}`} className="rounded-md border border-zinc-900 px-3 py-1.5 text-xs hover:bg-zinc-50">
              Admin
            </a>

            <a
              href={`/api/export/ics?year=${year}`}
              className="rounded-md border border-zinc-900 px-3 py-1.5 text-xs hover:bg-zinc-50"
              target="_blank"
              rel="noreferrer"
            >
              ICS
            </a>
          </div>
        </div>

        <div className="mt-4 h-px w-full bg-zinc-900" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-10 md:px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {MONTHS_DE.map((name, idx) => (
            <MonthCard key={idx} year={year} monthIndex={idx} monthName={name} byISO={byISO} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthCard({
  year,
  monthIndex,
  monthName,
  byISO,
}: {
  year: number;
  monthIndex: number;
  monthName: string;
  byISO: Map<string, any>;
}) {
  const { start, days } = daysInMonth(year, monthIndex);
  const firstDow = mondayFirstIndex(start.getUTCDay());

  let slots: (number | null)[] = Array.from({ length: firstDow + days }, (_, i) => (i < firstDow ? null : i - firstDow + 1));
  while (slots.length < 42) slots.push(null);
  slots = slots.slice(0, 42);

  return (
    <section className="overflow-hidden rounded-3xl border-2 border-zinc-900">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-lg font-semibold">{monthName}</div>
        <div className="text-sm text-zinc-500">{year}</div>
      </div>

      <div className="h-px w-full bg-zinc-900" />

      <div className="grid grid-cols-7 text-xs text-zinc-600">
        {DOW_DE.map((d) => (
          <div key={d} className="px-2 py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="h-px w-full bg-zinc-900" />

      <div className="grid grid-cols-7">
        {slots.map((day, idx) => {
          if (!day) return <div key={idx} className="h-[120px] border-r border-t border-zinc-900 last:border-r-0" />;

          const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const e = byISO.get(iso);

          const zodiac = toZodiac(e?.zodiac ?? "OTHER");
          const phase = toPhase(e?.phase ?? "OTHER");
          const tasks = tasksForDay(zodiac);

          return (
            <div
              key={idx}
              className={[
                "border-r border-t border-zinc-900 last:border-r-0",
                "px-2 py-2",
                "h-[120px]",
                zodiacColor(zodiac),
              ].join(" ")}
            >
              <div className="flex items-start justify-between">
                <div className="text-sm font-semibold">{String(day).padStart(2, "0")}</div>
                <MoonBadge phase={phase} size={18} />
              </div>

              <div className="mt-2 space-y-1 leading-tight" style={{ fontSize: "clamp(9px, 0.72vw, 11.5px)" }}>
                {tasks.map((t) => (
                  <div
                    key={t.key}
                    className="break-words"
                    style={{
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                      overflow: "hidden",
                    }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}