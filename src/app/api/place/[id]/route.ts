import { requireAuth } from "@/lib/auth";
import { hasClaude } from "@/lib/ai";
import { buildChecklist, scoreOf } from "@/lib/checklist";
import { businessInfo, hasDataForSeo } from "@/lib/dataforseo";
import { isClient, recordSnapshot } from "@/lib/db";
import { errorResponse, getPlaceDetails } from "@/lib/places";
import type { PlaceAnalysis, PlaceDetails } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await params;
  try {
    const details = await getPlaceDetails(id);
    // A descrição escrita pelo dono só vem pela DataForSEO; se a consulta falhar, o item fica "não verificado".
    const info = hasDataForSeo() ? await businessInfo(details.id).catch(() => null) : null;
    const place: PlaceDetails = info
      ? {
          ...details,
          ownerDescription: info.description ?? null,
          gbp: {
            isClaimed: info.isClaimed,
            additionalCategories: info.additionalCategories,
            hasServices: info.hasServices,
            hasBookingLink: info.hasBookingLink,
            totalPhotos: info.totalPhotos,
          },
        }
      : details;
    const checklist = buildChecklist(place);
    const client = await isClient(place.id);
    const analysis: PlaceAnalysis = {
      place,
      checklist,
      score: scoreOf(checklist),
      isClient: client,
      providers: { dataforseo: hasDataForSeo(), claude: hasClaude() },
    };
    // Clientes ganham histórico automático (uma foto por dia).
    if (client) await recordSnapshot(analysis);
    return Response.json(analysis);
  } catch (err) {
    return errorResponse(err);
  }
}
