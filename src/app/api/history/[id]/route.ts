import { requireAuth } from "@/lib/auth";
import { getHistory } from "@/lib/db";
import { errorResponse } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await params;
  try {
    return Response.json(await getHistory(id));
  } catch (err) {
    return errorResponse(err);
  }
}
