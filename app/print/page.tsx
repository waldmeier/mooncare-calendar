// app/print/page.tsx
import { prisma } from "@/lib/db";
import { tasksForDay, type Zodiac, type MoonPhase } from "@/lib/rules";
import "./print.css";

export const dynamic = "force-dynamic";

const MONTHS_DE = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember",
] as const;

const DOW_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;

function toInt(v: string | null | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampYear(y: number) {
  // wenn du später mehr Jahre willst, hier erweitern
  if (y < 2025) return 2025;
  if (y > 2027) return 2027;
  return y;
}

function isoDate(year: number, monthIndex0: number, day: number) {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonthUTC(year: number, monthIndex0: number) {
  // day 0 of next month = last day of current month
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

function dowUTC(year: number, monthIndex0: number, day: number) {
  return new Date(Date.UTC(year, monthIndex0, day)).getUTCDay(); // 0=So..6=Sa
}

function zodiacBg(z: Zodiac): string {
  switch (z) {
    case "LOEWE":
      return "bg-lion";
    case "JUNGFRAU":
      return "bg-virgo";
    case "FISCHE":
    case "KREBS":
    case "SKORPION":
      return "bg-water";
    case "STEINBOCK":
      return "bg-capricorn";
    default:
      return "bg-none";
  }
}

function phaseClass(p: MoonPhase): string | null {
  switch (p) {
    case "NEW":
      return "new";
    case "FULL":
      return "full";
    case "FIRST_QUARTER": // zunehmend
      return "waxing";
    case "LAST_QUARTER": // abnehmend
      return "waning";
    default:
      return null;
  }
}

function shortTaskLabel(zodiac: Zodiac): string {
  // erster Task reicht (Print ist eng)
  const t = tasksForDay(zodiac)[0]?.label ?? "";
  return t
    .replace("✂︎ ", "")
    .replace("💧 ", "")
    .replace("💅 ", "")
    .replace("Pflanzen giess./Hnw", "Pflanzen gi./Hnw")
    .replace("Pflanzen giessen", "Pflanzen giessen")
    .trim();
}

type Entry = {
  date: Date;
  zodiac: string;
  phase: string;
  hnw: boolean;
  note: string | null;
};

export default async function PrintPage({
  searchParams,
}: {
  // Next 16: searchParams kann Promise sein -> wir unwrapen sauber
  searchParams?: Promise<{ year?: string; autoprint?: string }> | { year?: string; autoprint?: string };
}) {
  const sp = (searchParams instanceof Promise ? await searchParams : searchParams) ?? {};
  const YEAR = clampYear(toInt(sp.year, 2026));
  const autoprint = sp.autoprint === "1" || sp.autoprint === "true";

  const entries = await prisma.dayEntry.findMany({
    where: {
      date: {
        gte: new Date(Date.UTC(YEAR, 0, 1)),
        lt: new Date(Date.UTC(YEAR + 1, 0, 1)),
      },
    },
    orderBy: { date: "asc" },
  });

  const byISO = new Map<string, Entry>();
  for (const e of entries) {
    const iso = new Date(e.date).toISOString().slice(0, 10);
    byISO.set(iso, e as unknown as Entry);
  }

  return (
    <div className="print-page">
      {/* Auto-Print (wenn ?autoprint=1) */}
      {autoprint ? (
        <script
          // kleine Verzögerung, damit Layout/Fonts geladen sind
          dangerouslySetInnerHTML={{
            __html: `setTimeout(() => { try { window.print(); } catch(e) {} }, 250);`,
          }}
        />
      ) : null}

      {/* Header */}
      <div className="header">
        <div className="brand">
          <div className="brand-logo">
            <img src="/skema-logo.png" alt="SKEMA" />
          </div>
          <div className="brand-text">
            <div className="name">SKEMA</div>
            <div className="sub">Energie &amp; Kampfkunst Akademie</div>
          </div>
        </div>

        <div className="title">
          <h1>Haar-, Nagel- &amp; Pflanzenpflege {YEAR}</h1>
        </div>
      </div>

      <div className="hr" />

      {/* Legend compact */}
      <div className="legend">
        <span className="legend-item"><span className="dot lion" />Löwe (Haare)</span>
        <span className="legend-item"><span className="dot virgo" />Jungfrau (Haare)</span>
        <span className="legend-item"><span className="dot water" />Fische / Krebs / Skorpion (Pflanzen)</span>
        <span className="legend-item"><span className="dot capricorn" />Steinbock (Nägel)</span>

        <span className="legend-item"><span className="dot new" /> Neumond</span>
        <span className="legend-item"><span className="dot full" /> Vollmond</span>
        <span className="legend-item"><span className="dot waxing" /> Zunehmend</span>
        <span className="legend-item"><span className="dot waning" /> Abnehmend</span>
      </div>

      {/* Jan–Jun */}
      <YearBlock year={YEAR} months={[0, 1, 2, 3, 4, 5]} byISO={byISO} />

      {/* Jul–Dez */}
      <YearBlock year={YEAR} months={[6, 7, 8, 9, 10, 11]} byISO={byISO} />

      <p className="explain-text">
        <strong>Löwe</strong> = Haare werden kräftiger, <strong>Jungfrau</strong> = Haare bewahren länger Form und Schönheit.
        Beim Haarewaschen sollte die letzte Spülung mit kaltem Wasser erfolgen, auch bei gesundem und kräftigem Haar – an{" "}
        <strong>Fische-</strong> und <strong>Krebstagen</strong> sollte nach Möglichkeit aufs Waschen und Schneiden der Haare
        verzichtet werden. Pflanzen giessen sollte man nur an Blatttagen: <strong>Fische, Krebs und Skorpion</strong>.
        Nägel immer <strong>freitags nach Sonnenuntergang</strong> schneiden und zusätzlich an{" "}
        <strong>Steinbock-Tagen</strong> pflegen; sie werden kräftig und widerstandsfähig.
      </p>
    </div>
  );
}

function YearBlock({
  year,
  months,
  byISO,
}: {
  year: number;
  months: number[];
  byISO: Map<string, Entry>;
}) {
  // wir drucken immer 1..31, leere Tage bleiben leer
  const rows = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="year-block">
      <table className="year-table">
        <thead>
          <tr>
            {months.map((m) => (
              <th key={m}>{MONTHS_DE[m]}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((day) => (
            <tr key={day}>
              {months.map((m) => {
                const dim = daysInMonthUTC(year, m);
                if (day > dim) return <td key={m}></td>;

                const iso = isoDate(year, m, day);
                const e = byISO.get(iso);

                const zodiac = (e?.zodiac ?? "OTHER") as Zodiac;
                const phase = (e?.phase ?? "OTHER") as MoonPhase;

                const bg = zodiacBg(zodiac);
                const task = zodiac === "OTHER" ? "" : shortTaskLabel(zodiac);

                const dow = DOW_DE[dowUTC(year, m, day)];
                const mClass = phaseClass(phase);

                return (
                  <td key={m}>
                    <div className={`daycell ${bg}`}>
                      <div className="dd">{String(day).padStart(2, "0")}</div>
                      <div className="dow">{dow}</div>
                      <div className="task">{task}</div>
                      {mClass ? <div className={`moon ${mClass}`} /> : <div />}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}