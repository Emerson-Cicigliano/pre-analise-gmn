"use client";

import { gridMetrics } from "@/lib/geogrid";
import { MANUAL_ITEMS, type ManualState, type ManualViewResult } from "@/lib/manual";
import { LEVEL_COLORS, rankLevel } from "@/lib/region";
import type { CheckItem, CompareResult, GeogridResult, RegionRow, SearchVolumeResult } from "@/lib/types";

// ---------- velocímetro da nota ----------

const G = { cx: 130, cy: 128, r: 100, w: 30 };

function polar(v: number, r = G.r) {
  const a = Math.PI * (1 - v / 100);
  return { x: G.cx + r * Math.cos(a), y: G.cy - r * Math.sin(a) };
}

function arc(from: number, to: number) {
  const a = polar(from);
  const b = polar(to);
  return `M ${a.x} ${a.y} A ${G.r} ${G.r} 0 0 1 ${b.x} ${b.y}`;
}

export function Gauge({ score }: { score: number }) {
  const tip = polar(score, G.r - 22);
  return (
    <svg viewBox="0 0 260 175" className="gauge" role="img" aria-label={`Nota ${score} de 100`}>
      <path d={arc(0, 50)} stroke={LEVEL_COLORS.bad} strokeWidth={G.w} fill="none" />
      <path d={arc(50, 80)} stroke={LEVEL_COLORS.mid} strokeWidth={G.w} fill="none" />
      <path d={arc(80, 100)} stroke={LEVEL_COLORS.good} strokeWidth={G.w} fill="none" />
      {[0, 20, 40, 60, 80, 100].map((t) => {
        const p = polar(t, G.r - 32);
        return (
          <text key={t} x={p.x} y={p.y + 4} textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--mono)">
            {t}
          </text>
        );
      })}
      <line x1={G.cx} y1={G.cy} x2={tip.x} y2={tip.y} stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
      <circle cx={G.cx} cy={G.cy} r="8" fill="var(--ink)" />
      <circle cx={G.cx} cy={G.cy} r="3" fill="var(--accent)" />
      <text x={G.cx} y={G.cy + 42} textAnchor="middle" fontSize="36" fontWeight="700" fill="var(--ink)" fontFamily="var(--display)">
        {score}
      </text>
    </svg>
  );
}

export function LevelCounts({ checklist, manualPending }: { checklist: CheckItem[]; manualPending: number }) {
  const n = (s: CheckItem["status"]) => checklist.filter((c) => c.status === s).length;
  const rows = [
    { label: "Fraco", count: n("falta"), cls: "bad" },
    { label: "Razoável", count: n("parcial"), cls: "mid" },
    { label: "Bom", count: n("ok"), cls: "good" },
    { label: "Verificação manual pendente", count: manualPending, cls: "manual" },
  ];
  return (
    <ul className="level-counts">
      {rows.map((r) => (
        <li key={r.label} className={r.cls}>
          <span className="dot">{r.count}</span>
          {r.label}
        </li>
      ))}
    </ul>
  );
}

// ---------- itens da análise de saúde ----------

const ICON: Record<CheckItem["status"], { cls: string; glyph: string }> = {
  ok: { cls: "good", glyph: "✓" },
  parcial: { cls: "mid", glyph: "!" },
  falta: { cls: "bad", glyph: "✕" },
};

export function LevelBar({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="hbar">
      <div className="hbar-mark" style={{ left: `${p}%` }}>
        <span>{p}%</span>▼
      </div>
      <div className="hbar-track">
        <span className="bad">Fraco</span>
        <span className="mid">Razoável</span>
        <span className="good">Bom</span>
      </div>
    </div>
  );
}

export function HealthItem({ item }: { item: CheckItem }) {
  const icon = ICON[item.status];
  return (
    <div className="hitem">
      <span className={`hicon ${icon.cls}`}>{icon.glyph}</span>
      <div>
        <h3>{item.label}</h3>
        <p className="hwhy">{item.why}</p>
        <p className="hdetail">{item.detail}</p>
        {item.status !== "ok" && <p className="htip">Como melhorar: {item.tip}</p>}
        <LevelBar pct={(item.points / item.max) * 100} />
      </div>
    </div>
  );
}

/** Ordem do relatório: primeiro o que precisa de atenção. */
export function sortedChecklist(checklist: CheckItem[]) {
  const order = { falta: 0, parcial: 1, ok: 2 };
  return [...checklist].sort((a, b) => order[a.status] - order[b.status] || b.max - a.max);
}

export function ManualItems({
  state,
  view,
  onToggle,
}: {
  state: ManualState;
  /** Itens escondidos (viraram automáticos) e itens verificados automaticamente no perfil. */
  view: ManualViewResult;
  onToggle?: (id: string) => void;
}) {
  return (
    <>
      {MANUAL_ITEMS.filter((m) => !view.hidden.includes(m.id)).map((m) => {
        const auto = view.auto[m.id];
        if (auto) {
          return (
            <div className="hitem" key={m.id}>
              <span className={`hicon ${auto.ok ? "good" : "bad"}`}>{auto.ok ? "✓" : "✕"}</span>
              <div>
                <h3>{m.label}</h3>
                <p className="hwhy">{m.why}</p>
                <p className="hdetail">{auto.detail}</p>
              </div>
            </div>
          );
        }
        const done = !!state[m.id];
        return (
          <div className="hitem" key={m.id}>
            <span className={`hicon ${done ? "good" : "manual"}`}>{done ? "✓" : "?"}</span>
            <div>
              <h3>
                {m.label} <span className="manual-tag">manual</span>
              </h3>
              <p className="hwhy">{m.why}</p>
              <p className="hdetail">
                {done ? "Conferido manualmente no perfil." : "Verificação manual: confira no perfil e marque quando estiver ok."}
              </p>
              {onToggle && (
                <label className="manual-check no-print">
                  <input type="checkbox" checked={done} onChange={() => onToggle(m.id)} /> Está ok no perfil
                </label>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ---------- ranking por região ----------

export function GridSquares({ grid }: { grid: GeogridResult }) {
  return (
    <div className="squares" style={{ gridTemplateColumns: `repeat(${grid.size}, 1fr)` }}>
      {grid.points.map((p, i) => (
        <span key={i} className={`sq ${rankLevel(p.rank)}`} title={p.rank ? `${p.rank}ª posição` : "Fora do top 20"}>
          {p.rank ?? "20+"}
        </span>
      ))}
    </div>
  );
}

export function GridSummary({ grid }: { grid: GeogridResult }) {
  const found = grid.points.filter((p) => p.rank !== null).length;
  return (
    <dl className="grid-summary">
      <div>
        <dt>SoLV (presença no top 3):</dt>
        <dd>{grid.top3Share}%</dd>
      </div>
      <div>
        <dt>Posição média:</dt>
        <dd>{grid.avgRankFound !== null ? String(grid.avgRankFound).replace(".", ",") : "—"}</dd>
      </div>
      <div>
        <dt>Presente em:</dt>
        <dd>
          {found} de {grid.points.length} pontos
        </dd>
      </div>
    </dl>
  );
}

export function RegionTable({ rows }: { rows: RegionRow[] }) {
  return (
    <table className="region-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Negócio</th>
          <th>Categoria</th>
          <th className="num">Nota</th>
          <th className="num">Avaliações</th>
          <th className="num">Top 3 em</th>
          <th className="num">Pos. média</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={r.isTarget ? "me" : ""}>
            <td>{r.position}</td>
            <td>{r.name}</td>
            <td>{r.category ?? "—"}</td>
            <td className="num">{r.rating !== null ? String(r.rating).replace(".", ",") : "—"}</td>
            <td className="num">{r.votes || "—"}</td>
            <td className="num">{r.top3Share}% dos pontos</td>
            <td className="num">{r.avgRank !== null ? String(r.avgRank).replace(".", ",") : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function regionSentence(name: string, rows: RegionRow[]) {
  const me = rows.find((r) => r.isTarget);
  if (!me || me.top3Share === 0) return `${name} não aparece no top 3 em nenhum ponto da grade.`;
  return `${name} está em ${me.position}º lugar entre os negócios que aparecem na grade (destacado).`;
}

// ---------- grade dos concorrentes selecionados ----------

/** Grade de outro negócio, tirada das mesmas buscas (posição dele na lista de cada ponto). */
export function gridFor(grid: GeogridResult, id: string): GeogridResult {
  const points = grid.points.map((p) => {
    const idx = (p.ids ?? p.topIds).indexOf(id);
    return { ...p, rank: idx === -1 ? null : idx + 1 };
  });
  return { ...grid, points, ...gridMetrics(points) };
}

export function CompareGrids({ grid, targetId, targetName }: { grid: GeogridResult; targetId: string; targetName: string }) {
  const list = [{ id: targetId, name: targetName, isTarget: true }, ...(grid.compared ?? []).map((c) => ({ ...c, isTarget: false }))];
  if (list.length < 2) return null;
  return (
    <div className="cmp-grids">
      {list.map((b) => {
        const g = b.isTarget ? grid : gridFor(grid, b.id);
        const found = g.points.filter((p) => p.rank !== null).length;
        return (
          <div key={b.id} className={`cmp-grid${b.isTarget ? " me" : ""}`}>
            <strong>{b.isTarget ? `${b.name} (cliente)` : b.name}</strong>
            <GridSquares grid={g} />
            <dl>
              <div>
                <dt>Top 3</dt>
                <dd>{g.top3Share}%</dd>
              </div>
              <div>
                <dt>Pos. média</dt>
                <dd>{g.avgRankFound !== null ? String(g.avgRankFound).replace(".", ",") : "—"}</dd>
              </div>
              <div>
                <dt>Presente</dt>
                <dd>
                  {found}/{g.points.length}
                </dd>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}

// ---------- pesquisas no último mês ----------

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const thousands = (n: number) => n.toLocaleString("pt-BR");

export function SearchVolumeView({ data }: { data: SearchVolumeResult }) {
  if (!data.weeks.length) {
    return <p className="small">Não há dados suficientes de pesquisa para “{data.keyword}” nesta região.</p>;
  }
  // Mais antiga à esquerda, como uma linha do tempo.
  const weeks = [...data.weeks].reverse();
  return (
    <>
      <div className="volume-month">
        {data.last30 && (
          <div>
            <span className="small">Últimos 30 dias (estimativa)</span>
            <b>{thousands(data.last30.volume)}</b>
            <span className="small">
              {shortDate(data.last30.from)} a {shortDate(data.last30.to)}
            </span>
          </div>
        )}
        {data.monthly && (
          <div>
            <span className="small">Último mês fechado (Google Ads)</span>
            <b>{thousands(data.monthly.volume)}</b>
            <span className="small">
              {MONTHS[data.monthly.month - 1]}/{data.monthly.year}
            </span>
          </div>
        )}
      </div>
      <h3 style={{ margin: "16px 0 8px" }}>Semana a semana</h3>
      <div className="volume-weeks">
        {weeks.map((w, i) => {
          const prev = weeks[i - 1];
          const change = prev && prev.volume ? Math.round(((w.volume - prev.volume) / prev.volume) * 100) : null;
          return (
            <div key={w.label} className="volume-week">
              <span className="small">{w.label}</span>
              <b>{thousands(w.volume)}</b>
              <span className="small">
                {shortDate(w.from)} a {shortDate(w.to)}
              </span>
              {change !== null && (
                <span className={change >= 0 ? "up" : "down"}>
                  {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs. semana anterior
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="small" style={{ marginTop: 10 }}>
        Estimativa de pesquisas por “{data.keyword}” em {data.locationLabel}
        {data.monthly ? ` (${thousands(data.monthly.volume)} pesquisas em ${MONTHS[data.monthly.month - 1]}/${data.monthly.year}, Google Ads)` : ""},
        distribuídas pela variação diária do Google Trends.
        {data.locationLevel !== "cidade" ? " A cidade não tem dados próprios no Google Ads; o número é do " + data.locationLevel + "." : ""}
      </p>
    </>
  );
}

// ---------- como chegar em 1º ----------

const STATUS_LABEL = { frente: "À frente", igual: "Igual", atras: "Atrás" } as const;

export function CompareView({ name, data }: { name: string; data: CompareResult }) {
  return (
    <div className="compare">
      <p className="sub">
        Comparação com quem está {data.alreadyFirst ? "logo atrás" : "na frente"} na busca “{data.keyword}”, com os mesmos dados
        públicos do Google para todos.
        {data.targetPosition ? ` Hoje: ${data.targetPosition}º lugar no ranking da região.` : ""}
      </p>
      <div className="plano">
        <h3>Plano de ação</h3>
        <ol>
          {data.plano.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
        <p className="small">A distância de quem busca até a empresa também pesa muito no Maps e não muda com o perfil.</p>
      </div>
      <div className="cmp-head">
        <strong>
          {data.competitor.position}º · {data.competitor.name}
        </strong>
        <span className="small">a {String(data.distanceKm).replace(".", ",")} km da sua empresa</span>
      </div>
      <table className="cmp-table">
        <thead>
          <tr>
            <th>Critério</th>
            <th>Sua empresa ({name})</th>
            <th>{data.competitor.name}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.criterio} className={r.status === "atras" ? "behind" : ""}>
              <td>{r.criterio}</td>
              <td>{r.voce}</td>
              <td>{r.concorrente}</td>
              <td className={`cmp-status ${r.status}`}>{STATUS_LABEL[r.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
