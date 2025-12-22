// components/YearPicker.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function YearPicker({
  years,
  currentYear,
}: {
  years: number[];
  currentYear: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function setYear(y: number) {
    const params = new URLSearchParams(sp.toString());
    params.set("year", String(y));

    // URL ändern …
    router.push(`/?${params.toString()}`);

    // … und Server Component neu rendern (wichtig!)
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {years.map((y) => (
        <button
          key={y}
          type="button"
          onClick={() => setYear(y)}
          className={[
            "rounded-md border border-zinc-900 px-3 py-1.5 text-xs transition",
            y === currentYear ? "bg-zinc-900 text-white" : "bg-white hover:bg-zinc-50",
          ].join(" ")}
        >
          {y}
        </button>
      ))}
    </div>
  );
}