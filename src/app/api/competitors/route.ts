import { requireAuth } from "@/lib/auth";
import { errorResponse, getPlaceDetails, searchPlaces } from "@/lib/places";
import type { CompetitorsResult } from "@/lib/types";

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { placeId, keyword, radiusKm } = await req.json().catch(() => ({}));
  const kw = String(keyword ?? "").trim();
  const radius = Math.min(Math.max(Number(radiusKm) || 5, 0.5), 50);
  if (!placeId || !kw) return Response.json({ error: "Informe a palavra-chave" }, { status: 400 });

  try {
    const target = await getPlaceDetails(placeId);
    const found = await searchPlaces({ query: kw, center: target.location, radiusM: radius * 1000, pageSize: 20 });

    const list = found.some((p) => p.id === target.id) ? found : [...found, target];
    const ranked = [...list]
      .sort((a, b) => b.userRatingCount - a.userRatingCount || (b.rating ?? 0) - (a.rating ?? 0))
      .map((p, i) => ({ ...p, reviewRank: i + 1, isTarget: p.id === target.id }));

    const others = ranked.filter((p) => !p.isTarget);
    const rated = others.filter((p) => p.rating !== null);
    const result: CompetitorsResult = {
      keyword: kw,
      radiusKm: radius,
      competitors: ranked,
      targetFound: found.some((p) => p.id === target.id),
      avgRating: rated.length ? rated.reduce((s, p) => s + (p.rating ?? 0), 0) / rated.length : null,
      avgReviews: others.length ? Math.round(others.reduce((s, p) => s + p.userRatingCount, 0) / others.length) : 0,
    };
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
