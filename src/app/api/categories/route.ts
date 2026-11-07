import { requireAuth } from "@/lib/auth";
import { businessInfo, hasDataForSeo, mapsSearch } from "@/lib/dataforseo";
import { errorResponse, getPlaceDetails, searchPlaces } from "@/lib/places";
import type { CategoriesResult } from "@/lib/types";

const norm = (s: string) => s.trim().toLowerCase();

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { placeId, keyword } = await req.json().catch(() => ({}));
  const kw = String(keyword ?? "").trim();
  if (!placeId || !kw) return Response.json({ error: "Informe a palavra-chave" }, { status: 400 });

  try {
    const target = await getPlaceDetails(String(placeId));
    const counts = new Map<string, { name: string; primary: number; additional: number }>();
    const bump = (name: string | null | undefined, kind: "primary" | "additional") => {
      if (!name) return;
      const key = norm(name);
      const c = counts.get(key) ?? { name, primary: 0, additional: 0 };
      c[kind]++;
      counts.set(key, c);
    };

    let result: Omit<CategoriesResult, "categories">;

    if (hasDataForSeo()) {
      const [info, items] = await Promise.all([
        businessInfo(target.id),
        mapsSearch(kw, target.location.latitude, target.location.longitude, 14, 20),
      ]);
      const others = items.filter((i) => i.placeId !== target.id);
      for (const i of others) {
        bump(i.category, "primary");
        i.additionalCategories.forEach((c) => bump(c, "additional"));
      }
      result = {
        keyword: kw,
        source: "dataforseo",
        target: { primary: info.category ?? target.category, additional: info.additionalCategories },
        analyzed: others.length,
        topics: info.placeTopics.slice(0, 15),
      };
    } else {
      // Sem DataForSEO só conseguimos a categoria principal de cada concorrente.
      const found = await searchPlaces({ query: kw, center: target.location, radiusM: 5000, pageSize: 20 });
      const others = found.filter((p) => p.id !== target.id);
      others.forEach((p) => bump(p.category, "primary"));
      result = {
        keyword: kw,
        source: "places",
        target: { primary: target.category, additional: [] },
        analyzed: others.length,
        topics: [],
      };
    }

    const mine = new Set([result.target.primary, ...result.target.additional].filter(Boolean).map((c) => norm(c as string)));
    const categories = [...counts.entries()]
      .map(([key, c]) => ({ ...c, total: c.primary + c.additional, youHave: mine.has(key) }))
      .sort((a, b) => b.total - a.total || b.primary - a.primary);

    return Response.json({ ...result, categories } satisfies CategoriesResult);
  } catch (err) {
    return errorResponse(err);
  }
}
