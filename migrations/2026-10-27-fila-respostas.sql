-- Fila de respostas às avaliações. Aplicar uma vez em bancos criados antes desta data:
--   npx wrangler d1 execute pre-analise-gmn --remote --file migrations/2026-10-27-fila-respostas.sql
--   npx wrangler d1 execute pre-analise-gmn --local  --file migrations/2026-10-27-fila-respostas.sql
ALTER TABLE clients ADD COLUMN auto_min_rating INTEGER;
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
