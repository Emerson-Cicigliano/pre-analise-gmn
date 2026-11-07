import { requireAuth } from "@/lib/auth";
import { hasDataForSeo, mapsSearch } from "@/lib/dataforseo";
import { saveGrid } from "@/lib/db";
import { buildGrid, gridMetrics, mapLimit } from "@/lib/geogrid";
import { errorResponse, getPlaceDetails, searchPlaceIds } from "@/lib/places";
import type { GeogridResult, GridPoint } from "@/lib/types";

const ALLOWED_SIZES = [3, 5, 7, 9];

/** Zoom do mapa que corresponde aproximadamente à distância entre os pontos. */
function zoomFor(spacingKm: number) {
  return Math.min(17, Math.max(11, Math.round(15 - Math.log2(spacingKm))));
}

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { placeId, keyword, size, spacingKm, provider, compareWith } = await req.json().catch(() => ({}));
  // Concorrentes marcados na lista: a posição deles sai das mesmas buscas, sem consulta extra.
  const compared: { id: string; name: string }[] = (Array.isArray(compareWith) ? compareWith : [])
    .filter((c: { id?: unknown }) => typeof c?.id === "string")
    .slice(0, 5)
    .map((c: { id: string; name?: unknown }) => ({ id: c.id, name: String(c.name ?? "Concorrente").slice(0, 120) }));
  const kw = String(keyword ?? "").trim();
  const n = Number(size);
  const spacing = Math.min(Math.max(Number(spacingKm) || 1, 0.2), 10);
  if (!placeId || !kw) return Response.json({ error: "Informe a palavra-chave" }, { status: 400 });
  if (!ALLOWED_SIZES.includes(n)) return Response.json({ error: "Tamanho de grade inválido" }, { status: 400 });
  const useDfs = provider === "dataforseo" || (provider !== "places" && hasDataForSeo());

  try {
    const target = await getPlaceDetails(placeId);
    const grid = buildGrid(target.location, n, spacing);
    // Dados de cada negócio que aparece em algum ponto, para o "Ranking da região".
    const businesses: NonNullable<GeogridResult["businesses"]> = {
      [target.id]: {
        id: target.id,
        name: target.name,
        category: target.category,
        rating: target.rating,
        votes: target.userRatingCount,
      },
    };

    const points: GridPoint[] = await mapLimit(grid, 6, async (pt) => {
      if (useDfs) {
        const items = await mapsSearch(kw, pt.lat, pt.lng, zoomFor(spacing), 20);
        const hit = items.find((i) => i.placeId === target.id);
        const ids = items.map((i) => i.placeId ?? i.title);
        items.forEach((i, k) => {
          businesses[ids[k]] ??= { id: ids[k], name: i.title, category: i.category, rating: i.rating, votes: i.votes };
        });
        return {
          ...pt,
          rank: hit ? hit.rank : null,
          topIds: ids.slice(0, 3),
          topNames: items.slice(0, 3).map((i) => i.title),
          ids,
        };
      }
      // Raio pequeno em torno de cada ponto para simular alguém buscando dali.
      const ids = await searchPlaceIds({
        query: kw,
        center: { latitude: pt.lat, longitude: pt.lng },
        radiusM: Math.max(300, (spacing * 1000) / 2),
        pageSize: 20,
      });
      const idx = ids.indexOf(target.id);
      return { ...pt, rank: idx === -1 ? null : idx + 1, topIds: ids.slice(0, 3), ids };
    });

    for (const c of compared) businesses[c.id] ??= { id: c.id, name: c.name, category: null, rating: null, votes: 0 };

    const result: GeogridResult = {
      compared,
      businesses,
      createdAt: new Date().toISOString(),
      provider: useDfs ? "dataforseo" : "places",
      keyword: kw,
      size: n,
      spacingKm: spacing,
      points,
      ...gridMetrics(points),
    };
    await saveGrid(target.id, result);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
