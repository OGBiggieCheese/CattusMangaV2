// Proxy hacia Suwayomi-Server. El navegador solo habla con esta web (sin CORS), y la
// dirección real del servidor (y sus credenciales, si las tiene) nunca salen del servidor.
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, isAuthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BASE = (process.env.SUWAYOMI_URL ?? "http://127.0.0.1:4567").replace(/\/$/, "");
const AUTH =
  process.env.SUWAYOMI_USER && process.env.SUWAYOMI_PASSWORD
    ? "Basic " + Buffer.from(`${process.env.SUWAYOMI_USER}:${process.env.SUWAYOMI_PASSWORD}`).toString("base64")
    : null;

const FORWARD_REQUEST = ["content-type", "accept", "range", "if-none-match", "if-modified-since"];
// Sin content-length ni content-encoding: fetch() ya descomprime el cuerpo, así que no coincidirían.
const FORWARD_RESPONSE = [
  "content-type",
  "content-disposition",
  "content-range",
  "accept-ranges",
  "cache-control",
  "etag",
  "last-modified",
];

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  // El proxy de Next ya lo exige; se repite aquí porque esta ruta da acceso completo a Suwayomi.
  if (!(await isAuthorized(req.cookies.get(AUTH_COOKIE)?.value))) return new Response("No autorizado", { status: 401 });
  const { path } = await ctx.params;
  const target = `${BASE}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (AUTH) headers.set("authorization", AUTH);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      // Necesario en Node para reenviar el cuerpo como stream (subida de backups).
      ...(hasBody ? { duplex: "half" } : {}),
      cache: "no-store",
      redirect: "manual",
    } as RequestInit);
  } catch {
    return Response.json(
      { errors: [{ message: "No se pudo conectar con Suwayomi. ¿Está corriendo? (docker compose up -d)" }] },
      { status: 502 },
    );
  }

  const out = new Headers();
  for (const name of FORWARD_RESPONSE) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
