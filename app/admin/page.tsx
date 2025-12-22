// app/admin/page.tsx
import { Suspense } from "react";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-sm text-zinc-600">Lade Admin…</div>}
    >
      <AdminClient />
    </Suspense>
  );
}