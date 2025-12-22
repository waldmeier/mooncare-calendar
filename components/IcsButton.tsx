"use client";

import { useSearchParams } from "next/navigation";

function clampYear(y: number) {
  if (y < 2025) return 2025;
  if (y > 2027) return 2027;
  return y;
}

export default function IcsButton() {
  const sp = useSearchParams();
  const yearRaw = sp.get("year");
  const year = clampYear(Number(yearRaw) || 2026);

  return (
    <button
      type="button"
      onClick={() => {
        // Download/öffnen (funktioniert für Import; für Abo brauchst du später eine fixe HTTPS-URL)
        window.open(`/api/export/ics?year=${year}`, "_blank", "noopener,noreferrer");
      }}
      className="rounded-md border border-zinc-900 px-3 py-1.5 text-xs hover:bg-zinc-50"
      title="ICS exportieren"
    >
      ICS
    </button>
  );
}