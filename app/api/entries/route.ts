// app/api/days/route.ts
import { prisma } from "@/lib/db";
import { effectiveHnw, isMoonPhase, isZodiac } from "@/lib/rules";
import { NextResponse } from "next/server";

export async function GET() {
  const items = await prisma.dayEntry.findMany({ orderBy: { date: "asc" } });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const date = new Date(body.date);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
  }

  // WICHTIG: immer einen definierten Wert setzen (inkl. OTHER)
  const zodiac = isZodiac(body.zodiac) ? body.zodiac : "OTHER";
  const phase = isMoonPhase(body.phase) ? body.phase : "OTHER";
  const note = typeof body.note === "string" ? body.note : "";

  // hnw abgeleitet: nur wenn zodiac != OTHER
  const hnwDerived = zodiac !== "OTHER" ? effectiveHnw(zodiac) : false;

  const saved = await prisma.dayEntry.upsert({
    where: { date },
    update: {
      zodiac,
      phase,
      hnw: hnwDerived,
      note: note.trim().length ? note.trim() : null,
    },
    create: {
      date,
      zodiac,
      phase,
      hnw: hnwDerived,
      note: note.trim().length ? note.trim() : null,
    },
  });

  return NextResponse.json(saved);
}
