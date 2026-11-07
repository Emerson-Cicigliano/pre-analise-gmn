import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type {
  AgencySettings,
  ClientRow,
  FullReview,
  GeogridResult,
  HistoryGrid,
  HistorySnapshot,
  PlaceAnalysis,
  QueueItem,
  QueueStatus,
} from "./types";

// Banco D1 da Cloudflare (SQLite na nuvem). No computador, o `next dev` usa uma cópia local do D1.
// A estrutura das tabelas está em schema.sql.
async function db(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

type Row = Record<string, unknown>;

// ---------- clientes ----------

export async function listClients(): Promise<ClientRow[]> {
  const { results } = await (await db())
    .prepare(
      `SELECT c.place_id, c.name, c.address, c.category, c.added_at, c.auto_min_rating,
         (SELECT COUNT(*) FROM review_queue q WHERE q.place_id = c.place_id AND q.status IN ('pendente', 'aprovada')) AS pending,
         (SELECT score FROM snapshots s WHERE s.place_id = c.place_id ORDER BY created_at DESC LIMIT 1) AS last_score,
         (SELECT created_at FROM snapshots s WHERE s.place_id = c.place_id ORDER BY created_at DESC LIMIT 1) AS last_at,
         (SELECT score FROM snapshots s WHERE s.place_id = c.place_id ORDER BY created_at ASC LIMIT 1) AS first_score,
         (SELECT top3_share FROM grids gr WHERE gr.place_id = c.place_id ORDER BY created_at DESC LIMIT 1) AS last_top3
       FROM clients c ORDER BY c.name COLLATE NOCASE`,
    )
    .all<Row>();
  return results.map((r) => ({
    placeId: String(r.place_id),
    name: String(r.name),
    address: (r.address as string) ?? "",
    category: (r.category as string) ?? null,
    addedAt: String(r.added_at),
    lastScore: (r.last_score as number) ?? null,
    lastAnalysisAt: (r.last_at as string) ?? null,
    firstScore: (r.first_score as number) ?? null,
    lastTop3Share: (r.last_top3 as number) ?? null,
    autoMinRating: (r.auto_min_rating as number) ?? null,
    pendingReplies: Number(r.pending ?? 0),
  }));
}

export async function setClientAutoRule(placeId: string, autoMinRating: number | null) {
  await (await db()).prepare("UPDATE clients SET auto_min_rating = ? WHERE place_id = ?").bind(autoMinRating, placeId).run();
}

export async function isClient(placeId: string): Promise<boolean> {
  return !!(await (await db()).prepare("SELECT 1 FROM clients WHERE place_id = ?").bind(placeId).first());
}

export async function addClient(c: { placeId: string; name: string; address: string; category: string | null }) {
  await (await db())
    .prepare(
      `INSERT INTO clients (place_id, name, address, category, added_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(place_id) DO UPDATE SET name = excluded.name, address = excluded.address, category = excluded.category`,
    )
    .bind(c.placeId, c.name, c.address, c.category, new Date().toISOString())
    .run();
}

export async function removeClient(placeId: string) {
  await (await db()).prepare("DELETE FROM clients WHERE place_id = ?").bind(placeId).run();
}

// ---------- histórico ----------

/** Guarda no máximo uma foto por dia: reanalisar no mesmo dia sobrescreve a do dia. */
export async function recordSnapshot(a: PlaceAnalysis) {
  const conn = await db();
  const now = new Date().toISOString();
  const existing = await conn
    .prepare("SELECT id FROM snapshots WHERE place_id = ? AND substr(created_at, 1, 10) = ?")
    .bind(a.place.id, now.slice(0, 10))
    .first<{ id: number }>();
  const values = [a.score, a.place.rating, a.place.userRatingCount, a.place.photosCount, JSON.stringify(a.checklist)];
  if (existing) {
    await conn
      .prepare("UPDATE snapshots SET created_at = ?, score = ?, rating = ?, reviews = ?, photos = ?, checklist = ? WHERE id = ?")
      .bind(now, ...values, existing.id)
      .run();
  } else {
    await conn
      .prepare("INSERT INTO snapshots (place_id, created_at, score, rating, reviews, photos, checklist) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(a.place.id, now, ...values)
      .run();
  }
}

export async function saveGrid(placeId: string, grid: GeogridResult) {
  await (await db())
    .prepare(
      `INSERT INTO grids (place_id, created_at, keyword, size, spacing_km, provider, avg_rank_found, avg_rank_overall, top3_share, found_share, points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      placeId,
      new Date().toISOString(),
      grid.keyword,
      grid.size,
      grid.spacingKm,
      grid.provider,
      grid.avgRankFound,
      grid.avgRankOverall,
      grid.top3Share,
      grid.foundShare,
      JSON.stringify({ points: grid.points, businesses: grid.businesses ?? {}, compared: grid.compared ?? [] }),
    )
    .run();
}

/** Última grade rodada para a empresa, com todos os pontos (para o ranking da região e o relatório). */
export async function getLatestGrid(placeId: string): Promise<GeogridResult | null> {
  const r = await (await db())
    .prepare(
      `SELECT created_at, keyword, size, spacing_km, provider, avg_rank_found, avg_rank_overall, top3_share, found_share, points
       FROM grids WHERE place_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(placeId)
    .first<Row>();
  if (!r) return null;
  // Grades antigas guardavam só a lista de pontos.
  const stored = JSON.parse(String(r.points));
  const { points, businesses, compared = [] } = Array.isArray(stored) ? { points: stored, businesses: {} } : stored;
  return {
    createdAt: String(r.created_at),
    keyword: String(r.keyword),
    size: Number(r.size),
    spacingKm: Number(r.spacing_km),
    provider: r.provider as GeogridResult["provider"],
    avgRankFound: (r.avg_rank_found as number) ?? null,
    avgRankOverall: Number(r.avg_rank_overall),
    top3Share: Number(r.top3_share),
    foundShare: Number(r.found_share),
    points,
    businesses,
    compared,
  };
}

export async function getHistory(placeId: string): Promise<{ snapshots: HistorySnapshot[]; grids: HistoryGrid[] }> {
  const conn = await db();
  const [snaps, grids] = await conn.batch<Row>([
    conn.prepare("SELECT created_at, score, rating, reviews, photos FROM snapshots WHERE place_id = ? ORDER BY created_at").bind(placeId),
    conn
      .prepare(
        `SELECT id, created_at, keyword, size, spacing_km, provider, avg_rank_found, avg_rank_overall, top3_share, found_share
         FROM grids WHERE place_id = ? ORDER BY created_at`,
      )
      .bind(placeId),
  ]);
  return {
    snapshots: snaps.results.map((s) => ({
      createdAt: String(s.created_at),
      score: Number(s.score),
      rating: (s.rating as number) ?? null,
      reviews: Number(s.reviews),
      photos: Number(s.photos),
    })),
    grids: grids.results.map((r) => ({
      id: Number(r.id),
      createdAt: String(r.created_at),
      keyword: String(r.keyword),
      size: Number(r.size),
      spacingKm: Number(r.spacing_km),
      provider: r.provider as HistoryGrid["provider"],
      avgRankFound: (r.avg_rank_found as number) ?? null,
      avgRankOverall: Number(r.avg_rank_overall),
      top3Share: Number(r.top3_share),
      foundShare: Number(r.found_share),
    })),
  };
}

// ---------- fila de respostas às avaliações ----------

const QUEUE_STATUSES: QueueStatus[] = ["pendente", "aprovada", "publicada", "ignorada"];
export const isQueueStatus = (s: unknown): s is QueueStatus => QUEUE_STATUSES.includes(s as QueueStatus);

/** Avaliações sem ID (fonte antiga) ganham uma chave estável a partir do conteúdo. */
export function queueKey(placeId: string, r: FullReview) {
  return r.id ? r.id : `${placeId}|${r.author}|${r.publishTime ?? ""}|${r.text.slice(0, 60)}`;
}

/**
 * Coloca na fila as avaliações sem resposta que ainda não estão lá. Devolve quantas entraram.
 * As que já aparecem respondidas no Google saem da fila como publicadas.
 */
export async function enqueueReviews(placeId: string, reviews: FullReview[]): Promise<number> {
  const conn = await db();
  const now = new Date().toISOString();
  const answered = reviews.filter((r) => r.ownerAnswer);
  if (answered.length) {
    await conn.batch(
      answered.map((r) =>
        conn
          .prepare(`UPDATE review_queue SET status = 'publicada', updated_at = ? WHERE review_id = ? AND status IN ('pendente', 'aprovada')`)
          .bind(now, queueKey(placeId, r)),
      ),
    );
  }
  const todo = reviews.filter((r) => !r.ownerAnswer);
  if (!todo.length) return 0;
  const results = await conn.batch(
    todo.map((r) =>
      conn
        .prepare(
          `INSERT OR IGNORE INTO review_queue (review_id, place_id, author, rating, text, published_at, reply, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, 'pendente', ?, ?)`,
        )
        .bind(queueKey(placeId, r), placeId, r.author, Math.round(r.rating), r.text, r.publishTime, now, now),
    ),
  );
  return results.reduce((n, res) => n + Number(res.meta.changes ?? 0), 0);
}

function toQueueItem(r: Row): QueueItem {
  return {
    reviewId: String(r.review_id),
    placeId: String(r.place_id),
    clientName: (r.client_name as string) ?? "",
    author: String(r.author),
    rating: Number(r.rating),
    text: String(r.text),
    publishedAt: (r.published_at as string) ?? null,
    reply: (r.reply as string) ?? null,
    status: r.status as QueueStatus,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

const QUEUE_SELECT = `SELECT q.*, c.name AS client_name FROM review_queue q LEFT JOIN clients c ON c.place_id = q.place_id`;

export async function listQueue(opts: { status: QueueStatus; placeId?: string }): Promise<{ items: QueueItem[]; counts: Record<QueueStatus, number> }> {
  const conn = await db();
  const where = opts.placeId ? "WHERE q.status = ? AND q.place_id = ?" : "WHERE q.status = ?";
  const binds = opts.placeId ? [opts.status, opts.placeId] : [opts.status];
  const countWhere = opts.placeId ? "WHERE place_id = ?" : "";
  const [items, counts] = await conn.batch<Row>([
    // Piores notas primeiro: são as que mais pedem atenção.
    conn.prepare(`${QUEUE_SELECT} ${where} ORDER BY q.rating ASC, q.published_at DESC LIMIT 200`).bind(...binds),
    conn.prepare(`SELECT status, COUNT(*) AS n FROM review_queue ${countWhere} GROUP BY status`).bind(...(opts.placeId ? [opts.placeId] : [])),
  ]);
  const byStatus = Object.fromEntries(QUEUE_STATUSES.map((s) => [s, 0])) as Record<QueueStatus, number>;
  for (const c of counts.results) if (isQueueStatus(c.status)) byStatus[c.status] = Number(c.n);
  return { items: items.results.map(toQueueItem), counts: byStatus };
}

export async function getQueueItem(
  reviewId: string,
): Promise<(QueueItem & { category: string | null; autoMinRating: number | null }) | null> {
  const r = await (await db())
    .prepare(
      `SELECT q.*, c.name AS client_name, c.category, c.auto_min_rating
       FROM review_queue q LEFT JOIN clients c ON c.place_id = q.place_id WHERE q.review_id = ?`,
    )
    .bind(reviewId)
    .first<Row>();
  return r
    ? { ...toQueueItem(r), category: (r.category as string) ?? null, autoMinRating: (r.auto_min_rating as number) ?? null }
    : null;
}

export async function updateQueueItem(reviewId: string, patch: { reply?: string; status?: QueueStatus }) {
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (patch.reply !== undefined) {
    sets.push("reply = ?");
    binds.push(patch.reply);
  }
  if (patch.status !== undefined) {
    sets.push("status = ?");
    binds.push(patch.status);
  }
  if (!sets.length) return;
  await (await db())
    .prepare(`UPDATE review_queue SET ${sets.join(", ")}, updated_at = ? WHERE review_id = ?`)
    .bind(...binds, new Date().toISOString(), reviewId)
    .run();
}

// ---------- configurações da agência ----------

export const DEFAULT_SETTINGS: AgencySettings = {
  agencyName: "",
  responsible: "",
  phone: "",
  email: "",
  website: "",
  replyTone: "cordial e profissional, em primeira pessoa do plural",
  proposalNotes: "Proposta válida por 15 dias. Resultados em SEO local dependem de consistência e costumam aparecer entre 60 e 90 dias.",
  services: [
    {
      name: "Otimização completa do perfil",
      description: "Correção de todos os itens do diagnóstico, categorias, serviços, descrição e atributos.",
      price: 0,
      type: "fixo",
    },
    {
      name: "Gestão mensal",
      description: "4 postagens por mês, resposta a todas as avaliações, fotos novas e relatório mensal.",
      price: 0,
      type: "recorrente",
    },
  ],
  contractTerms: [3, 6, 12],
};

export async function getSettings(): Promise<AgencySettings> {
  const row = await (await db()).prepare("SELECT value FROM settings WHERE key = 'agency'").first<{ value: string }>();
  if (!row) return DEFAULT_SETTINGS;
  try {
    const saved = { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) } as AgencySettings;
    // Serviços salvos antes da divisão fixo/recorrente: "mensal" no nome vira recorrente.
    saved.services = saved.services.map((s) => ({
      ...s,
      type: s.type === "recorrente" || s.type === "fixo" ? s.type : /mensal/i.test(s.name) ? "recorrente" : "fixo",
    }));
    if (!Array.isArray(saved.contractTerms) || !saved.contractTerms.length) saved.contractTerms = DEFAULT_SETTINGS.contractTerms;
    return saved;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: AgencySettings) {
  await (await db())
    .prepare("INSERT INTO settings (key, value) VALUES ('agency', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(JSON.stringify(s))
    .run();
}
