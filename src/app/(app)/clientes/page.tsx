"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dateBR, getJson, postJson } from "@/lib/fetcher";
import type { ClientRow } from "@/lib/types";

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    getJson<{ clients: ClientRow[] }>("/api/clients")
      .then((d) => setClients(d.clients))
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function remove(c: ClientRow) {
    if (!confirm(`Remover ${c.name} da lista de clientes? O histórico fica guardado.`)) return;
    await fetch(`/api/clients?placeId=${encodeURIComponent(c.placeId)}`, { method: "DELETE" });
    load();
  }

  async function setRule(c: ClientRow, autoMinRating: number | null) {
    setClients((list) => list?.map((x) => (x.placeId === c.placeId ? { ...x, autoMinRating } : x)) ?? null);
    try {
      await postJson("/api/clients", { placeId: c.placeId, autoMinRating }, "PATCH");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar a regra");
      load();
    }
  }

  return (
    <>
      <h1>Clientes</h1>
      <p className="sub">Perfis acompanhados. Abra a análise de cada um periodicamente para registrar a evolução.</p>
      {error && <div className="error">{error}</div>}
      {clients && clients.length === 0 && (
        <div className="card">
          <p style={{ margin: 0 }}>
            Nenhum cliente ainda. <Link href="/">Busque uma empresa</Link> e clique em “Adicionar aos clientes” na análise.
          </p>
        </div>
      )}
      {clients && clients.length > 0 && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th className="num">Nota</th>
                <th className="num">Evolução</th>
                <th className="num">Top 3 na grade</th>
                <th>Última análise</th>
                <th>Respostas às avaliações</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const delta = c.lastScore !== null && c.firstScore !== null ? c.lastScore - c.firstScore : null;
                return (
                  <tr key={c.placeId}>
                    <td>
                      <Link href={`/analise/${c.placeId}`}>
                        <strong>{c.name}</strong>
                      </Link>
                      <div className="small">{c.category ?? c.address}</div>
                    </td>
                    <td className="num">
                      {c.lastScore !== null ? (
                        <span className={`badge ${c.lastScore >= 80 ? "ok" : c.lastScore >= 50 ? "warn" : "bad"}`}>{c.lastScore}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num">
                      {delta === null ? "—" : <span className={delta > 0 ? "up" : delta < 0 ? "down" : ""}>{delta > 0 ? `+${delta}` : delta}</span>}
                    </td>
                    <td className="num">{c.lastTop3Share !== null ? `${c.lastTop3Share}%` : "—"}</td>
                    <td>{c.lastAnalysisAt ? dateBR(c.lastAnalysisAt) : "—"}</td>
                    <td>
                      <select
                        aria-label={`Regra de aprovação de ${c.name}`}
                        value={c.autoMinRating ?? ""}
                        onChange={(e) => setRule(c, e.target.value ? Number(e.target.value) : null)}
                        style={{ width: "auto" }}
                      >
                        <option value="">Revisar todas</option>
                        <option value={4}>Aprovar 4 e 5★ sozinhas</option>
                        <option value={5}>Aprovar só 5★ sozinhas</option>
                      </select>
                      {c.pendingReplies > 0 && (
                        <div className="small" style={{ marginTop: 4 }}>
                          <Link href={`/fila?placeId=${encodeURIComponent(c.placeId)}`}>{c.pendingReplies} na fila</Link>
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link className="btn btn-sm btn-ghost" href={`/analise/${c.placeId}`}>
                        Analisar
                      </Link>{" "}
                      <a
                        className="btn btn-sm btn-ghost"
                        href={`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(c.placeId)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver no Google ↗
                      </a>{" "}
                      <button className="btn-sm btn-danger" onClick={() => remove(c)}>
                        Remover
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
