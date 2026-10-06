// Pide la contraseña antes de servir cualquier página o llamada a la API.
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isAuthorized } from "@/lib/auth";

const PUBLIC = ["/acceso", "/api/acceso"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.includes(pathname) || (await isAuthorized(req.cookies.get(AUTH_COOKIE)?.value))) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const url = new URL("/acceso", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Todo menos los recursos estáticos de Next (no contienen datos tuyos y la pantalla de acceso los necesita).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon).*)"],
};
