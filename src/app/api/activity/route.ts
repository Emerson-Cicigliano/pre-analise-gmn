import { requireAuth } from "@/lib/auth";
import { getReviewsTask, getUpdatesTask, hasDataForSeo, startReviewsTask, startUpdatesTask } from "@/lib/dataforseo";
import { errorResponse } from "@/lib/http";

/** Quantas avaliações recentes olhar para medir se o dono responde. */
const REVIEWS_SAMPLE = 20;
/** Quantas das mais recentes mostrar na análise. */
const RECENT_SHOWN = 5;

/** Inicia as consultas de postagens e de avaliações recentes do perfil. */
export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { placeId } = await req.json().catch(() => ({}));
  if (!placeId) return Response.json({ error: "placeId obrigatório" }, { status: 400 });
  if (!hasDataForSeo()) return Response.json({ error: "Precisa da DataForSEO configurada." }, { status: 400 });
  try {
    const [postsTask, reviewsTask] = await Promise.all([
      startUpdatesTask(String(placeId)),
      startReviewsTask(String(placeId), REVIEWS_SAMPLE),
    ]);
    return Response.json({ postsTask, reviewsTask });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Consulta o andamento das duas tarefas. */
export async function GET(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const url = new URL(req.url);
  const postsTask = url.searchParams.get("posts");
  const reviewsTask = url.searchParams.get("reviews");
  if (!postsTask || !reviewsTask) return Response.json({ error: "Tarefas obrigatórias" }, { status: 400 });
  try {
    const [posts, reviews] = await Promise.all([getUpdatesTask(postsTask), getReviewsTask(reviewsTask)]);
    return Response.json({
      posts,
      reviews: reviews.ready
        ? {
            ready: true,
            sample: reviews.reviews.length,
            unanswered: reviews.reviews.filter((r) => !r.ownerAnswer).length,
            // A coleta vem ordenada da mais nova para a mais antiga.
            recent: reviews.reviews.slice(0, RECENT_SHOWN),
          }
        : { ready: false },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
