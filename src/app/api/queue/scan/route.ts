import { requireAuth } from "@/lib/auth";
import { getReviewsTask, hasDataForSeo, startReviewsTask } from "@/lib/dataforseo";
import { enqueueReviews, isClient, listClients } from "@/lib/db";
import { errorResponse } from "@/lib/http";

/** Quantas avaliações mais recentes conferir por cliente a cada busca. */
const SCAN_DEPTH = 50;

/** Inicia a coleta das avaliações recentes de um cliente (placeId) ou de todos. */
export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  if (!hasDataForSeo()) return Response.json({ error: "A fila precisa da DataForSEO configurada." }, { status: 400 });
  const { placeId } = await req.json().catch(() => ({}));
  try {
    const clients = (await listClients()).filter((c) => !placeId || c.placeId === placeId);
    if (!clients.length) return Response.json({ error: "Nenhum cliente cadastrado." }, { status: 400 });
    const tasks = await Promise.all(
      clients.map(async (c) => ({ placeId: c.placeId, name: c.name, taskId: await startReviewsTask(c.placeId, SCAN_DEPTH) })),
    );
    return Response.json({ tasks });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Consulta a coleta; quando pronta, põe na fila as avaliações sem resposta que ainda não estavam lá. */
export async function GET(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const params = new URL(req.url).searchParams;
  const taskId = params.get("task");
  const placeId = params.get("placeId");
  if (!taskId || !placeId) return Response.json({ error: "task e placeId obrigatórios" }, { status: 400 });
  try {
    if (!(await isClient(placeId))) return Response.json({ error: "Empresa não é cliente" }, { status: 400 });
    const res = await getReviewsTask(taskId);
    if (!res.ready) return Response.json({ ready: false });
    return Response.json({ ready: true, added: await enqueueReviews(placeId, res.reviews) });
  } catch (err) {
    return errorResponse(err);
  }
}
