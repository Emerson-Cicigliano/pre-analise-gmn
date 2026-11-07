import { requireAuth } from "@/lib/auth";
import { analyzeReviews } from "@/lib/ai";
import { errorResponse, getPlaceDetails } from "@/lib/places";
import type { FullReview } from "@/lib/types";

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { placeId, reviews } = await req.json().catch(() => ({}));
  if (!placeId || !Array.isArray(reviews)) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  try {
    const place = await getPlaceDetails(String(placeId));
    const analysis = await analyzeReviews({ name: place.name, category: place.category }, reviews as FullReview[]);
    return Response.json(analysis);
  } catch (err) {
    return errorResponse(err);
  }
}
