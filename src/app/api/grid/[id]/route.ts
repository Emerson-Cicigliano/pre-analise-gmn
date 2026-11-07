import { requireAuth } from "@/lib/auth";
import { getLatestGrid } from "@/lib/db";
import { errorResponse } from "@/lib/http";

/** Última grade rodada para a empresa (ou null). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await params;
  try {
    return Response.json({ grid: await getLatestGrid(id) });
  } catch (err) {
    return errorResponse(err);
  }
}
