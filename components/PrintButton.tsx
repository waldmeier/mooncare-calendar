// components/PrintButton.tsx
"use client";

type Props = {
  year: number;
  autoprint?: boolean;
};

export default function PrintButton({ year, autoprint = true }: Props) {
  return (
    <button
      type="button"
      onClick={() => {
        const url = `/print?year=${encodeURIComponent(year)}${autoprint ? "&autoprint=1" : ""}`;
        window.open(url, "_blank", "noopener,noreferrer");
      }}
      className="rounded-md border border-zinc-900 px-3 py-1.5 text-xs hover:bg-zinc-50"
      title="A4 PDF drucken"
    >
      A4 PDF
    </button>
  );
}