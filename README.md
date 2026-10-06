# CattusManga

Lector de manga web, en modo oscuro, que usa los repositorios de extensiones de Mihon/Tachiyomi
(por ejemplo, [Keiyoushi](https://keiyoushi.github.io)).

## Cómo funciona

```
Navegador ──► CattusManga (Next.js, :4590) ──► Suwayomi-Server (Java, :4567) ──► webs de manga
                     /api/sw/* (proxy)               │
                                                     └──► FlareSolverr (salta Cloudflare)
```

- **Suwayomi-Server** descarga y ejecuta las extensiones reales (los mismos APK que usa Mihon), así
  que cualquier fuente del repositorio funciona igual que en el móvil. También guarda la biblioteca,
  el progreso de lectura y las copias de seguridad `.tachibk`.
- **FlareSolverr** resuelve automáticamente los desafíos de Cloudflare: no hace falta ninguna extensión
  de navegador.
- **CattusManga** es la interfaz: biblioteca, exploración, búsqueda global, extensiones y lector.

## Arrancar (solo necesitas Docker Desktop)

```bash
docker compose up -d
```

Abre <http://localhost:4590> (pide la contraseña de `CATTUS_PASSWORD` en el archivo `.env`), entra en **Extensiones**, instala las fuentes que quieras y ve a **Explorar**.
La primera vez tarda un par de minutos en descargar las imágenes de Docker.

| Acción | Comando |
| --- | --- |
| Parar todo | `docker compose down` |
| Actualizar a la última versión | `docker compose pull && docker compose up -d --build` |
| Ver los logs del servidor | `docker compose logs -f suwayomi` |

Los datos (biblioteca, extensiones instaladas, progreso) viven en el volumen `suwayomi-data` y se
conservan entre reinicios.

## Desarrollo

```bash
docker compose up -d suwayomi flaresolverr   # solo el backend
npm install
npm run dev                                  # http://localhost:3000
```

La web encuentra Suwayomi en `http://127.0.0.1:4567` por defecto; cámbialo con la variable
`SUWAYOMI_URL`.

## Repositorios de extensiones

`docker-compose.yml` añade Keiyoushi por defecto. Puedes añadir o quitar más desde
**Extensiones → Repositorios** pegando la URL del índice (`index.pb` o `index.min.json`).

## Publicarlo para tus amigos

Suwayomi necesita un servidor que ejecute Java de forma continua, así que **no puede alojarse en
Vercel**. Opciones:

- Un VPS o un PC de casa con `docker compose up -d` y un túnel (por ejemplo, Cloudflare Tunnel).
- Railway, Fly.io o similares, que ejecutan contenedores Docker.

Antes de exponerlo a Internet:

1. Activa la autenticación de Suwayomi (`AUTH_MODE=basic_auth`, `AUTH_USERNAME`, `AUTH_PASSWORD`) y
   pasa las mismas credenciales a la web con `SUWAYOMI_USER` y `SUWAYOMI_PASSWORD`.
2. La web ya pide la contraseña de `CATTUS_PASSWORD`, pero quien la sepa tiene acceso completo a la
   API de Suwayomi (incluidos sus ajustes) a través del proxy `/api/sw`. Usa una contraseña larga y
   sirve la web solo por HTTPS (el túnel de Cloudflare ya lo hace).
3. Suwayomi tiene **una sola biblioteca**. Para cuentas separadas por amigo, habría que guardar la
   biblioteca y el progreso por usuario (por ejemplo, en Supabase) y usar Suwayomi solo como motor de fuentes.
