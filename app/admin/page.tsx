// app/admin/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  PHASES,
  ZODIACS,
  MOON_PHASE_LABEL,
  effectiveHnw,
  phaseVisual,
  tasksForDay,
  zodiacColor,
  type MoonPhase,
  type Zodiac,
} from "@/lib/rules";

type DayEntry = {
  id: string;
  date: string; // ISO string
  zodiac: string;
  phase: string;
  hnw: boolean;
  note: string | null;
};

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

function mondayFirstIndex(utcDay: number) {
  return (utcDay + 6) % 7;
}

function daysInMonthUTC(year: number, monthIndex0: number) {
  const start = new Date(Date.UTC(year, monthIndex0, 1));
  const end = new Date(Date.UTC(year, monthIndex0 + 1, 0));
  return { start, days: end.getUTCDate() };
}

function isoDate(year: number, monthIndex0: number, day: number) {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toZodiac(value: string): Zodiac {
  return (ZODIACS as readonly string[]).includes(value) ? (value as Zodiac) : "OTHER";
}

function toPhase(value: string): MoonPhase {
  return (PHASES as readonly string[]).includes(value) ? (value as MoonPhase) : "OTHER";
}

function shortZodiacLabel(z: Zodiac) {
  switch (z) {
    case "LOEWE":
      return "Löwe";
    case "JUNGFRAU":
      return "Jungfrau";
    case "FISCHE":
      return "Fische";
    case "KREBS":
      return "Krebs";
    case "SKORPION":
      return "Skorpion";
    case "STEINBOCK":
      return "Steinbock";
    default:
      return "";
  }
}

/**
 * Excel-Style Moon Symbol (gelb/schwarz, kein weiss)
 */
function MoonMark({ phase, size = 16 }: { phase: MoonPhase; size?: number }) {
  const v = phaseVisual(phase);
  if (!v) return null;

  const s = `${size}px`;
  const yellow = "#d4a61f";
  const border = "border-zinc-900";

  if (v === "new") {
    return <span style={{ width: s, height: s }} className={`inline-block rounded-full border ${border} bg-black`} />;
  }

  if (v === "full") {
    return (
      <span
        style={{ width: s, height: s, backgroundColor: yellow }}
        className={`inline-block rounded-full border ${border}`}
      />
    );
  }

  if (v === "waxing") {
    return (
      <span
        style={{ width: s, height: s }}
        className={`relative inline-block overflow-hidden rounded-full border ${border} bg-black`}
      >
        <span style={{ backgroundColor: yellow }} className="absolute right-0 top-0 h-full w-1/2" />
      </span>
    );
  }

  return (
    <span
      style={{ width: s, height: s, backgroundColor: yellow }}
      className={`relative inline-block overflow-hidden rounded-full border ${border}`}
    >
      <span className="absolute right-0 top-0 h-full w-1/2 bg-black" />
    </span>
  );
}

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function AdminMonthlyGrid() {
  const searchParams = useSearchParams();

  const [data, setData] = useState<DayEntry[]>([]);
  const [year, setYear] = useState(2026);
  const [monthIndex, setMonthIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Import UI
  const [importing, setImporting] = useState(false);
  const [importDryRun, setImportDryRun] = useState(false);

  // Modal state
  const [openISO, setOpenISO] = useState<string | null>(null);
  const [editZodiac, setEditZodiac] = useState<Zodiac>("OTHER");
  const [editPhase, setEditPhase] = useState<MoonPhase>("OTHER");
  const [editNote, setEditNote] = useState<string>("");

  // ✅ Startjahr aus URL: /admin?year=2027
  useEffect(() => {
    const y = toInt(searchParams.get("year"), 2026);
    setYear(y);
  }, [searchParams]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/entries", { cache: "no-store" });
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const byISO = useMemo(() => {
    const map = new Map<string, DayEntry>();
    for (const e of data) {
      const iso = new Date(e.date).toISOString().slice(0, 10);
      map.set(iso, e);
    }
    return map;
  }, [data]);

  const monthSlots = useMemo(() => {
    const { start, days } = daysInMonthUTC(year, monthIndex);
    const firstDow = mondayFirstIndex(start.getUTCDay());
    const slots = Array.from({ length: firstDow + days }, (_, i) => (i < firstDow ? null : i - firstDow + 1));
    return { slots, days };
  }, [year, monthIndex]);

  function openEditorForDay(day: number) {
    const iso = isoDate(year, monthIndex, day);
    const entry = byISO.get(iso);

    const zodiac = toZodiac(entry?.zodiac ?? "OTHER");
    const phase = toPhase(entry?.phase ?? "OTHER");
    const note = entry?.note ?? "";

    setOpenISO(iso);
    setEditZodiac(zodiac);
    setEditPhase(phase);
    setEditNote(note);
  }

  function closeEditor() {
    setOpenISO(null);
  }

  async function saveEditor() {
    if (!openISO) return;

    setSaving(true);
    try {
      await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: openISO,
          zodiac: editZodiac,
          phase: editPhase,
          note: editNote,
        }),
      });
      await load();
      closeEditor();
    } finally {
      setSaving(false);
    }
  }

  async function runAstroSeekImport() {
    setImporting(true);
    try {
      const url = importDryRun
        ? `/api/import/astroseek?year=${year}&dryRun=1`
        : `/api/import/astroseek?year=${year}`;

      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();

      // optional: schnell Feedback
      if (!json?.ok) {
        alert(`Import fehlgeschlagen: ${json?.error ?? "unbekannt"}`);
      } else {
        alert(
          importDryRun
            ? `DryRun OK: parsedDaysTotal=${json.parsedDaysTotal}, phaseRecognized=${json.phaseRecognized}, zodiacRecognized=${json.zodiacRecognized}`
            : `Import OK: upserted=${json.upserted}, phaseRecognized=${json.phaseRecognized}, zodiacRecognized=${json.zodiacRecognized}`
        );
      }

      // nach echtem Import reload
      if (!importDryRun) await load();
    } catch (e: any) {
      alert(`Import Error: ${e?.message ?? String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  const headerStatus = loading ? "lade…" : saving ? "speichere…" : importing ? "importiere…" : "bereit";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Topbar */}
      <div className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Admin – Monats-Grid</h1>
              <p className="text-sm text-zinc-600">
                Klick auf einen Tag zum Editieren. Regel: <b>FISCHE = Pflanzen giess./Hnw</b>, Krebs/Skorpion nur Pflanzen giessen.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={runAstroSeekImport}
                disabled={importing}
                className="inline-flex items-center rounded-lg border bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 disabled:opacity-60"
                title={`Astro-Seek Import für ${year}`}
              >
                Astro-Seek Import {year}
              </button>

              <label className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm">
                <input
                  type="checkbox"
                  checked={importDryRun}
                  onChange={(e) => setImportDryRun(e.target.checked)}
                />
                DryRun
              </label>

              {/* ✅ Kalender nimmt gewähltes Jahr */}
              <a
                href={`/?year=${year}`}
                className="inline-flex items-center rounded-lg border bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50"
              >
                Kalender
              </a>

              {/* ✅ ICS Export fürs gewählte Jahr */}
              <a
                href={`/api/export/ics?year=${year}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-lg border bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50"
                title={`ICS Export ${year}`}
              >
                ICS Export
              </a>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border bg-white px-3 py-2 text-sm shadow-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-1">
              {MONTHS_DE.map((m, idx) => (
                <button
                  key={m}
                  onClick={() => setMonthIndex(idx)}
                  className={[
                    "rounded-lg border px-3 py-2 text-sm shadow-sm transition",
                    idx === monthIndex ? "bg-zinc-900 text-white border-zinc-900" : "bg-white hover:bg-zinc-50",
                  ].join(" ")}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="ml-auto text-sm text-zinc-600">{headerStatus}</div>
          </div>
        </div>
      </div>

      {/* Month grid */}
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b bg-zinc-50 px-4 py-3">
            <div className="font-semibold">
              {MONTHS_DE[monthIndex]} {year}
            </div>
            <div className="text-xs text-zinc-500">Mondphase optional · Notiz optional</div>
          </div>

          <div className="grid grid-cols-7 border-b bg-white text-[11px] font-medium text-zinc-500">
            {DOW_DE.map((d) => (
              <div key={d} className="px-2 py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {monthSlots.slots.map((day, idx) => {
              if (!day) {
                return <div key={idx} className="h-[108px] border-r border-t bg-white last:border-r-0" />;
              }

              const iso = isoDate(year, monthIndex, day);
              const entry = byISO.get(iso);

              const zodiac = toZodiac(entry?.zodiac ?? "OTHER");
              const phase = toPhase(entry?.phase ?? "OTHER");
              const hnw = effectiveHnw(zodiac);

              const tasks = tasksForDay(zodiac);
              const zLabel = shortZodiacLabel(zodiac);

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => openEditorForDay(day)}
                  className={[
                    "h-[108px] border-r border-t last:border-r-0 p-2 text-left transition",
                    "hover:shadow-[inset_0_0_0_2px_rgba(24,24,27,0.10)] focus:outline-none",
                    zodiacColor(zodiac),
                  ].join(" ")}
                  title={`${iso}${zLabel ? " · " + zLabel : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold leading-none">{String(day).padStart(2, "0")}</div>
                      {zLabel && (
                        <span className="hidden rounded-full border bg-white/70 px-2 py-0.5 text-[10px] text-zinc-700 md:inline">
                          {zLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <MoonMark phase={phase} size={16} />
                      {hnw && (
                        <span className="rounded-full border bg-white/70 px-2 py-0.5 text-[10px] text-zinc-700">
                          Hnw
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 space-y-1 text-[11px] leading-tight text-zinc-800">
                    {tasks.slice(0, 2).map((t) => (
                      <div key={t.key} className="truncate">
                        {t.label}
                      </div>
                    ))}
                    {tasks.length > 2 && <div className="text-zinc-600">+{tasks.length - 2}</div>}

                    {entry?.note && entry.note.trim().length > 0 && (
                      <div className="mt-2 truncate rounded-md border bg-white/60 px-2 py-1 text-[10px] text-zinc-700">
                        {entry.note}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Small legend (wie Excel: Text + Symbol) */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <LegendChip className="bg-rose-200" label="Löwe (Haare)" />
          <LegendChip className="bg-green-200" label="Jungfrau (Haare)" />
          <LegendChip className="bg-sky-200" label="Fische/Krebs/Skorpion (Pflanzen)" />
          <LegendChip className="bg-orange-200" label="Steinbock (Nägel)" />

          <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 shadow-sm">
            <MoonMark phase="NEW" size={14} />
            <span className="text-zinc-700">{MOON_PHASE_LABEL.NEW}</span>
            <span className="mx-1 text-zinc-400">·</span>
            <MoonMark phase="FULL" size={14} />
            <span className="text-zinc-700">{MOON_PHASE_LABEL.FULL}</span>
            <span className="mx-1 text-zinc-400">·</span>
            <MoonMark phase="FIRST_QUARTER" size={14} />
            <span className="text-zinc-700">{MOON_PHASE_LABEL.FIRST_QUARTER}</span>
            <span className="mx-1 text-zinc-400">·</span>
            <MoonMark phase="LAST_QUARTER" size={14} />
            <span className="text-zinc-700">{MOON_PHASE_LABEL.LAST_QUARTER}</span>
          </span>
        </div>
      </div>

      {/* Modal */}
      {openISO && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
          <div className="w-full max-w-lg rounded-2xl border bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="space-y-0.5">
                <div className="text-sm text-zinc-500">Bearbeite Tag</div>
                <div className="text-lg font-semibold">{openISO}</div>
              </div>
              <button
                onClick={closeEditor}
                className="rounded-lg border bg-white px-3 py-2 text-sm shadow-sm hover:bg-zinc-50"
              >
                Schliessen
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tierkreis</div>
                  <select
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm"
                    value={editZodiac}
                    onChange={(e) => setEditZodiac(e.target.value as Zodiac)}
                  >
                    {ZODIACS.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                  {editZodiac === "FISCHE" && (
                    <div className="text-xs text-zinc-600">
                      Hinweis: Bei <b>FISCHE</b> wird Hnw automatisch gesetzt.
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Mondphase</div>
                  <select
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm"
                    value={editPhase}
                    onChange={(e) => setEditPhase(e.target.value as MoonPhase)}
                  >
                    {PHASES.filter((p) => p !== "OTHER").map((p) => (
                      <option key={p} value={p}>
                        {MOON_PHASE_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Notiz</div>
                <textarea
                  className="min-h-[90px] w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Optional (z.B. Hinweise/Kommentare)"
                />
              </div>

              <div className="rounded-xl border bg-zinc-50 p-3 text-sm text-zinc-700">
                <div className="font-medium text-zinc-800">Vorschau</div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 ${zodiacColor(
                      editZodiac
                    )}`}
                  >
                    <span className="text-xs">{shortZodiacLabel(editZodiac) || "Neutral"}</span>
                  </span>

                  {effectiveHnw(editZodiac) && (
                    <span className="inline-flex items-center rounded-full border bg-white px-3 py-1 text-xs">
                      Hnw
                    </span>
                  )}

                  {editPhase !== "OTHER" && (
                    <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs">
                      <MoonMark phase={editPhase} size={14} />
                      <span className="text-zinc-700">{MOON_PHASE_LABEL[editPhase]}</span>
                    </span>
                  )}
                </div>

                <div className="mt-2 space-y-1 text-sm">
                  {tasksForDay(editZodiac).length === 0 ? (
                    <div className="text-zinc-600">Keine Tasks</div>
                  ) : (
                    tasksForDay(editZodiac).map((t) => <div key={t.key}>{t.label}</div>)
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
              <button
                onClick={closeEditor}
                className="rounded-lg border bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50"
                disabled={saving}
              >
                Abbrechen
              </button>
              <button
                onClick={saveEditor}
                className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Speichern…" : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendChip({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 shadow-sm">
      <span className={`h-3 w-3 rounded-full border ${className}`} />
      <span className="text-zinc-700">{label}</span>
    </span>
  );
}