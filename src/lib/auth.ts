// Contraseña de acceso a la web. Se define con CATTUS_PASSWORD (en el .env que lee docker compose).
// Tras acertarla, el navegador guarda una cookie derivada de ella: cambiar la contraseña cierra
// todas las sesiones. Sin CATTUS_PASSWORD (p. ej. en `npm run dev`) la web queda abierta.

export const AUTH_COOKIE = "cattus_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 365;

export const authPassword = () => process.env.CATTUS_PASSWORD ?? "";

/** Valor de la cookie de sesión: HMAC-SHA256 con la contraseña como clave. */
export async function sessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("cattusmanga-session-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparación en tiempo constante, para no filtrar cuántos caracteres coinciden. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function isAuthorized(cookie: string | undefined): Promise<boolean> {
  const password = authPassword();
  if (!password) return true;
  return !!cookie && safeEqual(cookie, await sessionToken(password));
}
