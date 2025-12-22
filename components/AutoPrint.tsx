"use client";

import { useEffect } from "react";

export default function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    // Kurz warten, damit Fonts/CSS sicher geladen sind
    const t = window.setTimeout(() => {
      window.print();
    }, 300);

    return () => window.clearTimeout(t);
  }, [enabled]);

  return null;
}
