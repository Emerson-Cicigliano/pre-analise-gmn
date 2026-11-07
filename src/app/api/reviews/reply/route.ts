import { requireAuth } from "@/lib/auth";
import { draftReply } from "@/lib/ai";
import { getSettings } from "@/lib/db";
import { errorResponse, getPlaceDetails } from "@/lib/places";
import type { FullReview } from "@/lib/types";

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { placeId, review } = await req.json().catch(() => ({}));
  if (!placeId || !review) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  try {
    const place = await getPlaceDetails(String(placeId));
    const settings = await getSettings();
    const reply = await draftReply({ name: place.name, category: place.category }, review as FullReview, {
      tone: settings.replyTone,
      signature: `Equipe ${place.name}`,
    });
    return Response.json({ reply });
  } catch (err) {
    return errorResponse(err);
  }
}
