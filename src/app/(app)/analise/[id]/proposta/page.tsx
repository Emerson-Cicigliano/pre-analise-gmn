"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ContractSimulation from "@/components/ContractSimulation";
import { brl, dateBR, getJson } from "@/lib/fetcher";
import type { AgencyService, AgencySettings, HistoryGrid, HistorySnapshot, PlaceAnalysis } from "@/lib/types";

type Line = AgencyService & { selected: boolean };

export default function PropostaPage() {
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<PlaceAnalysis | null>(null);
  const [settings, setSettings] = useState<AgencySettings | null>(null);
  const [grid, setGrid] = useState<HistoryGrid | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [contact, setContact] = useState("");
  // Tempos de contrato da simulação: começam com os de Configurações e podem ser ajustados nesta proposta.
  const [terms, setTerms] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getJson<PlaceAnalysis>(`/api/place/${id}`),
      getJson<{ settings: AgencySettings }>("/api/settings"),
      getJson<{ snapshots: HistorySnapshot[]; grids: HistoryGrid[] }>(`/api/history/${id}`),
    ])
      .then(([analysis, s, h]) => {
        setA(analysis);
        setSettings(s.settings);
        setLines(s.settings.services.map((sv) => ({ ...sv, selected: true })));
        setTerms(s.settings.contractTerms);
        setGrid(h.grids[h.grids.length - 1] ?? null);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const sumOf = (type: AgencyService["type"]) =>
    lines.filter((l) => l.selected && l.type === type).reduce((s, l) => s + l.price, 0);
  const fixedTotal = useMemo(() => sumOf("fixo"), [lines]); // eslint-disable-line react-hooks/exhaustive-deps
  const recurringTotal = useMemo(() => sumOf("recorrente"), [lines]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="error">{error}</div>;
  if (!a || !settings) return <p className="small">Carregando...</p>;

  const { place, score, checklist } = a;
  const pending = checklist.filter((c) => c.status !== "ok").sort((x, y) => y.max - y.points - (x.max - x.points));
  const potential = Math.min(100, score + pending.reduce((s, c) => s + (c.max - c.points), 0));
  const agency = settings.agencyName || "Sua agência";
  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <>
      <div className="no-print">
        <p>
          <Link href={`/analise/${id}`}>← Voltar para a análise</Link>
        </p>
        <h1>Proposta comercial</h1>
        <p className="sub">
          Ajuste os itens e imprima em PDF. Os dados da agência e os serviços padrão vêm de <Link href="/configuracoes">Configurações</Link>.
        </p>
        <section className="card">
          <label className="field">
            A/C (nome do contato no cliente)
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Ex.: João Silva" />
          </label>
          <h3 style={{ marginTop: 14 }}>Serviços</h3>
          {lines.map((l, i) => (
            <div className="row" key={i} style={{ alignItems: "center", marginBottom: 8 }}>
              <input type="checkbox" checked={l.selected} onChange={(e) => setLine(i, { selected: e.target.checked })} style={{ width: 18, height: 18 }} />
              <span style={{ flex: 1 }}>
                {l.name || "(sem nome)"} <span className="badge">{l.type === "recorrente" ? "mensal" : "fixo"}</span>
              </span>
              <input type="number" min={0} step="0.01" value={l.price} onChange={(e) => setLine(i, { price: Number(e.target.value) })} style={{ width: 130 }} />
            </div>
          ))}
          <button onClick={() => window.print()} style={{ marginTop: 8 }}>
            Imprimir / salvar PDF
          </button>
        </section>
      </div>

      <article className="card proposal">
        <header className="proposal-head">
          <div>
            <div className="small">Proposta de otimização do Perfil da Empresa no Google</div>
            <h1 style={{ margin: "4px 0" }}>{place.name}</h1>
            <div className="small">
              {contact && <>A/C {contact} · </>}
              {dateBR(new Date().toISOString())}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <strong>{agency}</strong>
            <div className="small">{[settings.responsible, settings.phone, settings.email].filter(Boolean).join(" · ")}</div>
            {settings.website && <div className="small">{settings.website}</div>}
          </div>
        </header>

        <h2>1. Diagnóstico atual</h2>
        <div className="stats">
          <div className="stat">
            <b style={{ color: score >= 80 ? "var(--ok)" : score >= 50 ? "var(--warn)" : "var(--bad)" }}>{score}/100</b>
            <span>nota de saúde do perfil hoje</span>
          </div>
          <div className="stat">
            <b style={{ color: "var(--ok)" }}>{potential}/100</b>
            <span>nota possível após a otimização</span>
          </div>
          <div className="stat">
            <b>{place.rating?.toFixed(1) ?? "—"} ★</b>
            <span>{place.userRatingCount} avaliações</span>
          </div>
          {grid && (
            <div className="stat">
              <b>{grid.top3Share}%</b>
              <span>
                da região no top 3 para “{grid.keyword}”
              </span>
            </div>
          )}
        </div>
        {grid && grid.top3Share < 50 && (
          <p>
            Hoje a empresa aparece entre os 3 primeiros do Google Maps em apenas <strong>{grid.top3Share}%</strong> da região
            analisada para a busca “{grid.keyword}”. As outras posições ficam com concorrentes — e é nos 3 primeiros que
            acontece a maior parte dos cliques e ligações.
          </p>
        )}

        <h2>2. Pontos de melhoria encontrados</h2>
        {pending.length === 0 ? (
          <p>O perfil está completo nos itens verificáveis publicamente. O foco passa a ser manutenção e crescimento.</p>
        ) : (
          <table>
            <tbody>
              {pending.map((c) => (
                <tr key={c.id}>
                  <td style={{ width: 90 }}>
                    <span className={`pill ${c.status}`}>{c.status === "parcial" ? "Parcial" : "Falta"}</span>
                  </td>
                  <td>
                    <strong>{c.label}</strong>
                    <div className="small">{c.tip}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2>3. Investimento</h2>
        {(["fixo", "recorrente"] as const).map((type) => {
          const group = lines.filter((l) => l.selected && l.type === type);
          if (!group.length) return null;
          return (
            <table key={type} style={{ marginBottom: 14 }}>
              <thead>
                <tr>
                  <th>{type === "fixo" ? "Serviços fixos (pagos uma vez)" : "Serviços recorrentes (mensalidade)"}</th>
                  <th className="num">{type === "fixo" ? "Valor" : "Valor/mês"}</th>
                </tr>
              </thead>
              <tbody>
                {group.map((l, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{l.name}</strong>
                      <div className="small">{l.description}</div>
                    </td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      {l.price > 0 ? brl(l.price) : "a combinar"}
                    </td>
                  </tr>
                ))}
                <tr className="me">
                  <td>{type === "fixo" ? "Total fixo" : "Total recorrente (por mês)"}</td>
                  <td className="num">{brl(type === "fixo" ? fixedTotal : recurringTotal)}</td>
                </tr>
              </tbody>
            </table>
          );
        })}
        <h3 style={{ marginTop: 18 }}>Simulação por tempo de contrato</h3>
        <ContractSimulation fixedTotal={fixedTotal} recurringTotal={recurringTotal} terms={terms} onTermsChange={setTerms} />

        {settings.proposalNotes && (
          <>
            <h2>4. Condições</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{settings.proposalNotes}</p>
          </>
        )}
      </article>

      <style>{`
        .proposal h2 { margin-top: 22px; font-size: 17px; }
        .proposal-head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
          border-bottom: 3px solid var(--accent); padding-bottom: 14px; margin-bottom: 8px; }
      `}</style>
    </>
  );
}
