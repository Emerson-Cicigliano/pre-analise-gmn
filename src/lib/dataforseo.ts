import "server-only";
import { AppError } from "./http";
import type { FullReview, SearchVolumeResult } from "./types";

const BASE = "https://api.dataforseo.com/v3";
const BRAZIL = 2076;
const CACHE_TTL_MS = 60 * 60 * 1000;

export const hasDataForSeo = () => !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);

const g = globalThis as unknown as { __dfsCache?: Map<string, { at: number; value: unknown }> };
const cache = (g.__dfsCache ??= new Map());

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

type Raw = Record<string, any>;

/** Chama a API e devolve a primeira task da resposta. */
async function call(pathname: string, body?: unknown): Promise<Raw> {
  if (!hasDataForSeo()) throw new AppError("DataForSEO não configurada (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).", 400);
  const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString("base64");
  const res = await fetch(`${BASE}${pathname}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status_code !== 20000) {
    throw new AppError(`DataForSEO: ${json.status_message ?? `erro ${res.status}`}`, res.status === 401 ? 401 : 502);
  }
  const task = json.tasks?.[0];
  if (!task) throw new AppError("DataForSEO: resposta sem task", 502);
  return task;
}

function taskError(task: Raw): never {
  throw new AppError(`DataForSEO: ${task.status_message ?? "falha na tarefa"}`, 502);
}

/** "2026-01-15 12:00:00 +00:00" → ISO. */
function parseTimestamp(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2})[:-](\d{2})[:-](\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])).toISOString();
}

// ---------- Google Maps (ranking real) ----------

export type MapsItem = {
  rank: number;
  placeId: string | null;
  title: string;
  category: string | null;
  additionalCategories: string[];
  rating: number | null;
  votes: number;
};

export function mapsSearch(keyword: string, lat: number, lng: number, zoom = 15, depth = 20): Promise<MapsItem[]> {
  const coord = `${lat.toFixed(7)},${lng.toFixed(7)},${zoom}z`;
  return cached(`maps:${keyword}:${coord}:${depth}`, async () => {
    const task = await call("/serp/google/maps/live/advanced", [
      { keyword, location_coordinate: coord, language_code: "pt", device: "mobile", depth },
    ]);
    if (task.status_code !== 20000) taskError(task);
    const items: Raw[] = task.result?.[0]?.items ?? [];
    return items
      .filter((i) => i.type === "maps_search")
      .map((i, idx) => ({
        rank: i.rank_group ?? idx + 1,
        placeId: i.place_id ?? null,
        title: i.title ?? "(sem nome)",
        category: i.category ?? null,
        additionalCategories: i.additional_categories ?? [],
        rating: i.rating?.value ?? null,
        votes: i.rating?.votes_count ?? 0,
      }));
  });
}

// ---------- Informações completas do perfil ----------

export type BusinessInfo = {
  category: string | null;
  additionalCategories: string[];
  isClaimed: boolean | null;
  totalPhotos: number | null;
  description: string | null;
  placeTopics: { topic: string; count: number }[];
  /** true quando o perfil lista produtos/serviços; null quando não veio nada (não dá para afirmar que falta). */
  hasServices: boolean | null;
  /** true quando há link de agendamento/pedido; null quando não veio nada. */
  hasBookingLink: boolean | null;
};

function nonEmpty(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === "object") return Object.keys(v).length > 0;
  return typeof v === "string" ? v.trim().length > 0 : false;
}

export function businessInfo(placeId: string): Promise<BusinessInfo> {
  return cached(`info:${placeId}`, async () => {
    const task = await call("/business_data/google/my_business_info/live", [
      { keyword: `place_id:${placeId}`, location_code: BRAZIL, language_code: "pt" },
    ]);
    if (task.status_code !== 20000) taskError(task);
    const item: Raw = task.result?.[0]?.items?.[0] ?? {};
    const topics: Raw = item.place_topics ?? {};
    return {
      category: item.category ?? null,
      additionalCategories: item.additional_categories ?? [],
      isClaimed: typeof item.is_claimed === "boolean" ? item.is_claimed : null,
      totalPhotos: item.total_photos ?? null,
      description: item.description ?? null,
      placeTopics: Object.entries(topics)
        .map(([topic, count]) => ({ topic, count: Number(count) }))
        .sort((a, b) => b.count - a.count),
      hasServices: nonEmpty(item.services) ? true : null,
      hasBookingLink: nonEmpty(item.book_online_url) || nonEmpty(item.local_business_links) ? true : null,
    };
  });
}

// ---------- Avaliações (assíncrono: cria a tarefa e consulta depois) ----------

export async function startReviewsTask(placeId: string, depth: number): Promise<string> {
  const task = await call("/business_data/google/reviews/task_post", [
    { place_id: placeId, location_code: BRAZIL, language_code: "pt", depth, sort_by: "newest" },
  ]);
  if (task.status_code !== 20100 && task.status_code !== 20000) taskError(task);
  return task.id as string;
}

export type ReviewsTaskResult =
  | { ready: false }
  | { ready: true; reviews: FullReview[]; total: number; rating: number | null };

export async function getReviewsTask(taskId: string): Promise<ReviewsTaskResult> {
  if (!/^[\w-]+$/.test(taskId)) throw new AppError("ID de tarefa inválido", 400);
  const task = await call(`/business_data/google/reviews/task_get/${taskId}`);
  // 40601 = tarefa registrada, 40602 = na fila / processando.
  if (task.status_code === 40601 || task.status_code === 40602) return { ready: false };
  if (task.status_code !== 20000) taskError(task);
  const result: Raw = task.result?.[0] ?? {};
  const reviews: FullReview[] = (result.items ?? []).map((r: Raw) => ({
    id: r.review_id ?? null,
    rating: r.rating?.value ?? 0,
    text: r.review_text ?? r.original_review_text ?? "",
    author: r.profile_name ?? "Anônimo",
    publishTime: parseTimestamp(r.timestamp),
    relativeTime: r.time_ago ?? null,
    ownerAnswer: r.owner_answer ?? null,
    ownerTime: parseTimestamp(r.owner_timestamp),
  }));
  return { ready: true, reviews, total: result.reviews_count ?? reviews.length, rating: result.rating?.value ?? null };
}

// ---------- Postagens do perfil (assíncrono, como as avaliações) ----------

export async function startUpdatesTask(placeId: string): Promise<string> {
  const task = await call("/business_data/google/my_business_updates/task_post", [
    { keyword: `place_id:${placeId}`, location_code: BRAZIL, language_code: "pt", depth: 10 },
  ]);
  if (task.status_code !== 20100 && task.status_code !== 20000) taskError(task);
  return task.id as string;
}

export type UpdatesTaskResult = { ready: false } | { ready: true; posts: { date: string | null; hasImage: boolean }[] };

export async function getUpdatesTask(taskId: string): Promise<UpdatesTaskResult> {
  if (!/^[\w-]+$/.test(taskId)) throw new AppError("ID de tarefa inválido", 400);
  const task = await call(`/business_data/google/my_business_updates/task_get/${taskId}`);
  if (task.status_code === 40601 || task.status_code === 40602) return { ready: false };
  // 40102 = o perfil não tem nenhuma postagem.
  if (task.status_code === 40102) return { ready: true, posts: [] };
  if (task.status_code !== 20000) taskError(task);
  const items: Raw[] = task.result?.[0]?.items ?? [];
  return {
    ready: true,
    posts: items
      .filter((i) => i.type === "google_business_post")
      .map((i) => ({ date: parseTimestamp(i.timestamp), hasImage: !!i.images_url })),
  };
}

// ---------- Volume de pesquisas por semana (estimado) ----------

const UF_STATE: Record<string, string> = {
  AC: "acre", AL: "alagoas", AP: "amapa", AM: "amazonas", BA: "bahia", CE: "ceara", DF: "federal district",
  ES: "espirito santo", GO: "goias", MA: "maranhao", MT: "mato grosso", MS: "mato grosso do sul", MG: "minas gerais",
  PA: "para", PB: "paraiba", PR: "parana", PE: "pernambuco", PI: "piaui", RJ: "rio de janeiro",
  RN: "rio grande do norte", RS: "rio grande do sul", RO: "rondonia", RR: "roraima", SC: "santa catarina",
  SP: "sao paulo", SE: "sergipe", TO: "tocantins",
};

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

type Location = { code: number; label: string; level: SearchVolumeResult["locationLevel"] };

function brazilLocations(): Promise<Raw[]> {
  return cached("locations:br", async () => {
    const task = await call("/keywords_data/google_ads/locations/br");
    return (task.result ?? []) as Raw[];
  });
}

/**
 * Localizações do Google Ads para o endereço ("..., Campinas - SP, 13025-150"), da mais
 * específica para a mais ampla: cidade, estado e Brasil.
 */
async function locationsFor(address: string): Promise<Location[]> {
  const country: Location = { code: BRAZIL, label: "Brasil", level: "país" };
  const m = address.match(/,\s*([^,]+?)\s*-\s*([A-Z]{2})\s*(?:,|$)/);
  if (!m) return [country];
  const [, city, uf] = m;
  const all = await brazilLocations();
  const state = all.find(
    (l) =>
      l.location_type === "State" &&
      plain(String(l.location_name)).replace(/^state of /, "").replace(/,brazil$/, "") === UF_STATE[uf],
  );
  const cityLoc = all
    .filter((l) => l.location_type === "City" && (!state || l.location_code_parent === state.location_code))
    .filter((l) => plain(String(l.location_name).split(",")[0]) === plain(city))
    .sort((a, b) => String(a.location_name).length - String(b.location_name).length)[0];
  return [
    ...(cityLoc ? [{ code: cityLoc.location_code, label: `${city}, ${uf}`, level: "cidade" as const }] : []),
    ...(state ? [{ code: state.location_code, label: uf, level: "estado" as const }] : []),
    country,
  ];
}

/**
 * Estima as pesquisas do último mês (total e por semana): volume do último mês no Google Ads
 * (na cidade da empresa) distribuído pela variação diária do Google Trends dos últimos 30 dias.
 */
export function weeklySearchVolume(keyword: string, address: string): Promise<SearchVolumeResult> {
  const kw = keyword.trim().toLowerCase();
  return cached(`volume:${kw}:${address}`, async () => {
    let monthly: SearchVolumeResult["monthly"] = null;
    let used: Location = { code: BRAZIL, label: "Brasil", level: "país" };
    // Cidades pequenas às vezes não têm dados no Google Ads; nesse caso sobe para o estado e depois o país.
    for (const loc of await locationsFor(address)) {
      const task = await call("/keywords_data/google_ads/search_volume/live", [
        { keywords: [kw], location_code: loc.code, language_code: "pt" },
      ]);
      if (task.status_code !== 20000) taskError(task);
      const last = (task.result?.[0]?.monthly_searches ?? []).find((x: Raw) => typeof x.search_volume === "number" && x.search_volume > 0);
      if (last) {
        monthly = { year: last.year, month: last.month, volume: last.search_volume };
        used = loc;
        break;
      }
    }

    // Variação diária no Brasil (o Trends não tem dados confiáveis por cidade).
    const trends = await call("/keywords_data/google_trends/explore/live", [
      { keywords: [kw], location_code: BRAZIL, language_code: "pt", time_range: "past_30_days", item_types: ["google_trends_graph"] },
    ]);
    if (trends.status_code !== 20000) taskError(trends);
    const days: { date: string; value: number }[] = (trends.result?.[0]?.items?.[0]?.data ?? [])
      // O último dia costuma vir incompleto (missing_data) e fica de fora.
      .filter((d: Raw) => !d.missing_data && typeof d.values?.[0] === "number")
      .map((d: Raw) => ({ date: String(d.date_from), value: Number(d.values[0]) }))
      .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));

    const weeks: SearchVolumeResult["weeks"] = [];
    let last30: SearchVolumeResult["last30"] = null;
    if (monthly && days.length >= 28) {
      const avg = days.reduce((s, d) => s + d.value, 0) / days.length || 1;
      const perDay = monthly.volume / 30.4;
      const estimate = (slice: { value: number }[]) =>
        Math.round(((slice.reduce((s, d) => s + d.value, 0) / avg) * perDay) / 10) * 10;
      const month = days.slice(-30);
      last30 = { from: month[0].date, to: month[month.length - 1].date, volume: estimate(month) };
      const labels = ["Última semana", "Penúltima semana", "Antepenúltima semana", "4 semanas atrás"];
      for (let w = 0; w < 4; w++) {
        const slice = days.slice(days.length - 7 * (w + 1), days.length - 7 * w);
        weeks.push({ label: labels[w], from: slice[0].date, to: slice[slice.length - 1].date, volume: estimate(slice) });
      }
    }

    return { keyword: kw, locationLabel: used.label, locationLevel: used.level, monthly, last30, weeks };
  });
}
