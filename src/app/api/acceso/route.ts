// Comprueba la contraseña y deja la cookie de sesión.
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE, authPassword, safeEqual, sessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Freno a los intentos a ciegas: tras 5 fallos seguidos desde la misma IP, 1 minuto de espera.
const MAX_FAILS = 5;
const LOCK_MS = 60_000;
const fails = new Map<string, { count: number; until: number }>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const entry = fails.get(ip);
  if (entry && entry.until > Date.now()) return NextResponse.json({ ok: false }, { status: 429 });

  const body = await req.json().catch(() => null);
  const given = typeof body?.password === "string" ? body.password : "";
  const password = authPassword();

  if (!password || !safeEqual(given, password)) {
    const count = (entry?.count ?? 0) + 1;
    fails.set(ip, { count: count >= MAX_FAILS ? 0 : count, until: count >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    await sleep(600);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  fails.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await sessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}
