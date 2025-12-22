"use client";

import { useEffect, useMemo, useState } from "react";
import { PHASES, ZODIACS, type MoonPhase, type Zodiac } from "@/lib/rules";

type DayEntry = {
  id: string;
  date: string; // ISO
  zodiac: string;
  phase: string;
  hnw: boolean; // bleibt in der DB, aber wird automatisch gesetzt
  note: string | null;
};

export default function AdminPage() {
  const [data, setData] = useState<DayEntry[]>([]);
  const [year, setYear] = useState(2026);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/entries", { cache: "no-store" });
    setData(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(
    () => data.filter((d) => new Date(d.date).getFullYear() === year),
    [data, year]
  );

  async function save(row: { date: string; zodiac?: Zodiac; phase?: MoonPhase; note?: string }) {
    setSaving(true);
    try {
      await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-4 py-4 md:px-6">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Admin – Datenpflege</h1>
            <p className="text-sm text-zinc-600">
              Hnw ist automatisch: <b>FISCHE = Hnw</b> (im Kalender als „Pflanzen giess./Hnw“). Krebs/Skorpion nur Pflanzen.
            </p>
          </div>

          <div className="flex items-center gap-2">
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

            <a
              href="/"
              className="inline-flex items-center rounded-lg border bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50"
            >
              Kalender
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm text-zinc-600">
            {rows.length} Tage · {saving ? "speichere…" : "bereit"}
          </div>
        </div>

        <div className="overflow-auto rounded-2xl border bg-white shadow-sm">
          <table className="min-w-[1050px] w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Tierkreis</th>
                <th className="px-4 py-3">Mondphase</th>
                <th className="px-4 py-3">Notiz</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const iso = new Date(r.date).toISOString().slice(0, 10);
                const zodiac = (ZODIACS as readonly string[]).includes(r.zodiac) ? (r.zodiac as Zodiac) : "OTHER";
                const phase = (PHASES as readonly string[]).includes(r.phase) ? (r.phase as MoonPhase) : "OTHER";

                return (
                  <tr key={r.id} className="border-b last:border-b-0 hover:bg-zinc-50/60">
                    <td className="px-4 py-2 font-mono text-xs text-zinc-700">{iso}</td>

                    <td className="px-4 py-2">
                      <select
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm"
                        value={zodiac}
                        onChange={(e) => save({ date: iso, zodiac: e.target.value as Zodiac })}
                      >
                        {ZODIACS.map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-2">
                      <select
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm"
                        value={phase}
                        onChange={(e) => save({ date: iso, phase: e.target.value as MoonPhase })}
                      >
                        {PHASES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-2">
                      <input
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm"
                        defaultValue={r.note ?? ""}
                        onBlur={(e) => save({ date: iso, note: e.target.value })}
                        placeholder="optional"
                      />
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-sm text-zinc-600" colSpan={4}>
                    Keine Daten. Falls du frisch migriert hast: <span className="font-mono">npm run seed:2026</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-zinc-600 shadow-sm">
          <div className="font-medium text-zinc-800">Hinweis</div>
          <p className="mt-1">
            Wenn du im Admin <b>FISCHE</b> auswählst, wird Hnw automatisch gespeichert. Wechselst du danach auf Krebs/Skorpion,
            wird Hnw automatisch wieder entfernt.
          </p>
        </div>
      </div>
    </div>
  );
}
