export const ZODIACS = [
  "LOEWE",
  "JUNGFRAU",
  "FISCHE",
  "KREBS",
  "SKORPION",
  "STEINBOCK",
  "OTHER",
] as const;

export type Zodiac = (typeof ZODIACS)[number];

export const PHASES = [
  "NEW",
  "FIRST_QUARTER",
  "FULL",
  "LAST_QUARTER",
  "OTHER",
] as const;

export type MoonPhase = (typeof PHASES)[number];

export function isZodiac(value: unknown): value is Zodiac {
  return typeof value === "string" && (ZODIACS as readonly string[]).includes(value);
}

export function isMoonPhase(value: unknown): value is MoonPhase {
  return typeof value === "string" && (PHASES as readonly string[]).includes(value);
}

/**
 * Bezeichnungen (wie im Excel, unter 1)
 * Standard-Definition:
 * - FIRST_QUARTER = Zunehmender Mond
 * - LAST_QUARTER  = Abnehmender Mond
 */
export const MOON_PHASE_LABEL: Record<MoonPhase, string> = {
  NEW: "Neumond",
  FULL: "Vollmond",
  FIRST_QUARTER: "Zunehmender Mond",
  LAST_QUARTER: "Abnehmender Mond",
  OTHER: "—",
};

/**
 * Hnw-Regel:
 * - FISCHE => Hnw automatisch aktiv
 * - alle anderen => Hnw aus
 */
export function effectiveHnw(zodiac: Zodiac): boolean {
  return zodiac === "FISCHE";
}

export function zodiacColor(z: Zodiac): string {
  switch (z) {
    case "LOEWE":
      return "bg-rose-200";
    case "JUNGFRAU":
      return "bg-green-200";
    case "FISCHE":
    case "KREBS":
    case "SKORPION":
      return "bg-sky-200";
    case "STEINBOCK":
      return "bg-orange-200";
    default:
      return "bg-white";
  }
}

export function tasksForDay(zodiac: Zodiac) {
  const tasks: { key: string; label: string }[] = [];

  if (zodiac === "LOEWE" || zodiac === "JUNGFRAU") {
    tasks.push({ key: "hair", label: "✂︎ Haare schneiden" });
  }

  if (zodiac === "FISCHE") {
    tasks.push({ key: "plants_hnw", label: "💧 Pflanzen giess./Hnw" });
  } else if (zodiac === "KREBS" || zodiac === "SKORPION") {
    tasks.push({ key: "plants", label: "💧 Pflanzen giessen" });
  }

  if (zodiac === "STEINBOCK") {
    tasks.push({ key: "nails", label: "💅 Nagelpflege" });
  }

  return tasks;
}

/**
 * Optional: falls du irgendwo noch ein Textsymbol brauchst.
 * (Für die echte Darstellung bitte MoonBadge / MoonIcon verwenden.)
 */
export function phaseDot(_phase: MoonPhase): string | null {
  return null;
}

/**
 * Semantik für UI:
 * - NEW  = new
 * - FULL = full
 * - FIRST_QUARTER = waxing (zunehmend)
 * - LAST_QUARTER  = waning (abnehmend)
 */
export type MoonVisual = "new" | "full" | "waxing" | "waning";

export function phaseVisual(phase: MoonPhase): MoonVisual | null {
  switch (phase) {
    case "NEW":
      return "new";
    case "FULL":
      return "full";
    case "FIRST_QUARTER":
      return "waxing";
    case "LAST_QUARTER":
      return "waning";
    default:
      return null;
  }
}
