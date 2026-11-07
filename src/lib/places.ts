import "server-only";
import { AppError as PlacesError } from "./http";
import type { LatLng, PlaceDetails, PlaceSummary, Review } from "./types";

export { errorResponse } from "./http";

const BASE = "https://places.googleapis.com/v1";
const CACHE_TTL_MS = 60 * 60 * 1000;

// Cache em memória para não pagar duas vezes pela mesma consulta durante a sessão.
const g = globalThis as unknown as { __placesCache?: Map<string, { at: number; value: unknown }> };
const cache = (g.__placesCache ??= new Map());

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new PlacesError(
      "Chave da API não configurada. Crie o arquivo .env.local com GOOGLE_PLACES_API_KEY=... e reinicie o servidor.",
      500,
    );
  }
  return key;
}

async function call(url: string, fieldMask: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": fieldMask,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? `Erro ${res.status} na Places API`;
    throw new PlacesError(msg, res.status);
  }
  return body;
}

// ---------- mapeamento da resposta crua ----------

type Raw = Record<string, any>;

function toSummary(p: Raw): PlaceSummary {
  return {
    id: p.id,
    name: p.displayName?.text ?? "(sem nome)",
    address: p.formattedAddress ?? "",
    location: { latitude: p.location?.latitude ?? 0, longitude: p.location?.longitude ?? 0 },
    rating: typeof p.rating === "number" ? p.rating : null,
    userRatingCount: p.userRatingCount ?? 0,
    category: p.primaryTypeDisplayName?.text ?? null,
    mapsUri: p.googleMapsUri ?? null,
  };
}

function hasAnyTrue(obj: Raw | undefined): boolean {
  return !!obj && Object.values(obj).some((v) => v === true);
}

function toDetails(p: Raw): PlaceDetails {
  const reviews: Review[] = (p.reviews ?? []).map((r: Raw) => ({
    rating: r.rating ?? 0,
    text: r.text?.text ?? r.originalText?.text ?? "",
    author: r.authorAttribution?.displayName ?? "Anônimo",
    publishTime: r.publishTime ?? null,
    relativeTime: r.relativePublishTimeDescription ?? null,
  }));
  return {
    ...toSummary(p),
    website: p.websiteUri ?? null,
    phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    hours: p.regularOpeningHours?.weekdayDescriptions ?? [],
    photosCount: (p.photos ?? []).length,
    businessStatus: p.businessStatus ?? null,
    editorialSummary: p.editorialSummary?.text ?? null,
    types: p.types ?? [],
    reviews,
    hasPaymentOptions: hasAnyTrue(p.paymentOptions),
    hasAccessibility: hasAnyTrue(p.accessibilityOptions),
    hasParking: hasAnyTrue(p.parkingOptions),
  };
}

// ---------- chamadas ----------

const SUMMARY_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "primaryTypeDisplayName",
  "googleMapsUri",
];

const DETAIL_FIELDS = [
  ...SUMMARY_FIELDS,
  "websiteUri",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "regularOpeningHours",
  "photos",
  "businessStatus",
  "editorialSummary",
  "types",
  "reviews",
  "paymentOptions",
  "accessibilityOptions",
  "parkingOptions",
];

type SearchOpts = {
  query: string;
  center?: LatLng;
  radiusM?: number;
  pageSize?: number;
};

function searchBody({ query, center, radiusM, pageSize = 20 }: SearchOpts) {
  return {
    textQuery: query,
    languageCode: "pt-BR",
    regionCode: "BR",
    pageSize,
    ...(center && {
      locationBias: {
        circle: { center, radius: Math.min(Math.max(radiusM ?? 5000, 1), 50000) },
      },
    }),
  };
}

/** Busca completa (nome, nota, avaliações...). Cobrada como Text Search Pro. */
export function searchPlaces(opts: SearchOpts): Promise<PlaceSummary[]> {
  const body = searchBody(opts);
  return cached(`search:${JSON.stringify(body)}`, async () => {
    const data = await call(`${BASE}/places:searchText`, SUMMARY_FIELDS.map((f) => `places.${f}`).join(","), {
      method: "POST",
      body: JSON.stringify(body),
    });
    return (data.places ?? []).map(toSummary);
  });
}

/** Busca que devolve só IDs, na ordem do Google. É a consulta mais barata da API. */
export function searchPlaceIds(opts: SearchOpts): Promise<string[]> {
  const body = searchBody(opts);
  return cached(`ids:${JSON.stringify(body)}`, async () => {
    const data = await call(`${BASE}/places:searchText`, "places.id", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return (data.places ?? []).map((p: Raw) => p.id as string);
  });
}

export function getPlaceDetails(id: string): Promise<PlaceDetails> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new PlacesError("ID de local inválido", 400);
  return cached(`details:${id}`, async () => {
    const data = await call(`${BASE}/places/${id}?languageCode=pt-BR&regionCode=BR`, DETAIL_FIELDS.join(","));
    return toDetails(data);
  });
}
