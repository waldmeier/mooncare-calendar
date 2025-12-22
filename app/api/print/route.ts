// app/api/print/route.ts
import { NextRequest } from "next/server";

// Wichtig: Node runtime (Playwright geht nicht im Edge runtime)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBaseUrl(req: NextRequest) {
  // 1) explizit gesetzt (empfohlen)
  const env =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    process.env.VERCEL_URL;

  if (env) {
    // VERCEL_URL kommt ohne https://
    if (env.startsWith("http://") || env.startsWith("https://")) return env;
    return `https://${env}`;
  }

  // 2) Fallback aus Request (lokal super)
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // Optional: year weiterreichen
  const year = url.searchParams.get("year") ?? "2026";

  // Optional: als Download statt inline
  const download = url.searchParams.get("download") === "1";

  const baseUrl = getBaseUrl(req);
  const target = `${baseUrl}/print?autoprint=1&year=${encodeURIComponent(year)}`;

  // Dynamischer Import, damit nur im Node runtime geladen wird
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    // in Docker/Serverless oft nötig
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Wichtig: Media "print", damit print.css/@page korrekt greift
    await page.emulateMedia({ media: "print" });

    await page.goto(target, { waitUntil: "networkidle" });

    // Falls du Fonts/Images nachlädst, kurz warten (optional)
    // await page.waitForTimeout(150);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true, // nutzt dein @page size/margins
      // margins kommen aus @page – wenn du hier angibst, überschreibt es
    });

    const filename = `SKEMA_Haar-Nagel-Pflanzenpflege_${year}.pdf`;

    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}
