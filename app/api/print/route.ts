// app/api/print/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampYear(y: number) {
  // optional: begrenzen, damit niemand 1900/9999 anfragt
  if (y < 2000) return 2000;
  if (y > 2100) return 2100;
  return y;
}

/**
 * GET /api/print?year=2026
 * -> erstellt ein A4-PDF via Playwright (Chromium) aus /print?year=2026&autoprint=1
 */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);

  const year = clampYear(toInt(searchParams.get("year"), 2026));

  // Page die gerendert wird (deine Print-Seite)
  const target = `${origin}/print?year=${year}&autoprint=1`;

  // Dynamischer Import (nur Node runtime)
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Wichtig: Media "print", damit @page / print.css korrekt greift
    await page.emulateMedia({ media: "print" });

    await page.goto(target, { waitUntil: "networkidle" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    const filename = `SKEMA_Haar-Nagel-Pflanzenpflege_${year}.pdf`;

    // ✅ TS-sicher: Buffer/Uint8Array -> echtes ArrayBuffer
    const u8 = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf as any);
    const ab = new ArrayBuffer(u8.byteLength);
    new Uint8Array(ab).set(u8);

    return new Response(ab, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  } finally {
    await browser.close();
  }
}