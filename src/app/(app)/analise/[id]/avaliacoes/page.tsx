"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getJson, postJson } from "@/lib/fetcher";
import type { FullReview, PlaceAnalysis, ReviewAnalysis } from "@/lib/types";

type Loaded = { source: "places" | "dataforseo"; reviews: FullReview[]; total: number; rating: number | null };
type Filter = "todas" | "sem_resposta" | "negativas";

const DAY = 86_400_000;
const POLL_MS = 5000;
// "Todas" pode passar de mil avaliações e levar alguns minutos na DataForSEO.
const MAX_POLLS = 120;
const REPLY_CONCURRENCY = 3;

/** Identifica a avaliação para guardar a resposta sugerida. */
const reviewKey = (r: FullReview) => `${r.author}|${r.publishTime ?? ""}|${r.text.slice(0, 40)}`;
const unanswered = (list: FullReview[]) => list.filter((r) => !r.ownerAnswer);

export default function AvaliacoesPage() {
  const { id } = useParams<{ id: string }>();
  const [info, setInfo] = useState<PlaceAnalysis | null>(null);
  const [depth, setDepth] = useState(100);
  const [data, setData] = useState<Loaded | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("todas");
  const [analysis, setAnalysis] = useState<ReviewAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisScope, setAnalysisScope] = useState<"todas" | "sem_resposta">("todas");
  // Respostas sugeridas pela IA, por avaliação (ficam só nesta tela, para revisar e copiar).
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    getJson<PlaceAnalysis>(`/api/place/${id}`).then(setInfo).catch((e) => setError(e.message));
    return () => {
      cancelled.current = true;
    };
  }, [id]);

  async function load(onlyUnanswered = false) {
    setError(null);
    setData(null);
    setAnalysis(null);
    setReplies({});
    setStatus("Iniciando coleta...");
    setFilter(onlyUnanswered ? "sem_resposta" : "todas");
    try {
      const start = await postJson<Loaded & { ready: boolean; taskId?: string }>("/api/reviews", { placeId: id, depth });
      if (start.ready) {
        setData(start);
        setStatus(null);
        return;
      }
      // A DataForSEO processa em segundo plano; consultamos até ficar pronto.
      for (let i = 0; i < MAX_POLLS && !cancelled.current; i++) {
        setStatus(`Coletando avaliações no Google... (${(i * POLL_MS) / 1000}s)`);
        await new Promise((r) => setTimeout(r, POLL_MS));
        const res = await getJson<Loaded & { ready: boolean }>(`/api/reviews?task=${start.taskId}`);
        if (res.ready) {
          setData(res);
          setStatus(null);
          return;
        }
      }
      throw new Error("A coleta demorou mais que o esperado. Tente de novo em alguns minutos.");
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    }
  }

  async function analyze(scope: "todas" | "sem_resposta") {
    if (!data) return;
    const reviews = scope === "sem_resposta" ? unanswered(data.reviews) : data.reviews;
    if (!reviews.length) {
      setError("Não há avaliações sem resposta para analisar.");
      return;
    }
    setAnalyzing(true);
    setAnalysisScope(scope);
    setError(null);
    try {
      setAnalysis(await postJson<ReviewAnalysis>("/api/reviews/analyze", { placeId: id, reviews }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na análise");
    } finally {
      setAnalyzing(false);
    }
  }

  /** Gera uma resposta para cada avaliação sem resposta que ainda não tem sugestão. */
  async function suggestAll() {
    if (!data) return;
    const todo = unanswered(data.reviews).filter((r) => !replies[reviewKey(r)]);
    if (!todo.length) return;
    const ok = confirm(
      `Gerar respostas para ${todo.length} avaliação(ões) sem resposta? Custo estimado no Claude: cerca de US$ ${(todo.length * 0.01).toFixed(2)}.`,
    );
    if (!ok) return;
    setError(null);
    setFilter("sem_resposta");
    setBulk({ done: 0, total: todo.length });
    let next = 0;
    let failed = 0;
    async function worker() {
      while (next < todo.length && !cancelled.current) {
        const r = todo[next++];
        try {
          const d = await postJson<{ reply: string }>("/api/reviews/reply", { placeId: id, review: r });
          setReplies((cur) => ({ ...cur, [reviewKey(r)]: d.reply }));
        } catch {
          failed++;
        }
        setBulk((b) => (b ? { ...b, done: b.done + 1 } : b));
      }
    }
    await Promise.all(Array.from({ length: Math.min(REPLY_CONCURRENCY, todo.length) }, worker));
    setBulk(null);
    if (failed) setError(`${failed} resposta(s) não puderam ser geradas. Clique em "Sugerir resposta" nelas para tentar de novo.`);
  }

  async function copyAll() {
    if (!data) return;
    const text = unanswered(data.reviews)
      .filter((r) => replies[reviewKey(r)])
      .map((r) => `Avaliação de ${r.author} (${r.rating}★): ${r.text || "(sem texto)"}\nResposta: ${replies[reviewKey(r)]}`)
      .join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* sem permissão de área de transferência */
    }
  }

  const stats = useMemo(() => (data ? computeStats(data.reviews) : null), [data]);
  const shown = useMemo(() => {
    const list = data?.reviews ?? [];
    if (filter === "sem_resposta") return list.filter((r) => !r.ownerAnswer);
    if (filter === "negativas") return list.filter((r) => r.rating <= 3);
    return list;
  }, [data, filter]);

  const place = info?.place;
  const claude = !!info?.providers?.claude;

  return (
    <>
      <p className="no-print">
        <Link href={`/analise/${id}`}>← Voltar para a análise</Link>
      </p>
      <h1>Avaliações{place ? ` · ${place.name}` : ""}</h1>
      <p className="sub">
        {place ? `★ ${place.rating?.toFixed(1) ?? "—"} · ${place.userRatingCount} avaliações no Google` : "Carregando..."}
      </p>

      <section className="card no-print">
        {info && !info.providers?.dataforseo && (
          <p className="notice" style={{ marginTop: 0 }}>
            Sem a DataForSEO o Google libera só 5 avaliações e não informa se foram respondidas. Configure a DataForSEO
            em Configurações para analisar todas.
          </p>
        )}
        <div className="row">
          {info?.providers?.dataforseo && (
            <label className="field">
              Quantidade (mais recentes)
              <select value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
                {[50, 100, 200, 500].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value={0}>Todas{place ? ` (${place.userRatingCount})` : ""}</option>
              </select>
            </label>
          )}
          <button onClick={() => load(false)} disabled={!!status || !info}>
            {data ? "Recarregar" : "Carregar avaliações"}
          </button>
          {info?.providers?.dataforseo && (
            <button className="btn-ghost" onClick={() => load(true)} disabled={!!status || !info}>
              Carregar não respondidas
            </button>
          )}
          {data && claude && (
            <button className="btn-ghost" onClick={() => analyze("todas")} disabled={analyzing}>
              {analyzing && analysisScope === "todas" ? "Analisando com IA..." : "Analisar com IA"}
            </button>
          )}
          {data && claude && data.source === "dataforseo" && (
            <button className="btn-ghost" onClick={() => analyze("sem_resposta")} disabled={analyzing}>
              {analyzing && analysisScope === "sem_resposta"
                ? "Analisando não respondidas..."
                : `Analisar não respondidas com IA (${unanswered(data.reviews).length})`}
            </button>
          )}
          {data && (
            <button className="btn-ghost" onClick={() => window.print()}>
              Imprimir / PDF
            </button>
          )}
        </div>
        {status && <p className="small">{status}</p>}
        {error && <div className="error">{error}</div>}
      </section>

      {stats && data && (
        <section className="card">
          <h2>Resumo</h2>
          <div className="stats">
            <div className="stat">
              <b>{data.reviews.length}</b>
              <span>avaliações analisadas de {data.total}</span>
            </div>
            <div className="stat">
              <b>{stats.avgAll.toFixed(2)}</b>
              <span>nota média da amostra</span>
            </div>
            <div className="stat">
              <b>{stats.last30}</b>
              <span>novas nos últimos 30 dias ({stats.last90} em 90)</span>
            </div>
            {data.source === "dataforseo" && (
              <div className="stat">
                <b className={stats.replyRate >= 80 ? "up" : stats.replyRate < 50 ? "down" : ""}>{stats.replyRate}%</b>
                <span>respondidas{stats.avgReplyDays !== null ? ` · em média ${stats.avgReplyDays} dia(s)` : ""}</span>
              </div>
            )}
          </div>
          <div className="grid2">
            <div>
              <h3>Distribuição</h3>
              {[5, 4, 3, 2, 1].map((s) => (
                <div key={s} className="row" style={{ alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 28 }}>{s}★</span>
                  <div className="bar-track">
                    <div
                      className="bar"
                      style={{ width: `${(stats.dist[s] / Math.max(1, data.reviews.length)) * 100}%`, background: s >= 4 ? "var(--ok)" : s === 3 ? "var(--warn)" : "var(--bad)" }}
                    />
                  </div>
                  <span className="small" style={{ width: 36, textAlign: "right" }}>
                    {stats.dist[s]}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <h3>Avaliações por mês</h3>
              <MonthBars months={stats.months} />
            </div>
          </div>
        </section>
      )}

      {analysis && (
        <AnalysisCard analysis={analysis} title={analysisScope === "sem_resposta" ? "Análise com IA das não respondidas" : "Análise com IA"} />
      )}

      {analysis && data && claude && data.source === "dataforseo" && unanswered(data.reviews).length > 0 && (
        <section className="card no-print">
          <h2>Respostas para as não respondidas</h2>
          <p className="sub">
            {unanswered(data.reviews).length} avaliação(ões) sem resposta. A IA escreve uma sugestão para cada uma, no tom definido em
            Configurações. Revise, ajuste se precisar e cole no painel do Perfil da Empresa no Google.
          </p>
          <div className="row" style={{ alignItems: "center" }}>
            <button onClick={suggestAll} disabled={!!bulk}>
              {bulk ? `Gerando respostas... ${bulk.done}/${bulk.total}` : "Sugerir respostas para todas as não respondidas"}
            </button>
            {Object.keys(replies).length > 0 && !bulk && (
              <button className="btn-ghost" onClick={copyAll}>
                Copiar todas as respostas
              </button>
            )}
            {Object.keys(replies).length > 0 && (
              <span className="small">{Object.keys(replies).length} resposta(s) prontas na lista abaixo.</span>
            )}
          </div>
        </section>
      )}

      {data && (
        <section className="card">
          <div className="row no-print" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Lista</h2>
            <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="todas">Todas ({data.reviews.length})</option>
              {data.source === "dataforseo" && (
                <option value="sem_resposta">Sem resposta ({data.reviews.filter((r) => !r.ownerAnswer).length})</option>
              )}
              <option value="negativas">Até 3 estrelas ({data.reviews.filter((r) => r.rating <= 3).length})</option>
            </select>
          </div>
          <div className="reviews" style={{ marginTop: 12 }}>
            {shown.map((r, i) => (
              <ReviewItem
                key={`${r.author}-${r.publishTime}-${i}`}
                review={r}
                placeId={id}
                canReply={claude}
                reply={replies[reviewKey(r)] ?? null}
                onReply={(text) => setReplies((cur) => ({ ...cur, [reviewKey(r)]: text }))}
              />
            ))}
            {shown.length === 0 && <p className="small">Nenhuma avaliação neste filtro.</p>}
          </div>
        </section>
      )}
    </>
  );
}

function computeStats(reviews: FullReview[]) {
  const now = Date.now();
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let last30 = 0;
  let last90 = 0;
  let replied = 0;
  const replyDelays: number[] = [];
  const months = new Map<string, number>();
  for (const r of reviews) {
    const s = Math.min(5, Math.max(1, Math.round(r.rating)));
    dist[s]++;
    sum += r.rating;
    if (r.ownerAnswer) replied++;
    if (r.publishTime) {
      const t = Date.parse(r.publishTime);
      if (now - t <= 30 * DAY) last30++;
      if (now - t <= 90 * DAY) last90++;
      const key = r.publishTime.slice(0, 7);
      months.set(key, (months.get(key) ?? 0) + 1);
      if (r.ownerTime) replyDelays.push(Math.max(0, (Date.parse(r.ownerTime) - t) / DAY));
    }
  }
  // Últimos 12 meses, inclusive os vazios.
  const monthList: { label: string; count: number }[] = [];
  const d = new Date();
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    monthList.push({ label: m.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), count: months.get(key) ?? 0 });
  }
  return {
    dist,
    avgAll: reviews.length ? sum / reviews.length : 0,
    last30,
    last90,
    replyRate: reviews.length ? Math.round((replied / reviews.length) * 100) : 0,
    avgReplyDays: replyDelays.length ? Math.round(replyDelays.reduce((a, b) => a + b, 0) / replyDelays.length) : null,
    months: monthList,
  };
}

function MonthBars({ months }: { months: { label: string; count: number }[] }) {
  const max = Math.max(1, ...months.map((m) => m.count));
  return (
    <div style={{ display: "flex", alignItems: "end", gap: 6, height: 130 }}>
      {months.map((m, i) => (
        <div key={i} style={{ flex: 1, textAlign: "center" }} title={`${m.label}: ${m.count}`}>
          <div className="small">{m.count || ""}</div>
          <div style={{ height: `${(m.count / max) * 90}px`, background: "var(--accent)", borderRadius: 4, minHeight: m.count ? 3 : 0 }} />
          <div className="small">{m.label}</div>
        </div>
      ))}
    </div>
  );
}

function AnalysisCard({ analysis, title }: { analysis: ReviewAnalysis; title: string }) {
  const tone = { positivo: "ok", misto: "warn", negativo: "bad" }[analysis.sentimentoGeral];
  return (
    <section className="card">
      <h2>
        {title} <span className={`badge ${tone}`}>sentimento {analysis.sentimentoGeral}</span>
      </h2>
      <p>{analysis.resumo}</p>
      <div className="grid2">
        <div>
          <h3>👍 Pontos fortes</h3>
          {analysis.pontosFortes.map((p, i) => (
            <p key={i} className="small" style={{ margin: "0 0 8px" }}>
              <strong style={{ color: "var(--ink)" }}>{p.tema}</strong> · {p.mencoes} menções
              <br />“{p.exemplo}”
            </p>
          ))}
        </div>
        <div>
          <h3>👎 Pontos fracos</h3>
          {analysis.pontosFracos.length === 0 && <p className="small">Nenhum padrão negativo relevante.</p>}
          {analysis.pontosFracos.map((p, i) => (
            <p key={i} className="small" style={{ margin: "0 0 8px" }}>
              <strong style={{ color: "var(--ink)" }}>{p.tema}</strong> · {p.mencoes} menções
              <br />“{p.exemplo}”
            </p>
          ))}
        </div>
      </div>
      <h3>Palavras que os clientes usam</h3>
      <p className="small">{analysis.palavrasChave.join(" · ")}</p>
      <h3>O que fazer</h3>
      <ol style={{ margin: 0, paddingLeft: 20 }}>
        {analysis.sugestoes.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </section>
  );
}

function ReviewItem({
  review,
  placeId,
  canReply,
  reply,
  onReply,
}: {
  review: FullReview;
  placeId: string;
  canReply: boolean;
  /** Resposta sugerida guardada pela página (individual ou do "sugerir para todas"). */
  reply: string | null;
  onReply: (text: string) => void;
}) {
  const setReply = onReply;
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setErr(null);
    try {
      const d = await postJson<{ reply: string }>("/api/reviews/reply", { placeId, review });
      setReply(d.reply);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sem permissão de área de transferência: o texto continua selecionável */
    }
  }

  return (
    <div className="review">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <span>
          <strong style={{ color: review.rating >= 4 ? "var(--ok)" : review.rating === 3 ? "var(--warn)" : "var(--bad)" }}>
            {"★".repeat(Math.round(review.rating))}
          </strong>{" "}
          <span className="small">
            {review.author} · {review.relativeTime ?? (review.publishTime ? new Date(review.publishTime).toLocaleDateString("pt-BR") : "")}
          </span>
        </span>
        {canReply && !review.ownerAnswer && (
          <button className="btn-sm btn-ghost no-print" onClick={generate} disabled={loading}>
            {loading ? "Gerando..." : reply ? "Gerar outra" : "Sugerir resposta"}
          </button>
        )}
      </div>
      {review.text && <div style={{ marginTop: 4 }}>{review.text}</div>}
      {review.ownerAnswer && (
        <div className="small" style={{ marginTop: 6, background: "var(--surface)", borderRadius: 8, padding: "6px 10px" }}>
          <strong>Resposta do proprietário:</strong> {review.ownerAnswer}
        </div>
      )}
      {err && <div className="error">{err}</div>}
      {reply && (
        <div className="no-print" style={{ marginTop: 8 }}>
          <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn-sm" onClick={copy}>
              {copied ? "Copiado!" : "Copiar"}
            </button>
            <span className="small">Cole a resposta no painel do Perfil da Empresa no Google.</span>
          </div>
        </div>
      )}
    </div>
  );
}
