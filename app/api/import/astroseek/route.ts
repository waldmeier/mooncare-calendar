// app/api/import/astroseek/route.ts
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { prisma } from "@/lib/db";
import { effectiveHnw, type MoonPhase, type Zodiac } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Astro-Seek nutzt Monats-Slugs ohne Umlaute, z.B. "marz" statt "märz".
 */
const MONTH_SLUGS = [
  "januar",
  "februar",
  "marz",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "dezember",
] as const;

const MONTH_ABBR_DE = [
  "Jan",
  "Feb",
  "Mär", // auf der Seite teils "Mär"
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
] as const;

// --- helpers ---------------------------------------------------------------

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isoDateUTC(year: number, monthIndex0: number, day: number) {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeDE(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("ß", "ss")
    .replace(/\s+/g, " ");
}

/**
 * Nur diese 4 Phasen übernehmen (für deine Excel/Print-Tabelle):
 * NEW, FULL, FIRST_QUARTER, LAST_QUARTER
 *
 * Alles andere -> OTHER
 */
function mapPhaseDE(textRaw: string): MoonPhase {
  const t = normalizeDE(textRaw);

  if (t.includes("neumond")) return "NEW";
  if (t.includes("vollmond")) return "FULL";
  if (t.includes("erstes viertel")) return "FIRST_QUARTER";
  if (t.includes("letztes viertel")) return "LAST_QUARTER";

  return "OTHER";
}

/**
 * Vollständige Zeichen-Erkennung (alle 12), damit die Erkennung stabil ist.
 * Danach reduzieren wir bewusst auf deine 6 Zeichen (inkl. Steinbock).
 */
function detectZodiacDE(textRaw: string): string {
  const t = normalizeDE(textRaw);

  if (t.includes("widder")) return "WIDDER";
  if (t.includes("stier")) return "STIER";
  if (t.includes("zwillinge")) return "ZWILLINGE";
  if (t.includes("krebs")) return "KREBS";
  if (t.includes("lowe") || t.includes("löwe")) return "LOEWE";
  if (t.includes("jungfrau")) return "JUNGFRAU";
  if (t.includes("waage")) return "WAAGE";
  if (t.includes("skorpion")) return "SKORPION";
  if (t.includes("schutze") || t.includes("schütze")) return "SCHUETZE";
  if (t.includes("steinbock")) return "STEINBOCK";
  if (t.includes("wassermann")) return "WASSERMANN";
  if (t.includes("fische")) return "FISCHE";

  return "UNKNOWN";
}

/**
 * Nur deine Zeichen bleiben – der Rest wird OTHER (damit deine Tabelle sauber ist).
 */
function reduceZodiacToYourSet(detected: string): Zodiac {
  switch (detected) {
    case "LOEWE":
      return "LOEWE";
    case "JUNGFRAU":
      return "JUNGFRAU";
    case "KREBS":
      return "KREBS";
    case "SKORPION":
      return "SKORPION";
    case "FISCHE":
      return "FISCHE";
    case "STEINBOCK":
      return "STEINBOCK";
    default:
      return "OTHER";
  }
}

/**
 * Extrahiert den Tag aus Mustern wie:
 * "Fr 1. Jan ..." / "Sa 2. Mär ..." / "So 3. Mar ..."
 *
 * März ist speziell: wir erlauben Mär / Mar / Mrz
 */
function extractDayFromRow(rowText: string, monthIndex0: number): number | null {
  const txt = rowText.replace(/\s+/g, " ").trim();

  const mAbbr = MONTH_ABBR_DE[monthIndex0];
  const monthRegexPart =
    monthIndex0 === 2
      ? "(Mär|Mar|Mrz)" // März-Varianten
      : mAbbr.replace(".", "\\.");

  const re = new RegExp(`\\b(\\d{1,2})\\.\\s*${monthRegexPart}\\b`, "i");
  const m = txt.match(re);
  if (!m) return null;

  const day = Number(m[1]);
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  return day;
}

async function fetchMonthPage(year: number, monthIndex0: number) {
  const slug = MONTH_SLUGS[monthIndex0];
  const url = `https://de.astro-seek.com/mondphasen-mondkalender-${slug}-${year}`;

  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      "accept-language": "de-DE,de;q=0.9,en;q=0.8",
      accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  return { url, res };
}

/**
 * Nimmt alle Tabellen und wählt diejenige, die am meisten "Datum-Zeilen" enthält.
 */
function pickBestTable($: cheerio.CheerioAPI, monthIndex0: number) {
  const tables = $("table").toArray();

  // ✅ AnyNode statt Element – das passt zu Cheerio/Domhandler wirklich stabil
  let best: { el: AnyNode | null; score: number } = { el: null, score: 0 };

  for (const t of tables) {
    const rows = $(t as any)
      .find("tr")
      .toArray()
      .map((r) => $(r as any).text().replace(/\s+/g, " ").trim())
      .filter(Boolean);

    let score = 0;
    for (const rowText of rows) {
      if (extractDayFromRow(rowText, monthIndex0)) score++;
    }

    if (score > best.score) best = { el: t as AnyNode, score };
  }

  return best.el ? $(best.el as any) : null;
}

/**
 * Wenn es pro Tag mehrere Treffer gibt:
 * - bevorzugt Zodiac != OTHER
 * - dann bevorzugt Phase != OTHER
 */
function chooseBetter(
  a: { zodiac: Zodiac; phase: MoonPhase; raw: string } | undefined,
  b: { zodiac: Zodiac; phase: MoonPhase; raw: string }
) {
  if (!a) return b;

  const aScore = (a.zodiac !== "OTHER" ? 10 : 0) + (a.phase !== "OTHER" ? 3 : 0);
  const bScore = (b.zodiac !== "OTHER" ? 10 : 0) + (b.phase !== "OTHER" ? 3 : 0);

  return bScore > aScore ? b : a;
}

// --- main ------------------------------------------------------------------

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const year = toInt(searchParams.get("year"), 2027);
  const dryRun = searchParams.get("dryRun") === "1" || searchParams.get("dryRun") === "true";

  const out = {
    ok: true as boolean,
    year,
    dryRun,
    fetchedPages: 0,
    fetchErrors: [] as Array<{ month: number; url: string; status?: number; error: string }>,
    parsedDaysTotal: 0,
    zodiacRecognized: 0, // zählt NUR deine (nach reduce)
    phaseRecognized: 0,
    upserted: 0,
    samples: {
      good: [] as Array<any>,
      missing: [] as Array<any>,
    },
    hint: dryRun ? "dryRun=1 → keine DB Writes. Entferne dryRun zum Importieren." : "",
  };

  try {
    // Dedup: 1 Eintrag pro ISO-Tag
    const byISO = new Map<string, { zodiac: Zodiac; phase: MoonPhase; raw: string }>();

    for (let m = 0; m < 12; m++) {
      const { url, res } = await fetchMonthPage(year, m);

      if (!res.ok) {
        out.fetchErrors.push({
          month: m + 1,
          url,
          status: res.status,
          error: `HTTP ${res.status}`,
        });
        continue;
      }

      const html = await res.text();
      out.fetchedPages++;

      const $ = cheerio.load(html);

      const table = pickBestTable($, m);
      if (!table) {
        out.fetchErrors.push({
          month: m + 1,
          url,
          error: "Keine passende Tabelle gefunden",
        });
        continue;
      }

      const rows = table
        .find("tr")
        .toArray()
        .map((r) => $(r as any).text().replace(/\s+/g, " ").trim())
        .filter(Boolean);

      for (const rowText of rows) {
        const day = extractDayFromRow(rowText, m);
        if (!day) continue;

        const iso = isoDateUTC(year, m, day);

        const detectedZ = detectZodiacDE(rowText);
        const zodiac = reduceZodiacToYourSet(detectedZ);
        const phase = mapPhaseDE(rowText);

        out.parsedDaysTotal++;
        if (zodiac !== "OTHER") out.zodiacRecognized++;
        if (phase !== "OTHER") out.phaseRecognized++;

        const current = byISO.get(iso);
        const next = { zodiac, phase, raw: rowText };

        byISO.set(iso, chooseBetter(current, next));
      }
    }

    if (out.fetchedPages === 0) out.ok = false;

    // Samples: NUR “interessante” (deine Zeichen oder Phase != OTHER)
    for (const [iso, e] of byISO.entries()) {
      if (out.samples.good.length >= 8) break;
      if (e.zodiac !== "OTHER" || e.phase !== "OTHER") {
        out.samples.good.push({ iso, zodiac: e.zodiac, phase: e.phase, raw: e.raw.slice(0, 220) });
      }
    }

    // Missing samples: alles OTHER/OTHER
    for (const [iso, e] of byISO.entries()) {
      if (out.samples.missing.length >= 5) break;
      if (e.zodiac === "OTHER" && e.phase === "OTHER") {
        out.samples.missing.push({ iso, zodiac: e.zodiac, phase: e.phase, raw: e.raw.slice(0, 220) });
      }
    }

    // DB Writes (nur wenn kein dryRun)
    if (!dryRun) {
      for (const [iso, e] of byISO.entries()) {
        const hnw = effectiveHnw(e.zodiac);

        await prisma.dayEntry.upsert({
          where: { date: new Date(`${iso}T00:00:00.000Z`) },
          update: {
            zodiac: e.zodiac,
            phase: e.phase,
            hnw,
          },
          create: {
            date: new Date(`${iso}T00:00:00.000Z`),
            zodiac: e.zodiac,
            phase: e.phase,
            hnw,
            note: null,
          },
        });

        out.upserted++;
      }
    }

    return NextResponse.json(out);
  } catch (e: any) {
    out.ok = false;
    out.fetchErrors.push({
      month: -1,
      url: "",
      error: e?.message ?? String(e),
    });
    return NextResponse.json(out, { status: 500 });
  }
}