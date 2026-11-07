import { requireAuth } from "@/lib/auth";
import { getReviewsTask, hasDataForSeo, startReviewsTask } from "@/lib/dataforseo";
import { errorResponse, getPlaceDetails } from "@/lib/places";

/** 0 = todas as avaliações do perfil (a DataForSEO entrega até 4.490). */
const DEPTHS = [0, 50, 100, 200, 500];
const MAX_DEPTH = 4490;

/** Inicia a coleta. Com DataForSEO devolve uma tarefa para consultar; sem ela, as 5 avaliações da Places API. */
export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { placeId, depth } = await req.json().catch(() => ({}));
  if (!placeId) return Response.json({ error: "placeId obrigatório" }, { status: 400 });
  const d = DEPTHS.includes(Number(depth)) ? Number(depth) : 100;

  try {
    const place = await getPlaceDetails(String(placeId));
    if (!hasDataForSeo()) {
      return Response.json({
        source: "places",
        ready: true,
        reviews: place.reviews.map((r) => ({ ...r, ownerAnswer: null, ownerTime: null })),
        total: place.userRatingCount,
        rating: place.rating,
      });
    }
    const depthToFetch = d === 0 ? Math.min(MAX_DEPTH, Math.max(10, Math.ceil(place.userRatingCount / 10) * 10)) : d;
    const taskId = await startReviewsTask(place.id, depthToFetch);
    return Response.json({ source: "dataforseo", ready: false, taskId });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const taskId = new URL(req.url).searchParams.get("task");
  if (!taskId) return Response.json({ error: "task obrigatório" }, { status: 400 });
  try {
    return Response.json({ source: "dataforseo", ...(await getReviewsTask(taskId)) });
  } catch (err) {
    return errorResponse(err);
  }
}
