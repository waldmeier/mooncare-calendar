// app/api/export/ics/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MOON_PHASE_LABEL, tasksForDay, type MoonPhase, type Zodiac } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ICS needs CRLF
function crlf(lines: string[]) {
  return lines.join("\r\n") + "\r\n";
}

// fold long lines to ~75 chars (good enough for our content)
function foldLine(line: string) {
  const limit = 75;
  if (line.length <= limit) return [line];
  const out: string[] = [];
  let s = line;
  while (s.length > limit) {
    out.push(s.slice(0, limit));
    s = " " + s.slice(limit);
  }
  out.push(s);
  return out;
}

function escIcsText(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function yyyymmddUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function addDaysUTC(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function isPhaseEvent(p: MoonPhase) {
  return p === "NEW" || p === "FULL" || p === "FIRST_QUARTER" || p === "LAST_QUARTER";
}

function taskSummaryFor(zodiac: Zodiac): string | null {
  const first = tasksForDay(zodiac)[0]?.label ?? "";
  if (!first) return null;

  // Emojis entfernen, und Output so formen wie gewünscht
  if (zodiac === "LOEWE") return "Haare schneiden (Löwe)";
  if (zodiac === "JUNGFRAU") return "Haare schneiden (Jungfrau)";
  if (zodiac === "FISCHE") return "Pflanzen giessen / Hnw";
  if (zodiac === "KREBS" || zodiac === "SKORPION") return "Pflanzen giessen";
  if (zodiac === "STEINBOCK") return "Nagelpflege";

  return null;
}

type Entry = {
  date: Date;
  zodiac: Zodiac | string;
  phase: MoonPhase | string;
};

type Block = {
  summary: string;
  start: Date; // inclusive (UTC midnight)
  endExclusive: Date; // exclusive (UTC midnight)
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = toInt(searchParams.get("year"), 2027);

  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));

  const entries = (await prisma.dayEntry.findMany({
    where: { date: { gte: from, lt: to } },
    orderBy: { date: "asc" },
    select: { date: true, zodiac: true, phase: true },
  })) as unknown as Entry[];

  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

  const calName = `SKEMA Mondkalender ${year}`;
  const prodId = "-//SKEMA//MoonCare Calendar//DE";

  // ---- 1) Task-Blocks bauen (zusammenhängende Tage zusammenfassen) ----
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const e of entries) {
    const zodiac = (e.zodiac as Zodiac) ?? "OTHER";
    const summary = taskSummaryFor(zodiac);

    // Kein Task → Block ggf. abschliessen
    if (!summary) {
      if (current) {
        blocks.push(current);
        current = null;
      }
      continue;
    }

    const dayStart = new Date(Date.UTC(e.date.getUTCFullYear(), e.date.getUTCMonth(), e.date.getUTCDate()));
    const nextDay = addDaysUTC(dayStart, 1);

    if (!current) {
      current = { summary, start: dayStart, endExclusive: nextDay };
      continue;
    }

    const isContiguous = current.endExclusive.getTime() === dayStart.getTime();
    const sameSummary = current.summary === summary;

    if (isContiguous && sameSummary) {
      // Block verlängern
      current.endExclusive = nextDay;
    } else {
      // alten Block speichern, neuen starten
      blocks.push(current);
      current = { summary, start: dayStart, endExclusive: nextDay };
    }
  }
  if (current) blocks.push(current);

  // ---- ICS schreiben ----
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push(`PRODID:${prodId}`);
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(...foldLine(`X-WR-CALNAME:${escIcsText(calName)}`));
  lines.push("X-WR-TIMEZONE:UTC");

  // ---- 2) Task-Events (geblockt) ----
  for (const b of blocks) {
    const startStr = yyyymmddUTC(b.start);
    const endStr = yyyymmddUTC(b.endExclusive);

    // UID stabil: basiert auf summary + start/end
    const uidKey = `${b.summary}-${startStr}-${endStr}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const uid = `task-${year}-${uidKey}@mooncare.local`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);

    // All-day range: DTEND ist EXKLUSIV!
    lines.push(`DTSTART;VALUE=DATE:${startStr}`);
    lines.push(`DTEND;VALUE=DATE:${endStr}`);

    lines.push(...foldLine(`SUMMARY:${escIcsText(b.summary)}`));
    lines.push("END:VEVENT");
  }

  // ---- 3) Moon-Phase-Events (einzeln) ----
  for (const e of entries) {
    const phase = (e.phase as MoonPhase) ?? "OTHER";
    if (!isPhaseEvent(phase)) continue;

    const dateStr = yyyymmddUTC(new Date(e.date));
    const label = MOON_PHASE_LABEL[phase] ?? phase;
    const summary = label; // keine Emojis

    const uid = `moon-${year}-${dateStr}-${phase}@mooncare.local`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
    lines.push(...foldLine(`SUMMARY:${escIcsText(summary)}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const ics = crlf(lines);

  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="skema-mondkalender-${year}.ics"`,
      "cache-control": "no-store",
    },
  });
}