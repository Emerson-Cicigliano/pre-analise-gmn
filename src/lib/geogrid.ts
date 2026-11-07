import type { GridPoint, LatLng } from "./types";

export const NOT_FOUND_RANK = 21;

/** Gera uma grade size×size centrada no local, com spacingKm entre pontos. */
export function buildGrid(center: LatLng, size: number, spacingKm: number): { lat: number; lng: number }[] {
  const half = (size - 1) / 2;
  const dLat = spacingKm / 111.32;
  const dLng = spacingKm / (111.32 * Math.cos((center.latitude * Math.PI) / 180));
  const pts: { lat: number; lng: number }[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      pts.push({
        lat: center.latitude + (half - row) * dLat,
        lng: center.longitude + (col - half) * dLng,
      });
    }
  }
  return pts;
}

export function gridMetrics(points: GridPoint[]) {
  const found = points.filter((p) => p.rank !== null).map((p) => p.rank as number);
  const total = points.length || 1;
  return {
    avgRankFound: found.length ? round1(found.reduce((a, b) => a + b, 0) / found.length) : null,
    avgRankOverall: round1(points.reduce((s, p) => s + (p.rank ?? NOT_FOUND_RANK), 0) / total),
    top3Share: Math.round((found.filter((r) => r <= 3).length / total) * 100),
    foundShare: Math.round((found.length / total) * 100),
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Executa tarefas com limite de concorrência para não estourar a cota por minuto. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
