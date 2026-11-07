"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { dateBR, getJson, postJson } from "@/lib/fetcher";
import type { ClientRow, QueueItem, QueueStatus } from "@/lib/types";

type QueueData = { items: QueueItem[]; counts: Record<QueueStatus, number> };

const TABS: { status: QueueStatus; label: string }[] = [
  { status: "pendente", label: "Para revisar" },
  { status: "aprovada", label: "Aprovadas · falta publicar" },
  { status: "publicada", label: "Publicadas" },
  { status: "ignorada", label: "Ignoradas" },
];

const POLL_MS = 5000;
const MAX_POLLS = 60;
const DRAFT_CONCURRENCY = 3;

const mapsLink = (placeId: string) => `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;

export default function FilaPage() {
  const [status, setStatus] = useState<QueueStatus>("pendente");
  const [placeId, setPlaceId] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [data, setData] = useState<QueueData | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  // Abre já filtrada quando vem da lista de clientes (/fila?placeId=...).
  useEffect(() => {
    cancelled.current = false;
    const fromUrl = new URLSearchParams(window.location.search).get("placeId");
    if (fromUrl) setPlaceId(fromUrl);
    getJson<{ clients: ClientRow[] }>("/api/clients")
      .then((d) => setClients(d.clients))
      .catch((e) => setError(e.message));
    return () => {
      cancelled.current = true;
    };
  }, []);

  const load = useCallback(() => {
    const q = new URLSearchParams({ status });
    if (placeId) q.set("placeId", placeId);
    getJson<QueueData>(`/api/queue?${q}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [status, placeId]);
  useEffect(load, [load]);

  /** Escreve a resposta das avaliações pendentes que ainda não têm uma. */
  async function draftMissing() {
    const q = new URLSearchParams({ status: "pendente" });
    if (placeId) q.set("placeId", placeId);
    const todo = (await getJson<QueueData>(`/api/queue?${q}`)).items.filter((i) => !i.reply);
    if (!todo.length) return 0;
    let next = 0;
    let done = 0;
    let failed = 0;
    async function worker() {
      while (next < todo.length && !cancelled.current) {
        const item = todo[next++];
        try {
          await postJson("/api/queue/draft", { reviewId: item.reviewId });
        } catch {
          failed++;
        }
        setProgress(`Escrevendo respostas com IA... ${++done}/${todo.length}`);
      }
    }
    await Promise.all(Array.from({ length: Math.min(DRAFT_CONCURRENCY, todo.length) }, worker));
    if (failed) setError(`${failed} resposta(s) não puderam ser escritas. Use "Gerar resposta" nelas.`);
    return todo.length - failed;
  }

  async function scan() {
    setError(null);
    setMsg(null);
    setProgress("Pedindo as avaliações recentes ao Google...");
    try {
      const { tasks } = await postJson<{ tasks: { placeId: string; name: string; taskId: string }[] }>("/api/queue/scan", {
        placeId: placeId || undefined,
      });
      let pending = [...tasks];
      let added = 0;
      for (let i = 0; i < MAX_POLLS && pending.length && !cancelled.current; i++) {
        setProgress(`Coletando avaliações de ${pending.length} cliente(s)... (${(i * POLL_MS) / 1000}s)`);
        await new Promise((r) => setTimeout(r, POLL_MS));
        const results = await Promise.all(
          pending.map((t) =>
            getJson<{ ready: boolean; added?: number }>(`/api/queue/scan?task=${t.taskId}&placeId=${encodeURIComponent(t.placeId)}`)
              .then((r) => ({ t, r }))
              .catch(() => ({ t, r: { ready: false } as { ready: boolean; added?: number } })),
          ),
        );
        for (const { r } of results) if (r.ready) added += r.added ?? 0;
        pending = results.filter(({ r }) => !r.ready).map(({ t }) => t);
      }
      const drafted = await draftMissing();
      setMsg(
        `${added} avaliação(ões) nova(s) sem resposta entraram na fila` +
          (drafted ? `; ${drafted} resposta(s) escritas pela IA.` : ".") +
          (pending.length ? ` ${pending.length} cliente(s) demoraram demais: busque de novo em alguns minutos.` : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao buscar avaliações");
    } finally {
      setProgress(null);
      load();
    }
  }

  const counts = data?.counts;
  const filterName = clients.find((c) => c.placeId === placeId)?.name;

  return (
    <>
      <h1>Fila de respostas</h1>
      <p className="sub">
        Avaliações sem resposta dos clientes, com a resposta escrita pela IA. Revise, aprove e publique no Google.
      </p>

      <section className="card">
        <div className="row" style={{ alignItems: "end" }}>
          <label className="field">
            Cliente
            <select value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
              <option value="">Todos os clientes</option>
              {clients.map((c) => (
                <option key={c.placeId} value={c.placeId}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button onClick={scan} disabled={!!progress || !clients.length}>
            {progress ? "Buscando..." : filterName ? `Buscar avaliações novas de ${filterName}` : "Buscar avaliações novas de todos"}
          </button>
          {!progress && status === "pendente" && data?.items.some((i) => !i.reply) && (
            <button className="btn-ghost" onClick={() => draftMissing().then(load)}>
              Escrever respostas que faltam
            </button>
          )}
        </div>
        {progress && <p className="small">{progress}</p>}
        {msg && <p className="small">{msg}</p>}
        {error && <div className="error">{error}</div>}
        <p className="notice" style={{ marginBottom: 0 }}>
          Por enquanto a publicação é manual: em <strong>Aprovadas</strong>, clique em “Copiar e abrir no Google”, cole a
          resposta no perfil e marque como publicada. Quando o Google liberar a API, as aprovadas serão publicadas sozinhas.
          A regra de aprovação automática de cada cliente fica em <Link href="/clientes">Clientes</Link>.
        </p>
      </section>

      <div className="queue-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.status}
            role="tab"
            aria-selected={status === t.status}
            className={status === t.status ? "on" : ""}
            onClick={() => setStatus(t.status)}
          >
            {t.label}
            {counts && <span className="badge">{counts[t.status]}</span>}
          </button>
        ))}
      </div>

      <section className="card">
        {!data && !error && <p className="small">Carregando...</p>}
        {data && data.items.length === 0 && (
          <p className="small" style={{ margin: 0 }}>
            {status === "pendente"
              ? "Nada para revisar. Clique em “Buscar avaliações novas” para conferir os perfis dos clientes."
              : "Nenhuma avaliação aqui."}
          </p>
        )}
        <div className="reviews">
          {data?.items.map((item) => (
            <QueueCard key={item.reviewId} item={item} onChange={load} />
          ))}
        </div>
      </section>
    </>
  );
}

function QueueCard({ item, onChange }: { item: QueueItem; onChange: () => void }) {
  const [reply, setReply] = useState(item.reply ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function patch(body: { reply?: string; status?: QueueStatus }, reload = true) {
    setBusy(true);
    setErr(null);
    try {
      await postJson("/api/queue", { reviewId: item.reviewId, ...body }, "PATCH");
      if (reload) onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setErr(null);
    try {
      const d = await postJson<{ reply: string; status: QueueStatus }>("/api/queue/draft", { reviewId: item.reviewId });
      setReply(d.reply);
      if (d.status !== item.status) onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o texto continua selecionável */
    }
  }

  const color = item.rating >= 4 ? "var(--ok)" : item.rating === 3 ? "var(--warn)" : "var(--bad)";
  const editable = item.status === "pendente" || item.status === "aprovada";

  return (
    <div className="review">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <span>
          <Link href={`/analise/${item.placeId}`}>
            <strong>{item.clientName || "Cliente"}</strong>
          </Link>{" "}
          · <strong style={{ color }}>{"★".repeat(item.rating)}</strong>{" "}
          <span className="small">
            {item.author}
            {item.publishedAt ? ` · ${dateBR(item.publishedAt)}` : ""}
          </span>
        </span>
        {item.rating <= 3 && <span className="badge bad">atenção</span>}
      </div>
      <div style={{ marginTop: 4 }}>{item.text || <span className="small">(sem texto, só a nota)</span>}</div>

      {editable ? (
        <textarea
          rows={3}
          style={{ marginTop: 8 }}
          value={reply}
          placeholder={busy ? "Escrevendo..." : "Sem resposta ainda. Clique em “Gerar resposta” ou escreva aqui."}
          onChange={(e) => setReply(e.target.value)}
          onBlur={() => reply.trim() !== (item.reply ?? "") && patch({ reply }, false)}
        />
      ) : (
        reply && (
          <div className="small" style={{ marginTop: 6, background: "var(--surface)", borderRadius: 8, padding: "6px 10px" }}>
            <strong>Resposta:</strong> {reply}
          </div>
        )
      )}
      {err && <div className="error">{err}</div>}

      <div className="row" style={{ marginTop: 8 }}>
        {item.status === "pendente" && (
          <>
            <button className="btn-sm" disabled={busy || !reply.trim()} onClick={() => patch({ reply, status: "aprovada" })}>
              Aprovar
            </button>
            <button className="btn-sm btn-ghost" disabled={busy} onClick={generate}>
              {busy ? "Aguarde..." : reply ? "Gerar outra" : "Gerar resposta"}
            </button>
            <button className="btn-sm btn-ghost" disabled={busy} onClick={() => patch({ status: "ignorada" })}>
              Ignorar
            </button>
          </>
        )}
        {item.status === "aprovada" && (
          <>
            <a className="btn btn-sm" href={mapsLink(item.placeId)} target="_blank" rel="noreferrer" onClick={copy}>
              {copied ? "Copiado! Cole no Google ↗" : "Copiar e abrir no Google ↗"}
            </a>
            <button className="btn-sm btn-ghost" disabled={busy} onClick={() => patch({ reply, status: "publicada" })}>
              Marcar como publicada
            </button>
            <button className="btn-sm btn-ghost" disabled={busy} onClick={() => patch({ reply, status: "pendente" })}>
              Voltar para revisão
            </button>
          </>
        )}
        {(item.status === "publicada" || item.status === "ignorada") && (
          <button className="btn-sm btn-ghost" disabled={busy} onClick={() => patch({ status: "pendente" })}>
            Reabrir
          </button>
        )}
      </div>
    </div>
  );
}
