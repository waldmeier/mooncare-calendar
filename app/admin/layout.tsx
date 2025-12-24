// app/admin/layout.tsx
import { headers } from "next/headers";
import { ReactNode } from "react";

export const dynamic = "force-dynamic";

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Admin Area"',
    },
  });
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const h = headers();
  const auth = h.get("authorization");

  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  if (!auth || !user || !pass) {
    throw unauthorized();
  }

  const [type, encoded] = auth.split(" ");
  if (type !== "Basic" || !encoded) {
    throw unauthorized();
  }

  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  const [u, p] = decoded.split(":");

  if (u !== user || p !== pass) {
    throw unauthorized();
  }

  return <>{children}</>;
}