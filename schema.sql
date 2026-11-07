-- Estrutura do banco D1. Aplicar com:
--   npx wrangler d1 execute pre-analise-gmn --remote --file schema.sql   (online)
--   npx wrangler d1 execute pre-analise-gmn --local  --file schema.sql   (no computador)
CREATE TABLE IF NOT EXISTS clients (
  place_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  category TEXT,
  added_at TEXT NOT NULL,
  -- respostas com nota >= este valor são aprovadas sozinhas; NULL = todas passam pela fila
  auto_min_rating INTEGER
);
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  score INTEGER NOT NULL,
  rating REAL,
  reviews INTEGER NOT NULL,
  photos INTEGER NOT NULL,
  checklist TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_snapshots ON snapshots(place_id, created_at);
CREATE TABLE IF NOT EXISTS grids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  keyword TEXT NOT NULL,
  size INTEGER NOT NULL,
  spacing_km REAL NOT NULL,
  provider TEXT NOT NULL,
  avg_rank_found REAL,
  avg_rank_overall REAL NOT NULL,
  top3_share INTEGER NOT NULL,
  found_share INTEGER NOT NULL,
  points TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_grids ON grids(place_id, created_at);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- Fila de respostas às avaliações dos clientes (status: pendente, aprovada, publicada, ignorada).
CREATE TABLE IF NOT EXISTS review_queue (
  review_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  author TEXT NOT NULL,
  rating INTEGER NOT NULL,
  text TEXT NOT NULL,
  published_at TEXT,
  reply TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_queue ON review_queue(status, place_id);
