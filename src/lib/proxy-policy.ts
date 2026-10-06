// Qué peticiones deja pasar el proxy /api/sw hacia Suwayomi.
//
// Suwayomi expone mucho más de lo que esta web necesita, incluidas rutas GET de su API antigua
// que cambian cosas (instalar extensiones, añadir a la biblioteca…). Como la cookie de sesión
// viaja también cuando se llega desde un enlace de otra web, esas rutas permitirían a cualquier
// página actuar en tu nombre (CSRF). Por eso solo se admite:
//   - GET a recursos de solo lectura: portadas, páginas, iconos y copias de seguridad.
//   - POST a la API GraphQL, y solo desde esta misma web.

export type ProxyRequest = {
  method: string;
  /** Ruta dentro de Suwayomi, empezando por "/" (sin la query). */
  path: string;
  /** Cabecera Sec-Fetch-Site (la envían todos los navegadores actuales). */
  secFetchSite?: string | null;
  /** Cabecera Origin. */
  origin?: string | null;
  /** Cabecera Host de la petición (para comparar con Origin). */
  host?: string | null;
  /** X-Forwarded-Host, si hay un proxy delante (túnel, puente) que reescribe Host. */
  forwardedHost?: string | null;
};

export type ProxyDecision = { ok: true } | { ok: false; status: 403 | 405; reason: string };

const READ_ONLY_GET = [
  /^\/api\/v1\/manga\/\d+\/thumbnail$/,
  /^\/api\/v1\/manga\/\d+\/chapter\/\d+\/page\/\d+$/,
  /^\/api\/v1\/extension\/icon\/[\w.-]+$/,
  /^\/api\/graphql\/files\/backup\/[\w.-]+\.tachibk$/,
];

const GRAPHQL = "/api/graphql";

/**
 * ¿Viene la petición de esta misma web? Se usa Sec-Fetch-Site, que calcula el propio navegador y no
 * depende de proxies intermedios; Origin solo como respaldo para navegadores antiguos. Sin ninguna de
 * las dos (clientes que no son navegador) no hay riesgo de CSRF: además necesitarían la cookie.
 */
export function isSameOrigin({
  secFetchSite,
  origin,
  host,
  forwardedHost,
}: Pick<ProxyRequest, "secFetchSite" | "origin" | "host" | "forwardedHost">): boolean {
  if (secFetchSite) return secFetchSite === "same-origin";
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return false;
    }
    const allowed = [host, ...(forwardedHost?.split(",").map((h) => h.trim()) ?? [])].filter(Boolean);
    return allowed.includes(originHost);
  }
  return true;
}

export function checkProxyRequest(req: ProxyRequest): ProxyDecision {
  const method = req.method.toUpperCase();

  if (method === "GET" || method === "HEAD") {
    if (READ_ONLY_GET.some((re) => re.test(req.path))) return { ok: true };
    return { ok: false, status: 403, reason: "Ruta no permitida" };
  }

  if (method === "POST") {
    if (req.path !== GRAPHQL) return { ok: false, status: 403, reason: "Ruta no permitida" };
    if (!isSameOrigin(req)) return { ok: false, status: 403, reason: "Origen no permitido" };
    return { ok: true };
  }

  return { ok: false, status: 405, reason: "Método no permitido" };
}
