# CattusManga

[![CI](https://github.com/OGBiggieCheese/CattusMangaV2/actions/workflows/ci.yml/badge.svg)](https://github.com/OGBiggieCheese/CattusMangaV2/actions/workflows/ci.yml)

Un lector de manga para el navegador que funciona con las mismas extensiones que
[Mihon](https://mihon.app) (antes Tachiyomi). Lo uso desde el PC y desde el móvil.

Mihon es la app de referencia para leer manga en Android, pero solo existe ahí. Quería la misma
experiencia (mis fuentes, mi biblioteca, mi progreso) en cualquier pantalla, con una interfaz cuidada
y que se levantara con un solo comando.

## Qué puedes hacer

- **Biblioteca** con categorías, filtros (sin leer, descargados, por fuente) y varios órdenes.
- **Novedades**: busca capítulos nuevos de toda tu biblioteca y te los muestra por día.
- **Explorar** cada fuente (populares, recientes, búsqueda con los filtros propios de cada extensión)
  o **buscar en todas a la vez**.
- **Lector** en cascada (webtoon) o página a página, de izquierda a derecha o al estilo manga, con
  precarga del siguiente capítulo y atajos de teclado. Recuerda dónde lo dejaste.
- **Historial** agrupado por manga y por día, con "deshacer" al quitar algo.
- **Descargas** al servidor, para leer aunque la web original caiga.
- **Perfil** con estadísticas: rachas de lectura, mapa de actividad, lo más leído y géneros favoritos.
- **Extensiones**: instalar, actualizar y ordenar fuentes, y añadir repositorios compatibles con Mihon.
- **Copias de seguridad** `.tachibk`, compatibles con Mihon, Tachiyomi y Suwayomi.
- Tema claro y oscuro, buscador rápido (`Ctrl K`) y diseño pensado también para el móvil.

## Cómo está hecho

```
Navegador ──► CattusManga (Next.js) ──► Suwayomi-Server (Java) ──► webs de manga
                 /api/sw (proxy)               │
                                               └──► FlareSolverr (resuelve Cloudflare)
```

Las extensiones de Mihon son APKs de Android, así que no se pueden ejecutar en el navegador. Para eso
uso [Suwayomi-Server](https://github.com/Suwayomi/Suwayomi-Server), que las carga en la JVM y expone
una API GraphQL. CattusManga es la interfaz propia que va encima.

| Parte | Tecnología |
| --- | --- |
| Interfaz | Next.js 16 (App Router), React 19, TypeScript |
| Datos | TanStack Query (caché, reintentos, scroll infinito) |
| Estado local | Zustand (preferencias del navegador) |
| Estilos | Tailwind CSS 4, tema claro/oscuro con variables CSS |
| Tests | Vitest |
| Despliegue | Docker Compose (web + Suwayomi + FlareSolverr) |

### Algunas decisiones que me gustan

- **El proxy no es un túnel abierto.** El navegador nunca habla directamente con Suwayomi; todo pasa
  por `/api/sw`, que solo deja pasar lo que la web usa: imágenes por GET y GraphQL por POST desde el
  mismo origen. Suwayomi tiene rutas GET antiguas que modifican datos (instalar una extensión, por
  ejemplo); sin esta lista, cualquier web podría lanzarlas con tu sesión (CSRF). Está en
  [`src/lib/proxy-policy.ts`](src/lib/proxy-policy.ts), con sus tests.
- **Novedades sin ruido.** Al añadir un manga de 300 capítulos, todos llegan "nuevos" a la vez. Para
  no inundar la lista, se descartan los que llegaron en la primera carga de cada manga.
- **Historial que se puede limpiar.** Suwayomi no permite borrar el historial, así que oculto entradas
  con metadatos del capítulo guardados en el servidor. Si vuelves a leer ese manga, reaparece solo.
- **Búsqueda global sin saturar.** Buscar en 30 fuentes a la vez satura Suwayomi y FlareSolverr; las
  peticiones van en tandas de 6 con tiempo límite, y los resultados aparecen según llegan.
- **Errores visibles y acciones seguras.** Cualquier acción que falla muestra un aviso. Las que borran
  algo piden confirmación. Las ventanas emergentes usan `<dialog>` nativo (foco atrapado, `Esc`,
  lectores de pantalla) y en el móvil salen como hoja inferior.

## Probarlo

Solo necesitas [Docker](https://www.docker.com/products/docker-desktop/).

```bash
cp .env.example .env      # y cambia la contraseña
docker compose up -d
```

Abre <http://localhost:4590>, entra con la contraseña del `.env`, ve a **Extensiones** e instala alguna
fuente. La primera vez tarda un par de minutos en descargar las imágenes de Docker.

| Para… | Comando |
| --- | --- |
| Parar todo | `docker compose down` |
| Actualizar | `docker compose pull && docker compose up -d --build` |
| Ver los registros de Suwayomi | `docker compose logs -f suwayomi` |

La biblioteca, las extensiones y el progreso se guardan en el volumen `suwayomi-data`.

## Desarrollo

```bash
docker compose up -d suwayomi flaresolverr   # solo el backend
npm install
npm run dev                                  # http://localhost:3000
```

| Comando | Qué hace |
| --- | --- |
| `npm test` | Tests unitarios |
| `npm run typecheck` | Comprobación de tipos |
| `npm run build` | Compilación de producción |

La lógica que no depende de la interfaz (proxy, autenticación, historial, novedades, estadísticas,
fechas) está en `src/lib`, con sus tests al lado. El CI ejecuta tipos, tests y build en cada push.

```
src/
├── app/          páginas (biblioteca, novedades, explorar, lector, perfil…) y rutas de API
├── components/   interfaz compartida (Modal, avisos, confirmación, buscador rápido…)
├── lib/          cliente de la API, lógica pura y sus tests
└── proxy.ts      exige la contraseña antes de servir nada
```

## Exponerlo a Internet

Suwayomi necesita un proceso Java en marcha todo el tiempo, así que no sirve un hosting estático ni
Vercel. Lo más sencillo es un VPS o un PC de casa con Docker y un túnel (Cloudflare Tunnel, por
ejemplo). Antes de hacerlo:

1. Usa una contraseña larga en `CATTUS_PASSWORD` y sirve la web solo por HTTPS.
2. Quita la línea `ports` del servicio `suwayomi` en `docker-compose.yml`: solo hace falta para
   desarrollar, y deja Suwayomi accesible sin contraseña en tu PC.
3. Si quieres más capas, activa la autenticación de Suwayomi (`AUTH_MODE=basic_auth`) y pasa las
   credenciales a la web con `SUWAYOMI_USER` y `SUWAYOMI_PASSWORD`.

Suwayomi tiene una sola biblioteca, así que hoy CattusManga es para una persona. El apartado Perfil
está pensado para crecer hacia varios usuarios más adelante.

## Aviso

CattusManga no aloja ni distribuye contenido. Solo muestra lo que devuelven las extensiones que tú
instales, igual que Mihon.
