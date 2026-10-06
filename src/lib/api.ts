// Cliente de la API GraphQL de Suwayomi (a través del proxy /api/sw).
export const SW = "/api/sw";

/** Convierte una ruta de Suwayomi ("/api/v1/manga/1/thumbnail") en una URL servible por esta web. */
export const swUrl = (path?: string | null) => (path ? (path.startsWith("http") ? path : SW + path) : "");

/** Enlace externo dado por una extensión: solo http(s), para que no pueda colar un `javascript:`. */
export const safeHref = (url?: string | null) => (url && /^https?:\/\//i.test(url) ? url : null);

export type ContentWarning = "SAFE" | "MIXED" | "NSFW";
export type MangaStatus =
  | "UNKNOWN"
  | "ONGOING"
  | "COMPLETED"
  | "LICENSED"
  | "PUBLISHING_FINISHED"
  | "CANCELLED"
  | "ON_HIATUS";

export interface Source {
  id: string;
  name: string;
  displayName: string;
  lang: string;
  iconUrl: string;
  supportsLatest: boolean;
  contentWarning: ContentWarning;
  homeUrl: string | null;
}

// Filtros de búsqueda que declara cada extensión (géneros, tipo, orden…).
export type TriState = "IGNORE" | "INCLUDE" | "EXCLUDE";
export interface SortSelection {
  index: number;
  ascending: boolean;
}
export type SourceFilter =
  | { __typename: "HeaderFilter" | "SeparatorFilter"; name: string }
  | { __typename: "SelectFilter"; name: string; values: string[]; selectDefault: number }
  | { __typename: "TextFilter"; name: string; textDefault: string }
  | { __typename: "CheckBoxFilter"; name: string; checkBoxDefault: boolean }
  | { __typename: "TriStateFilter"; name: string; triDefault: TriState }
  | { __typename: "SortFilter"; name: string; values: string[]; sortDefault: SortSelection | null }
  | { __typename: "GroupFilter"; name: string; filters: SourceFilter[] };

/** Valor elegido para un filtro (mismos campos que FilterChangeInput de Suwayomi). */
export type FilterValue = {
  selectState?: number;
  textState?: string;
  checkBoxState?: boolean;
  triState?: TriState;
  sortState?: SortSelection;
};
/** Valores no predeterminados, por posición: "3" para un filtro, "5.2" para un hijo de un grupo. */
export type FilterValues = Record<string, FilterValue>;

/** Convierte los valores elegidos en la lista de cambios que espera fetchSourceManga. */
export const filterChanges = (values: FilterValues) =>
  Object.entries(values).map(([key, value]) => {
    const [pos, child] = key.split(".").map(Number);
    return child === undefined ? { position: pos, ...value } : { position: pos, groupChange: { position: child, ...value } };
  });

export interface Extension {
  pkgName: string;
  name: string;
  lang: string;
  iconUrl: string;
  versionName: string;
  isInstalled: boolean;
  hasUpdate: boolean;
  isObsolete: boolean;
  contentWarning: ContentWarning;
  storeIndexUrl: string | null;
}

export interface ExtensionStore {
  name: string;
  indexUrl: string;
  badgeLabel: string;
  contactWebsite: string;
  isLegacy: boolean;
  extensions: { totalCount: number };
}

export interface MangaCardData {
  id: number;
  title: string;
  thumbnailUrl: string | null;
  thumbnailUrlLastFetched: string | null;
  inLibrary: boolean;
}

/** URL de la portada con su versión, para que el navegador no muestre una portada antigua cacheada. */
export const coverUrl = (m: Pick<MangaCardData, "thumbnailUrl" | "thumbnailUrlLastFetched">) =>
  m.thumbnailUrl ? `${swUrl(m.thumbnailUrl)}${m.thumbnailUrlLastFetched ? `?v=${m.thumbnailUrlLastFetched}` : ""}` : null;

export interface Category {
  id: number;
  name: string;
  default: boolean;
  order: number;
}

export interface LibraryManga extends MangaCardData {
  unreadCount: number;
  downloadCount: number;
  /** Marcas de tiempo tal como las da Suwayomi (strings numéricos); solo se comparan entre sí. */
  inLibraryAt: string;
  lastReadChapter: { lastReadAt: string } | null;
  latestUploadedChapter: { uploadDate: string } | null;
  latestFetchedChapter: { fetchedAt: string } | null;
  source: { id: string; displayName: string } | null;
  categories: { nodes: { id: number }[] };
}

export interface MangaDetails extends MangaCardData {
  author: string | null;
  artist: string | null;
  description: string | null;
  genre: string[];
  status: MangaStatus;
  realUrl: string | null;
  initialized: boolean;
  chaptersLastFetchedAt: string | null;
  source: { id: string; displayName: string; iconUrl: string } | null;
}

export interface Chapter {
  id: number;
  name: string;
  chapterNumber: number;
  scanlator: string | null;
  sourceOrder: number;
  uploadDate: string;
  isRead: boolean;
  isBookmarked: boolean;
  isDownloaded: boolean;
  lastPageRead: number;
  pageCount: number;
  lastReadAt: string;
}

export type DownloadState = "QUEUED" | "DOWNLOADING" | "FINISHED" | "ERROR";
export interface DownloadItem {
  state: DownloadState;
  /** De 0 a 1. */
  progress: number;
  tries: number;
  chapter: { id: number; name: string; mangaId: number };
  manga: { id: number; title: string };
}
export interface DownloadStatus {
  state: "STARTED" | "STOPPED";
  queue: DownloadItem[];
}
export interface DownloadedChapter {
  id: number;
  name: string;
  sourceOrder: number;
  manga: MangaCardData;
}

export interface HistoryEntry {
  id: number;
  name: string;
  lastPageRead: number;
  pageCount: number;
  lastReadAt: string;
  isRead: boolean;
  manga: MangaCardData;
  meta: { key: string; value: string }[];
}

/** Clave de metadata de capítulo (guardada en Suwayomi) usada para ocultar una entrada del historial. */
const HIDDEN_HISTORY_META_KEY = "cattus_hiddenFromHistory";

/** Limpia los mensajes de error de Suwayomi (que incluyen el stack trace de Java). */
function cleanError(message: string): string {
  let msg = message
    .replace(/^Exception while fetching data \([^)]*\)\s*:\s*/i, "")
    .split(/\r?\n/)[0]
    .trim();
  const http = msg.match(/HTTP error (\d{3})/i)?.[1];
  if (http === "403" || http === "503")
    msg = `La web de la fuente bloqueó la petición (HTTP ${http}). Suele ser Cloudflare: reintenta en unos segundos.`;
  else if (http === "404") msg = "La fuente respondió 404: puede que la web haya cambiado o la extensión esté rota.";
  else if (http) msg = `La fuente respondió con un error HTTP ${http}.`;
  else if (/timeout/i.test(msg)) msg = "La fuente tardó demasiado en responder.";
  return msg || "Error desconocido";
}

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SW}/api/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error("Sin conexión con el servidor.");
  }
  const json = await res.json().catch(() => null);
  if (!json) throw new Error(`El servidor respondió ${res.status}.`);
  if (json.errors?.length) throw new Error(cleanError(json.errors[0].message));
  return json.data as T;
}

/**
 * Limita cuántas tareas corren a la vez. Lanzar decenas de búsquedas juntas satura Suwayomi y
 * FlareSolverr y todas acaban llegando tarde; en tandas pequeñas las primeras llegan enseguida.
 */
function limiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active < max) active++;
    else await new Promise<void>((resolve) => waiting.push(resolve)); // hereda el hueco de quien termina
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(message)), ms))),
  ]).finally(() => clearTimeout(timer));
}

const searchSlot = limiter(6);
const GLOBAL_SEARCH_TIMEOUT = 25_000;

// ---------------------------------------------------------------- Fragmentos
const SOURCE = `id name displayName lang iconUrl supportsLatest contentWarning homeUrl`;
const EXTENSION = `pkgName name lang iconUrl versionName isInstalled hasUpdate isObsolete contentWarning storeIndexUrl`;
const CHAPTER = `id name chapterNumber scanlator sourceOrder uploadDate isRead isBookmarked isDownloaded lastPageRead pageCount lastReadAt`;
const MANGA_CARD = `id title thumbnailUrl thumbnailUrlLastFetched inLibrary`;
// `default` cambia de tipo según el filtro, así que GraphQL obliga a renombrarlo en cada uno.
const FILTER = `__typename
  ... on HeaderFilter { name } ... on SeparatorFilter { name }
  ... on SelectFilter { name values selectDefault: default }
  ... on TextFilter { name textDefault: default }
  ... on CheckBoxFilter { name checkBoxDefault: default }
  ... on TriStateFilter { name triDefault: default }
  ... on SortFilter { name values sortDefault: default { index ascending } }`;

// ---------------------------------------------------------------- Fuentes / extensiones
export const api = {
  about: () =>
    gql<{ aboutServer: { name: string; version: string; buildType: string } }>(
      `{ aboutServer { name version buildType } }`,
    ).then((d) => d.aboutServer),

  sources: () =>
    gql<{ sources: { nodes: Source[] } }>(`{ sources { nodes { ${SOURCE} } } }`).then((d) =>
      d.sources.nodes.filter((s) => s.id !== "0"),
    ),

  extensions: () =>
    gql<{ extensions: { nodes: Extension[] } }>(`{ extensions { nodes { ${EXTENSION} } } }`).then(
      (d) => d.extensions.nodes,
    ),

  /** Descarga de nuevo los índices de todas las tiendas de extensiones. */
  refreshExtensions: () =>
    gql<{ fetchExtensions: { extensions: Extension[] } }>(
      `mutation { fetchExtensions(input: {}) { extensions { ${EXTENSION} } } }`,
    ).then((d) => d.fetchExtensions.extensions),

  updateExtension: (pkgName: string, patch: { install?: boolean; uninstall?: boolean; update?: boolean }) =>
    gql(`mutation($id: String!, $patch: UpdateExtensionPatchInput!) {
      updateExtension(input: { id: $id, patch: $patch }) { extension { pkgName } } }`, { id: pkgName, patch }),

  stores: () =>
    gql<{ extensionStores: { nodes: ExtensionStore[] } }>(
      `{ extensionStores { nodes { name indexUrl badgeLabel contactWebsite isLegacy extensions { totalCount } } } }`,
    ).then((d) => d.extensionStores.nodes),

  addStore: (indexUrl: string) =>
    gql(`mutation($u: String!) { addExtensionStore(input: { indexUrl: $u }) { clientMutationId } }`, { u: indexUrl }),

  removeStore: (indexUrl: string) =>
    gql(`mutation($u: String!) { removeExtensionStore(input: { indexUrl: $u }) { clientMutationId } }`, {
      u: indexUrl,
    }),

  // -------------------------------------------------------------- Navegación de fuentes
  browse: (source: string, type: "POPULAR" | "LATEST" | "SEARCH", page: number, query?: string, filters?: FilterValues) =>
    gql<{ fetchSourceManga: { hasNextPage: boolean; mangas: MangaCardData[] } }>(
      `mutation($s: LongString!, $t: FetchSourceMangaType!, $p: Int!, $q: String, $f: [FilterChangeInput!]) {
        fetchSourceManga(input: { source: $s, type: $t, page: $p, query: $q, filters: $f }) {
          hasNextPage mangas { ${MANGA_CARD} } } }`,
      { s: source, t: type, p: page, q: query || null, f: filters && type === "SEARCH" ? filterChanges(filters) : null },
    ).then((d) => d.fetchSourceManga),

  /** Primera página de resultados para la búsqueda global: en tandas y con tiempo límite. */
  globalSearch: (source: string, query: string) =>
    searchSlot(() =>
      withTimeout(api.browse(source, "SEARCH", 1, query), GLOBAL_SEARCH_TIMEOUT, "La fuente tardó demasiado en responder."),
    ),

  sourceFilters: (source: string) =>
    gql<{ source: { filters: SourceFilter[] } }>(
      `query($id: LongString!) { source(id: $id) { filters { ${FILTER} ... on GroupFilter { name filters { ${FILTER} } } } } }`,
      { id: source },
    ).then((d) => d.source.filters),

  // -------------------------------------------------------------- Manga
  manga: (id: number) =>
    gql<{ manga: MangaDetails }>(
      `query($id: Int!) { manga(id: $id) {
        ${MANGA_CARD} author artist description genre status realUrl initialized chaptersLastFetchedAt
        source { id displayName: name iconUrl } } }`,
      { id },
    ).then((d) => d.manga),

  /** Pide a la fuente los datos y capítulos actualizados del manga. */
  refreshManga: (id: number) =>
    gql(
      `mutation($id: Int!) { fetchMangaAndChapters(input: { id: $id, fetchManga: true, fetchChapters: true }) {
        manga { id } } }`,
      { id },
    ),

  chapters: (mangaId: number) =>
    gql<{ chapters: { nodes: Chapter[] } }>(
      `query($id: Int!) { chapters(condition: { mangaId: $id }, order: [{ by: SOURCE_ORDER, byType: DESC }]) {
        nodes { ${CHAPTER} } } }`,
      { id: mangaId },
    ).then((d) => d.chapters.nodes),

  setInLibrary: (id: number, inLibrary: boolean) =>
    gql(`mutation($id: Int!, $v: Boolean!) { updateManga(input: { id: $id, patch: { inLibrary: $v } }) {
      manga { id inLibrary } } }`, { id, v: inLibrary }),

  library: () =>
    gql<{ mangas: { nodes: LibraryManga[] } }>(
      `{ mangas(condition: { inLibrary: true }, order: [{ by: IN_LIBRARY_AT, byType: DESC }]) {
        nodes { ${MANGA_CARD} unreadCount downloadCount inLibraryAt lastReadChapter { lastReadAt }
          latestUploadedChapter { uploadDate } latestFetchedChapter { fetchedAt }
          source { id displayName } categories { nodes { id } } } } }`,
    ).then((d) => d.mangas.nodes),

  // -------------------------------------------------------------- Categorías
  categories: () =>
    gql<{ categories: { nodes: Category[] } }>(
      `{ categories { nodes { id name default order } } }`,
    ).then((d) => d.categories.nodes.filter((c) => !c.default).sort((a, b) => a.order - b.order)),

  createCategory: (name: string) =>
    gql<{ createCategory: { category: Category } }>(
      `mutation($name: String!) { createCategory(input: { name: $name }) { category { id name default order } } }`,
      { name },
    ).then((d) => d.createCategory.category),

  renameCategory: (id: number, name: string) =>
    gql(`mutation($id: Int!, $name: String!) { updateCategory(input: { id: $id, patch: { name: $name } }) {
      category { id } } }`, { id, name }),

  deleteCategory: (id: number) =>
    gql(`mutation($id: Int!) { deleteCategory(input: { categoryId: $id }) { category { id } } }`, { id }),

  /** Añade y/o quita un manga de categorías de biblioteca. */
  updateMangaCategories: (mangaId: number, patch: { addToCategories?: number[]; removeFromCategories?: number[] }) =>
    gql(`mutation($id: Int!, $p: UpdateMangaCategoriesPatchInput!) { updateMangaCategories(input: { id: $id, patch: $p }) {
      manga { id } } }`, { id: mangaId, p: patch }),

  history: (limit = 60) =>
    gql<{ chapters: { nodes: HistoryEntry[] } }>(
      `query($n: Int!) { chapters(filter: { lastReadAt: { greaterThan: "0" } },
        order: [{ by: LAST_READ_AT, byType: DESC }], first: $n) {
        nodes { id name lastPageRead pageCount lastReadAt isRead manga { ${MANGA_CARD} } meta { key value } } } }`,
      { n: limit },
    ).then((d) => d.chapters.nodes),

  /**
   * Oculta/muestra una entrada del historial. Suwayomi no permite borrar el historial (deriva de
   * lastReadAt, que no es editable), así que se marca con metadata del capítulo: se guarda en el
   * propio servidor y por eso es consistente entre navegadores/dispositivos.
   */
  hideFromHistory: (chapterId: number) =>
    gql(`mutation($id: Int!, $k: String!, $v: String!) { setChapterMeta(input: { meta: { chapterId: $id, key: $k, value: $v } }) {
      clientMutationId } }`, { id: chapterId, k: HIDDEN_HISTORY_META_KEY, v: "true" }),

  isHiddenFromHistory: (entry: Pick<HistoryEntry, "meta">) =>
    entry.meta.some((m) => m.key === HIDDEN_HISTORY_META_KEY && m.value === "true"),

  // -------------------------------------------------------------- Capítulos / lector
  chapter: (id: number) =>
    gql<{ chapter: Chapter & { mangaId: number; manga: { id: number; title: string } } }>(
      `query($id: Int!) { chapter(id: $id) { ${CHAPTER} mangaId manga { id title } } }`,
      { id },
    ).then((d) => d.chapter),

  pages: (chapterId: number) =>
    gql<{ fetchChapterPages: { pages: string[] } }>(
      `mutation($id: Int!) { fetchChapterPages(input: { chapterId: $id }) { pages } }`,
      { id: chapterId },
    ).then((d) => d.fetchChapterPages.pages.map(swUrl)),

  updateChapter: (id: number, patch: { isRead?: boolean; lastPageRead?: number; isBookmarked?: boolean }) =>
    gql(`mutation($id: Int!, $p: UpdateChapterPatchInput!) { updateChapter(input: { id: $id, patch: $p }) {
      chapter { id } } }`, { id, p: patch }),

  updateChapters: (ids: number[], patch: { isRead?: boolean; isBookmarked?: boolean }) =>
    gql(`mutation($ids: [Int!]!, $p: UpdateChapterPatchInput!) { updateChapters(input: { ids: $ids, patch: $p }) {
      clientMutationId } }`, { ids, p: patch }),

  // -------------------------------------------------------------- Descargas
  // Suwayomi guarda las páginas en su disco: un capítulo descargado se lee sin depender de la web original.
  downloadStatus: () =>
    gql<{ downloadStatus: DownloadStatus }>(
      `{ downloadStatus { state queue { state progress tries chapter { id name mangaId } manga { id title } } } }`,
    ).then((d) => d.downloadStatus),

  /** Encola capítulos y se asegura de que el descargador esté en marcha. */
  download: async (ids: number[]) => {
    if (!ids.length) return;
    await gql(`mutation($ids: [Int!]!) { enqueueChapterDownloads(input: { ids: $ids }) { clientMutationId } }`, { ids });
    await gql(`mutation { startDownloader(input: {}) { clientMutationId } }`);
  },

  /** Quita capítulos de la cola de descargas. */
  dequeue: (ids: number[]) =>
    gql(`mutation($ids: [Int!]!) { dequeueChapterDownloads(input: { ids: $ids }) { clientMutationId } }`, { ids }),

  deleteDownloads: (ids: number[]) =>
    gql(`mutation($ids: [Int!]!) { deleteDownloadedChapters(input: { ids: $ids }) { clientMutationId } }`, { ids }),

  setDownloaderRunning: (run: boolean) =>
    gql(`mutation { ${run ? "startDownloader" : "stopDownloader"}(input: {}) { clientMutationId } }`),

  clearDownloads: () => gql(`mutation { clearDownloader(input: {}) { clientMutationId } }`),

  downloadedChapters: () =>
    gql<{ chapters: { nodes: DownloadedChapter[] } }>(
      `{ chapters(condition: { isDownloaded: true }, order: [{ by: SOURCE_ORDER, byType: DESC }]) {
        nodes { id name sourceOrder manga { ${MANGA_CARD} } } } }`,
    ).then((d) => d.chapters.nodes),

  // -------------------------------------------------------------- Copias de seguridad
  createBackup: () =>
    gql<{ createBackup: { url: string } }>(`mutation { createBackup(input: {}) { url } }`).then((d) =>
      swUrl(d.createBackup.url),
    ),

  /** Sube un .tachibk (Mihon/Tachiyomi/Suwayomi) usando el protocolo multipart de GraphQL. */
  restoreBackup: async (file: File) => {
    const form = new FormData();
    form.append(
      "operations",
      JSON.stringify({
        query: `mutation($b: Upload!) { restoreBackup(input: { backup: $b }) { id status { state } } }`,
        variables: { b: null },
      }),
    );
    form.append("map", JSON.stringify({ "0": ["variables.b"] }));
    form.append("0", file);
    const res = await fetch(`${SW}/api/graphql`, { method: "POST", body: form });
    const json = await res.json();
    if (json.errors?.length) throw new Error(cleanError(json.errors[0].message));
    return json.data.restoreBackup.id as string;
  },

  restoreStatus: (id: string) =>
    gql<{ restoreStatus: { state: string; mangaProgress: number; totalManga: number } | null }>(
      `query($id: String!) { restoreStatus(id: $id) { state mangaProgress totalManga } }`,
      { id },
    ).then((d) => d.restoreStatus),
};
