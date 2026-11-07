import { requireAuth } from "@/lib/auth";
import { errorResponse, searchPlaces } from "@/lib/places";

export async function GET(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 3) return Response.json({ error: "Digite pelo menos 3 caracteres" }, { status: 400 });
  try {
    const results = await searchPlaces({ query: q, pageSize: 8 });
    return Response.json({ results });
  } catch (err) {
    return errorResponse(err);
  }
}
