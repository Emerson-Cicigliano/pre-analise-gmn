import { requireAuth } from "@/lib/auth";
import { isQueueStatus, listQueue, updateQueueItem } from "@/lib/db";
import { errorResponse } from "@/lib/http";

export async function GET(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const params = new URL(req.url).searchParams;
  const status = params.get("status") ?? "pendente";
  if (!isQueueStatus(status)) return Response.json({ error: "Status inválido" }, { status: 400 });
  try {
    return Response.json(await listQueue({ status, placeId: params.get("placeId") || undefined }));
  } catch (err) {
    return errorResponse(err);
  }
}

/** Edita a resposta e/ou muda o status (aprovar, ignorar, marcar como publicada, reabrir). */
export async function PATCH(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { reviewId, reply, status } = await req.json().catch(() => ({}));
  if (!reviewId) return Response.json({ error: "reviewId obrigatório" }, { status: 400 });
  if (status !== undefined && !isQueueStatus(status)) return Response.json({ error: "Status inválido" }, { status: 400 });
  if (reply !== undefined && typeof reply !== "string") return Response.json({ error: "Resposta inválida" }, { status: 400 });
  if (status === "aprovada" && typeof reply === "string" && !reply.trim())
    return Response.json({ error: "Escreva a resposta antes de aprovar" }, { status: 400 });
  try {
    await updateQueueItem(String(reviewId), { reply: reply?.trim(), status });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
