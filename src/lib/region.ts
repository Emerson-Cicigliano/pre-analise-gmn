import type { GeogridResult, RegionRow } from "./types";

export type Level = "good" | "mid" | "bad";

/** Mesma régua do relatório: 1–3 bom, 4–6 razoável, 7+ ou fora do top 20 fraco. */
export function rankLevel(rank: number | null): Level {
  if (rank === null) return "bad";
  return rank <= 3 ? "good" : rank <= 6 ? "mid" : "bad";
}

export const LEVEL_COLORS: Record<Level, string> = { good: "#3d8b3d", mid: "#e0a526", bad: "#c8412f" };

/**
 * Ranking da região: para cada negócio que aparece na grade, em quantos pontos ele fica no top 3
 * e qual a posição média onde aparece. Ordena por presença no top 3, depois por posição média.
 */
export function regionRanking(grid: GeogridResult, targetId: string, limit = 12): RegionRow[] {
  const total = grid.points.length || 1;
  const stats = new Map<string, { top3: number; found: number; sum: number }>();
  for (const p of grid.points) {
    const ids = p.ids ?? p.topIds;
    ids.forEach((id, i) => {
      const s = stats.get(id) ?? { top3: 0, found: 0, sum: 0 };
      s.found++;
      s.sum += i + 1;
      if (i < 3) s.top3++;
      stats.set(id, s);
    });
  }
  // A empresa analisada entra mesmo que não apareça em nenhum ponto.
  if (!stats.has(targetId)) stats.set(targetId, { top3: 0, found: 0, sum: 0 });

  const rows = [...stats.entries()]
    .map(([id, s]) => {
      const b = grid.businesses?.[id];
      return {
        id,
        name: b?.name ?? (id === targetId ? "Sua empresa" : "Concorrente"),
        category: b?.category ?? null,
        rating: b?.rating ?? null,
        votes: b?.votes ?? 0,
        top3Share: Math.round((s.top3 / total) * 100),
        foundShare: Math.round((s.found / total) * 100),
        avgRank: s.found ? Math.round((s.sum / s.found) * 10) / 10 : null,
        isTarget: id === targetId,
        position: 0,
      };
    })
    .filter((r) => r.top3Share > 0 || r.isTarget)
    .sort((a, b) => b.top3Share - a.top3Share || b.foundShare - a.foundShare || (a.avgRank ?? 99) - (b.avgRank ?? 99));

  rows.forEach((r, i) => (r.position = i + 1));
  const top = rows.slice(0, limit);
  const me = rows.find((r) => r.isTarget);
  if (me && !top.includes(me)) top.push(me);
  return top;
}
