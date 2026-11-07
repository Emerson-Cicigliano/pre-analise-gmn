import { requireAuth } from "@/lib/auth";
import { hasDataForSeo, weeklySearchVolume } from "@/lib/dataforseo";
import { errorResponse, getPlaceDetails } from "@/lib/places";

/** Pesquisas estimadas das 3 últimas semanas para a palavra-chave, na cidade da empresa. */
export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { placeId, keyword } = await req.json().catch(() => ({}));
  const kw = String(keyword ?? "").trim();
  if (!placeId || !kw) return Response.json({ error: "Informe a palavra-chave" }, { status: 400 });
  if (!hasDataForSeo()) return Response.json({ error: "O volume de pesquisas precisa da DataForSEO configurada." }, { status: 400 });
  try {
    const place = await getPlaceDetails(String(placeId));
    return Response.json(await weeklySearchVolume(kw, place.address));
  } catch (err) {
    return errorResponse(err);
  }
}
