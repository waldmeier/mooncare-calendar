// app/admin/page.tsx
import { headers } from "next/headers";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Admin Area"',
    },
  });
}

export default function AdminPage() {
  const auth = headers().get("authorization");

  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  if (!user || !pass || !auth) {
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

  return <AdminClient />;
}