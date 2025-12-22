"use client";

import { useEffect } from "react";

export default function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    // Kleiner Delay, damit Layout & Fonts fertig sind
    const t = window.setTimeout(() => {
      window.print();
    }, 250);

    return () => window.clearTimeout(t);
  }, [enabled]);

  return null;
}
