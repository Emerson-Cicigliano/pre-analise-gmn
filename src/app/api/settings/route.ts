import { requireAuth } from "@/lib/auth";
import { hasClaude } from "@/lib/ai";
import { hasDataForSeo } from "@/lib/dataforseo";
import { getSettings, saveSettings } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import type { AgencySettings } from "@/lib/types";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    return Response.json({
      settings: await getSettings(),
      providers: {
        places: !!process.env.GOOGLE_PLACES_API_KEY,
        dataforseo: hasDataForSeo(),
        claude: hasClaude(),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as AgencySettings | null;
  if (!body || !Array.isArray(body.services)) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  try {
    const clean: AgencySettings = {
      agencyName: String(body.agencyName ?? "").slice(0, 120),
      responsible: String(body.responsible ?? "").slice(0, 120),
      phone: String(body.phone ?? "").slice(0, 40),
      email: String(body.email ?? "").slice(0, 120),
      website: String(body.website ?? "").slice(0, 200),
      replyTone: String(body.replyTone ?? "").slice(0, 200),
      proposalNotes: String(body.proposalNotes ?? "").slice(0, 2000),
      services: body.services.slice(0, 30).map((s) => ({
        name: String(s.name ?? "").slice(0, 120),
        description: String(s.description ?? "").slice(0, 500),
        price: Math.max(0, Number(s.price) || 0),
        type: s.type === "recorrente" ? "recorrente" : "fixo",
      })),
      contractTerms: [
        ...new Set(
          (Array.isArray(body.contractTerms) ? body.contractTerms : [3, 6, 12])
            .map((n) => Math.round(Number(n)))
            .filter((n) => n >= 1 && n <= 60),
        ),
      ]
        .sort((a, b) => a - b)
        .slice(0, 8),
    };
    await saveSettings(clean);
    return Response.json({ settings: clean });
  } catch (err) {
    return errorResponse(err);
  }
}
