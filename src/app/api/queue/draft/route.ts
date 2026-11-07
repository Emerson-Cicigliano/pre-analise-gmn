import { requireAuth } from "@/lib/auth";
import { draftReply } from "@/lib/ai";
import { getQueueItem, getSettings, updateQueueItem } from "@/lib/db";
import { errorResponse } from "@/lib/http";

/**
 * Escreve (ou reescreve) a resposta de uma avaliação da fila.
 * Se a nota alcança a regra do cliente, a resposta já sai aprovada.
 */
export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { reviewId } = await req.json().catch(() => ({}));
  if (!reviewId) return Response.json({ error: "reviewId obrigatório" }, { status: 400 });
  try {
    const item = await getQueueItem(String(reviewId));
    if (!item) return Response.json({ error: "Avaliação não está na fila" }, { status: 404 });
    const settings = await getSettings();
    const reply = await draftReply(
      { name: item.clientName, category: item.category },
      { author: item.author, rating: item.rating, text: item.text, publishTime: item.publishedAt, relativeTime: null },
      { tone: settings.replyTone, signature: `Equipe ${item.clientName}` },
    );
    const auto = item.status === "pendente" && item.autoMinRating !== null && item.rating >= item.autoMinRating;
    const status = auto ? "aprovada" : item.status;
    await updateQueueItem(item.reviewId, { reply, status });
    return Response.json({ reply, status });
  } catch (err) {
    return errorResponse(err);
  }
}
