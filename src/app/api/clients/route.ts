import { requireAuth } from "@/lib/auth";
import { addClient, listClients, removeClient, setClientAutoRule } from "@/lib/db";
import { errorResponse, getPlaceDetails } from "@/lib/places";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    return Response.json({ clients: await listClients() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { placeId } = await req.json().catch(() => ({}));
  if (!placeId) return Response.json({ error: "placeId obrigatório" }, { status: 400 });
  try {
    const p = await getPlaceDetails(String(placeId));
    await addClient({ placeId: p.id, name: p.name, address: p.address, category: p.category });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Regra da fila: a partir de quantas estrelas a resposta é aprovada sozinha (null = todas passam pela revisão). */
export async function PATCH(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { placeId, autoMinRating } = await req.json().catch(() => ({}));
  if (!placeId) return Response.json({ error: "placeId obrigatório" }, { status: 400 });
  if (autoMinRating !== null && ![4, 5].includes(Number(autoMinRating)))
    return Response.json({ error: "Regra inválida" }, { status: 400 });
  try {
    await setClientAutoRule(String(placeId), autoMinRating === null ? null : Number(autoMinRating));
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const placeId = new URL(req.url).searchParams.get("placeId");
  if (!placeId) return Response.json({ error: "placeId obrigatório" }, { status: 400 });
  try {
    await removeClient(placeId);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
