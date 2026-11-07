"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import LineChart from "@/components/LineChart";
import type { MapMarker } from "@/components/MapView";
import {
  CompareGrids,
  Gauge,
  HealthItem,
  LevelCounts,
  ManualItems,
  SearchVolumeView,
  sortedChecklist,
} from "@/components/report";
import { dateBR, getJson, postJson } from "@/lib/fetcher";
import { useProfileActivity } from "@/lib/activity";
import { loadManual, manualPendingCount, manualView, saveManual, type ManualState } from "@/lib/manual";
import type {
  CategoriesResult,
  CompetitorsResult,
  GeogridResult,
  HistoryGrid,
  HistorySnapshot,
  PlaceAnalysis,
  FullReview,
  PlaceDetails,
  SearchVolumeResult,
} from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type Picked = { id: string; name: string };
const MAX_COMPARE = 5;

// Marcadores do mapa na paleta da marca: a empresa em cinza escuro com borda dourada.
const COLORS = { target: "#3f3c38", top3: "#3d6b2f", mid: "#b7791f", low: "#9b2c20", none: "#6f685e", other: "#8a8276" };

function rankColor(rank: number | null) {
  if (rank === null) return COLORS.none;
  return rank <= 3 ? COLORS.top3 : rank <= 10 ? COLORS.mid : COLORS.low;
}

export default function AnalisePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PlaceAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorsResult | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [client, setClient] = useState(false);
  const [manual, setManual] = useState<ManualState>({});
  // Concorrentes marcados na lista para comparar na grade de posição.
  const [picked, setPicked] = useState<Picked[]>([]);
  // Postagens e respostas recentes: chegam alguns segundos depois da análise.
  const { activity, loading: activityLoading } = useProfileActivity(id, !!data?.providers?.dataforseo);

  function togglePicked(c: Picked) {
    setPicked((cur) =>
      cur.some((p) => p.id === c.id) ? cur.filter((p) => p.id !== c.id) : cur.length >= MAX_COMPARE ? cur : [...cur, c],
    );
  }

  useEffect(() => {
    setManual(loadManual(id));
    getJson<PlaceAnalysis>(`/api/place/${id}`)
      .then((d) => {
        setData(d);
        setClient(!!d.isClient);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  function toggleManual(itemId: string) {
    const next = { ...manual, [itemId]: !manual[itemId] };
    setManual(next);
    saveManual(id, next);
  }

  async function toggleClient() {
    try {
      if (client) {
        await fetch(`/api/clients?placeId=${encodeURIComponent(id)}`, { method: "DELETE" });
        setClient(false);
      } else {
        await postJson("/api/clients", { placeId: id });
        // Recarrega para gravar a primeira foto do histórico.
        await getJson(`/api/place/${id}`);
        setClient(true);
        setHistoryKey((k) => k + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha");
    }
  }

  if (error) return <div className="error">{error}</div>;
  if (!data) return <p className="small">Carregando análise...</p>;

  const { place, score, checklist } = data;
  const mView = manualView(place, activity);
  const manualPending = manualPendingCount(manual, mView);

  return (
    <>
      <p className="print-only small">Relatório gerado em {new Date().toLocaleDateString("pt-BR")}</p>

      <section className="card">
        {place.category && <span className="tag">{place.category}</span>}
        <h1 style={{ marginTop: 8 }}>{place.name}</h1>
        <p className="sub" style={{ margin: 0 }}>{place.address}</p>
        <p className="small" style={{ margin: "4px 0 0" }}>
          {place.rating !== null ? `★ ${place.rating.toFixed(1)} · ` : ""}
          {place.userRatingCount} avaliações
        </p>
        <div className="actions no-print">
          {place.mapsUri && (
            <a className="btn btn-ghost" href={place.mapsUri} target="_blank" rel="noreferrer">
              Ver no Google Maps
            </a>
          )}
          <button onClick={toggleClient} className={client ? "btn-ghost" : ""}>
            {client ? "✓ Cliente" : "Adicionar aos clientes"}
          </button>
          <Link className="btn btn-ghost" href={`/analise/${place.id}/avaliacoes`}>
            Avaliações
          </Link>
          <Link className="btn btn-ghost" href={`/analise/${place.id}/card`}>
            Card de avaliação
          </Link>
          <Link className="btn btn-ghost" href={`/analise/${place.id}/proposta`}>
            Proposta
          </Link>
          <Link className="btn btn-ghost" href={`/analise/${place.id}/relatorio`}>
            Relatório PDF
          </Link>
        </div>
      </section>

      <section className="card">
        <h2>Análise de Saúde</h2>
        <div className="health-head">
          <Gauge score={score} />
          <LevelCounts checklist={checklist} manualPending={manualPending} />
        </div>
      </section>

      <section className="card">
        {sortedChecklist(checklist).map((c) => (
          <HealthItem key={c.id} item={c} />
        ))}
        {activityLoading && (
          <p className="small" style={{ marginTop: 12 }}>
            Verificando postagens e respostas recentes do perfil...
          </p>
        )}
        <ManualItems state={manual} view={mView} onToggle={toggleManual} />
      </section>

      <Competitors place={place} onResult={setCompetitors} picked={picked} onToggle={togglePicked} />
      <Geogrid place={place} competitors={competitors} picked={picked} onDone={() => setHistoryKey((k) => k + 1)} />
      <SearchVolume place={place} />
      <Categories place={place} />
      <History placeId={place.id} refreshKey={historyKey} isClient={client} />
      <Reviews place={place} recent={activity?.reviews?.recent ?? null} loading={activityLoading} />
    </>
  );
}

function SearchVolume({ place }: { place: PlaceDetails }) {
  const [keyword, setKeyword] = useState(place.category ?? "");
  const [result, setResult] = useState<SearchVolumeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setResult(await postJson<SearchVolumeResult>("/api/search-volume", { placeId: place.id, keyword }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Pesquisas no último mês</h2>
      <p className="sub">Quantas vezes o serviço do negócio foi pesquisado no Google na cidade no último mês, e semana a semana.</p>
      <form className="row no-print" onSubmit={run}>
        <label className="field grow">
          Palavra-chave
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Ex.: padaria" />
        </label>
        <button disabled={loading || !keyword.trim()}>{loading ? "Buscando..." : "Ver pesquisas"}</button>
      </form>
      {error && <div className="error">{error}</div>}
      {result && (
        <div style={{ marginTop: 16 }}>
          <SearchVolumeView data={result} />
        </div>
      )}
    </section>
  );
}

function Categories({ place }: { place: PlaceDetails }) {
  const [keyword, setKeyword] = useState(place.category ?? "");
  const [result, setResult] = useState<CategoriesResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setResult(await postJson<CategoriesResult>("/api/categories", { placeId: place.id, keyword }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setLoading(false);
    }
  }

  const missing = result?.categories.filter((c) => !c.youHave && c.total >= 2) ?? [];
  const max = result?.categories[0]?.total ?? 1;

  return (
    <section className="card">
      <h2>Análise de categorias</h2>
      <p className="sub">Quais categorias os concorrentes que aparecem para a palavra-chave usam, e quais faltam no perfil.</p>
      <form className="row no-print" onSubmit={run}>
        <label className="field grow">
          Palavra-chave
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Ex.: dentista" />
        </label>
        <button disabled={loading || !keyword.trim()}>{loading ? "Analisando..." : "Analisar categorias"}</button>
      </form>
      {error && <div className="error">{error}</div>}
      {result && (
        <>
          {result.source === "places" && (
            <p className="notice">
              Sem a DataForSEO só dá para ver a categoria principal de cada concorrente. Configure a DataForSEO para ver
              também as categorias secundárias.
            </p>
          )}
          <p className="small" style={{ marginTop: 12 }}>
            Perfil analisado: <strong>{result.target.primary ?? "sem categoria"}</strong>
            {result.target.additional.length > 0 && <> + {result.target.additional.join(", ")}</>} · {result.analyzed} concorrentes
          </p>
          {missing.length > 0 && (
            <p className="small">
              💡 Candidatas a categoria secundária: <strong>{missing.slice(0, 5).map((c) => c.name).join(", ")}</strong>
            </p>
          )}
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th className="num">Principal</th>
                <th className="num">Secundária</th>
                <th style={{ width: "30%" }}>Uso</th>
                <th>No perfil</th>
              </tr>
            </thead>
            <tbody>
              {result.categories.slice(0, 15).map((c) => (
                <tr key={c.name} className={c.youHave ? "me" : ""}>
                  <td>{c.name}</td>
                  <td className="num">{c.primary}</td>
                  <td className="num">{c.additional}</td>
                  <td>
                    <div className="bar-track">
                      <div className="bar" style={{ width: `${(c.total / max) * 100}%` }} />
                    </div>
                  </td>
                  <td>{c.youHave ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.topics.length > 0 && (
            <>
              <h3 style={{ marginTop: 16 }}>Temas citados nas avaliações do perfil</h3>
              <p className="small">
                {result.topics.map((t) => `${t.topic} (${t.count})`).join(" · ")}
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}

function History({ placeId, refreshKey, isClient }: { placeId: string; refreshKey: number; isClient: boolean }) {
  const [data, setData] = useState<{ snapshots: HistorySnapshot[]; grids: HistoryGrid[] } | null>(null);

  useEffect(() => {
    getJson<{ snapshots: HistorySnapshot[]; grids: HistoryGrid[] }>(`/api/history/${placeId}`)
      .then(setData)
      .catch(() => setData(null));
  }, [placeId, refreshKey]);

  if (!data) return null;
  const { snapshots, grids } = data;
  if (!snapshots.length && !grids.length && !isClient) return null;

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const delta = first && last ? last.score - first.score : 0;
  // Evolução da grade só faz sentido comparando a mesma palavra-chave.
  const lastKeyword = grids[grids.length - 1]?.keyword;
  const sameKw = grids.filter((g) => g.keyword === lastKeyword);

  return (
    <section className="card">
      <h2>Evolução</h2>
      <p className="sub">
        {isClient
          ? "A nota é registrada automaticamente cada vez que a análise é aberta (uma vez por dia)."
          : "Adicione aos clientes para registrar a nota automaticamente."}
      </p>
      {snapshots.length > 0 && (
        <>
          <div className="stats">
            <div className="stat">
              <b>{last.score}</b>
              <span>nota atual</span>
            </div>
            <div className="stat">
              <b className={delta > 0 ? "up" : delta < 0 ? "down" : ""}>
                {delta > 0 ? "+" : ""}
                {delta}
              </b>
              <span>desde {dateBR(first.createdAt)}</span>
            </div>
            <div className="stat">
              <b>
                {last.reviews}
                {last.reviews - first.reviews > 0 && <span className="up"> +{last.reviews - first.reviews}</span>}
              </b>
              <span>avaliações</span>
            </div>
          </div>
          {snapshots.length > 1 && (
            <LineChart points={snapshots.map((s) => ({ label: dateBR(s.createdAt).slice(0, 5), value: s.score }))} min={0} max={100} />
          )}
        </>
      )}
      {sameKw.length > 0 && (
        <>
          <h3 style={{ marginTop: 16 }}>Grade para “{lastKeyword}”</h3>
          {sameKw.length > 1 && (
            <LineChart
              points={sameKw.map((g) => ({ label: dateBR(g.createdAt).slice(0, 5), value: g.avgRankOverall }))}
              min={1}
              max={21}
              invert
              color="var(--ok)"
              format={(v) => `${v}º`}
            />
          )}
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Palavra-chave</th>
                <th>Grade</th>
                <th className="num">Posição média</th>
                <th className="num">Top 3</th>
              </tr>
            </thead>
            <tbody>
              {[...grids].reverse().slice(0, 10).map((g) => (
                <tr key={g.id}>
                  <td>{dateBR(g.createdAt)}</td>
                  <td>{g.keyword}</td>
                  <td>
                    {g.size}×{g.size} · {g.spacingKm} km {g.provider === "places" && <span className="badge">aprox.</span>}
                  </td>
                  <td className="num">{g.avgRankOverall}</td>
                  <td className="num">{g.top3Share}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function Competitors({
  place,
  onResult,
  picked,
  onToggle,
}: {
  place: PlaceDetails;
  onResult: (r: CompetitorsResult) => void;
  picked: Picked[];
  onToggle: (c: Picked) => void;
}) {
  const [keyword, setKeyword] = useState(place.category ?? "");
  const [radiusKm, setRadiusKm] = useState(5);
  const [result, setResult] = useState<CompetitorsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await postJson<CompetitorsResult>("/api/competitors", { placeId: place.id, keyword, radiusKm });
      setResult(r);
      onResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setLoading(false);
    }
  }

  const markers = useMemo<MapMarker[]>(
    () =>
      (result?.competitors ?? []).map((c) => ({
        lat: c.location.latitude,
        lng: c.location.longitude,
        label: c.isTarget ? "★" : String(c.reviewRank),
        color: c.isTarget ? COLORS.target : c.reviewRank <= 3 ? COLORS.top3 : COLORS.other,
        title: `${c.reviewRank}º ${c.name} — ${c.userRatingCount} avaliações${c.rating ? `, ★ ${c.rating.toFixed(1)}` : ""}`,
        target: c.isTarget,
      })),
    [result],
  );

  const me = result?.competitors.find((c) => c.isTarget);
  const third = result?.competitors.filter((c) => !c.isTarget)[2];
  const gapTop3 = me && third && me.reviewRank > 3 ? third.userRatingCount - me.userRatingCount + 1 : 0;

  return (
    <section className="card">
      <h2>Ranking de concorrentes por avaliações</h2>
      <p className="sub">Empresas que o Google retorna para a palavra-chave na região, ordenadas pelo volume de avaliações.</p>
      <form className="row no-print" onSubmit={run}>
        <label className="field grow">
          Palavra-chave
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Ex.: dentista" />
        </label>
        <label className="field">
          Raio
          <select value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}>
            {[1, 2, 5, 10, 20].map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>
        </label>
        <button disabled={loading || !keyword.trim()}>{loading ? "Buscando..." : "Comparar"}</button>
      </form>
      {error && <div className="error">{error}</div>}

      {result && me && (
        <>
          <p className="print-only small">
            Palavra-chave: “{result.keyword}” · raio de {result.radiusKm} km
          </p>
          <div className="stats">
            <div className="stat">
              <b>{me.reviewRank}º</b>
              <span>de {result.competitors.length} em avaliações</span>
            </div>
            <div className="stat">
              <b>{result.avgReviews}</b>
              <span>média de avaliações dos concorrentes (você: {me.userRatingCount})</span>
            </div>
            <div className="stat">
              <b>{result.avgRating ? `★ ${result.avgRating.toFixed(2)}` : "—"}</b>
              <span>nota média dos concorrentes (você: {me.rating?.toFixed(1) ?? "—"})</span>
            </div>
            <div className="stat">
              <b>{gapTop3 > 0 ? `+${gapTop3}` : "✓"}</b>
              <span>{gapTop3 > 0 ? "avaliações para entrar no top 3" : "já está no top 3"}</span>
            </div>
          </div>
          {!result.targetFound && (
            <p className="small">
              ⚠️ A empresa não apareceu entre os 20 resultados do Google para essa palavra-chave e foi incluída só para
              comparação.
            </p>
          )}
          <MapView center={place.location} markers={markers} />
          <p className="small no-print" style={{ marginBottom: 6 }}>
            Marque até {MAX_COMPARE} concorrentes para ver a grade de posição deles junto com a do cliente
            {picked.length ? ` (${picked.length} marcado${picked.length > 1 ? "s" : ""})` : ""}.
          </p>
          <table>
            <thead>
              <tr>
                <th className="no-print" aria-label="Comparar" />
                <th>#</th>
                <th>Empresa</th>
                <th className="num">Avaliações</th>
                <th className="num">Nota</th>
              </tr>
            </thead>
            <tbody>
              {result.competitors
                // Todos, do 1º até a posição da empresa analisada (no mínimo os 10 primeiros).
                .filter((c) => c.reviewRank <= Math.max(10, me.reviewRank))
                .map((c) => (
                  <tr key={c.id} className={c.isTarget ? "me" : ""}>
                    <td className="no-print" style={{ width: 32 }}>
                      {!c.isTarget && (
                        <input
                          type="checkbox"
                          className="pick"
                          aria-label={`Comparar ${c.name} na grade`}
                          checked={picked.some((p) => p.id === c.id)}
                          disabled={!picked.some((p) => p.id === c.id) && picked.length >= MAX_COMPARE}
                          onChange={() => onToggle({ id: c.id, name: c.name })}
                        />
                      )}
                    </td>
                    <td>{c.reviewRank}</td>
                    <td>
                      {c.mapsUri ? (
                        <a href={c.mapsUri} target="_blank" rel="noreferrer">
                          {c.name}
                        </a>
                      ) : (
                        c.name
                      )}
                    </td>
                    <td className="num">{c.userRatingCount}</td>
                    <td className="num">{c.rating?.toFixed(1) ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function Geogrid({
  place,
  competitors,
  picked,
  onDone,
}: {
  place: PlaceDetails;
  competitors: CompetitorsResult | null;
  picked: Picked[];
  onDone: () => void;
}) {
  const [keyword, setKeyword] = useState(place.category ?? "");
  const [size, setSize] = useState(5);
  const [spacingKm, setSpacingKm] = useState(1);
  const [result, setResult] = useState<GeogridResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setResult(
        await postJson<GeogridResult>("/api/geogrid", { placeId: place.id, keyword, size, spacingKm, compareWith: picked }),
      );
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setLoading(false);
    }
  }

  // O ponto central da grade é o próprio endereço da empresa.
  const markers = useMemo<MapMarker[]>(
    () =>
      (result?.points ?? []).map((p) => ({
        lat: p.lat,
        lng: p.lng,
        label: p.rank === null ? "20+" : String(p.rank),
        color: rankColor(p.rank),
        title: p.rank === null ? "Fora dos 20 primeiros" : `${p.rank}ª posição neste ponto`,
      })),
    [result],
  );

  // Quem mais aparece em 1º lugar na grade (nomes vêm da busca de concorrentes, quando disponível).
  const leaders = useMemo(() => {
    if (!result) return [];
    const names = new Map((competitors?.competitors ?? []).map((c) => [c.id, c.name]));
    // Com DataForSEO cada ponto já traz os nomes dos primeiros colocados.
    for (const p of result.points) p.topNames?.forEach((n, i) => names.set(p.topIds[i], n));
    names.set(place.id, place.name);
    const counts = new Map<string, number>();
    for (const p of result.points) if (p.topIds[0]) counts.set(p.topIds[0], (counts.get(p.topIds[0]) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, n]) => ({ id, n, name: names.get(id) ?? "Concorrente fora da lista (rode a comparação com a mesma palavra-chave)" }));
  }, [result, competitors, place]);

  return (
    <section className="card">
      <h2>Grade de posição no mapa</h2>
      <p className="sub">
        Simula a mesma busca feita de vários pontos ao redor da empresa e mostra em que posição ela aparece em cada um.
      </p>
      <form className="row no-print" onSubmit={run}>
        <label className="field grow">
          Palavra-chave
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Ex.: dentista perto de mim" />
        </label>
        <label className="field">
          Grade
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {[3, 5, 7, 9].map((s) => (
              <option key={s} value={s}>
                {s}×{s} ({s * s} pontos)
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Distância entre pontos
          <select value={spacingKm} onChange={(e) => setSpacingKm(Number(e.target.value))}>
            {[0.5, 1, 2, 3, 5].map((s) => (
              <option key={s} value={s}>
                {s} km
              </option>
            ))}
          </select>
        </label>
        <button disabled={loading || !keyword.trim()}>{loading ? `Consultando ${size * size} pontos...` : "Rodar grade"}</button>
      </form>
      {error && <div className="error">{error}</div>}

      {result && (
        <>
          <p className="print-only small">
            Palavra-chave: “{result.keyword}” · grade {result.size}×{result.size} · {result.spacingKm} km entre pontos
          </p>
          <div className="stats">
            <div className="stat">
              <b>{result.avgRankFound ?? "—"}</b>
              <span>posição média onde aparece</span>
            </div>
            <div className="stat">
              <b>{result.avgRankOverall}</b>
              <span>posição média geral (ausente = 21)</span>
            </div>
            <div className="stat">
              <b>{result.top3Share}%</b>
              <span>dos pontos no top 3</span>
            </div>
            <div className="stat">
              <b>{result.foundShare}%</b>
              <span>dos pontos no top 20</span>
            </div>
          </div>
          <MapView center={place.location} markers={markers} height={440} />
          <div className="legend">
            <span><i style={{ background: COLORS.top3 }} />1–3</span>
            <span><i style={{ background: COLORS.mid }} />4–10</span>
            <span><i style={{ background: COLORS.low }} />11–20</span>
            <span><i style={{ background: COLORS.none }} />fora do top 20</span>
            <span>ponto central = endereço da empresa</span>
          </div>
          {(picked.length > 0 || (result.compared?.length ?? 0) > 0) && (
            <>
              <h3 style={{ marginTop: 16 }}>Grade dos concorrentes selecionados</h3>
              <p className="small">
                Mesma busca e mesmos pontos: a posição de cada concorrente sai das mesmas consultas, sem custo extra.
              </p>
              <CompareGrids
                grid={{ ...result, compared: picked.length ? picked : result.compared }}
                targetId={place.id}
                targetName={place.name}
              />
            </>
          )}
          {leaders.length > 0 && (
            <>
              <h3 style={{ marginTop: 16 }}>Quem lidera a grade (1º lugar)</h3>
              <table>
                <tbody>
                  {leaders.map((l) => (
                    <tr key={l.id} className={l.id === place.id ? "me" : ""}>
                      <td>{l.name}</td>
                      <td className="num">
                        {l.n} de {result.points.length} pontos
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <p className="small" style={{ marginTop: 12 }}>
            {result.provider === "dataforseo"
              ? "Fonte: resultados reais do Google Maps em cada coordenada (DataForSEO, celular)."
              : "Fonte: Places API (aproximação). A API ordena os resultados por relevância em torno de cada ponto; o Google Maps real também considera histórico e dispositivo de quem busca. Configure a DataForSEO para o ranking real."}
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Com a DataForSEO, mostra as 5 avaliações mais novas (mesma fonte da aba Avaliações).
 * Sem ela, cai nas 5 da Places API, que vêm na ordem de relevância do Google e não por data.
 */
function Reviews({ place, recent, loading }: { place: PlaceDetails; recent: FullReview[] | null; loading: boolean }) {
  const list: FullReview[] = recent?.length ? recent : place.reviews;
  if (!list.length) return null;
  const isRecent = !!recent?.length;
  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>{isRecent ? "Avaliações mais recentes" : "Avaliações em destaque"}</h2>
        <Link className="btn btn-sm btn-ghost no-print" href={`/analise/${place.id}/avaliacoes`}>
          Ver todas
        </Link>
      </div>
      <p className="sub">
        {isRecent
          ? "As 5 mais novas no Google, com a resposta do dono quando houver."
          : loading
            ? "Buscando as mais recentes... Enquanto isso, as que o Google mostra por relevância (não são as mais novas)."
            : "As que o Google mostra por relevância (até 5), não necessariamente as mais novas."}
      </p>
      <div className="reviews">
        {list.map((r, i) => (
          <div className="review" key={i}>
            <strong>{"★".repeat(Math.round(r.rating))}</strong>{" "}
            <span className="small">
              {r.author} · {r.relativeTime ?? (r.publishTime ? dateBR(r.publishTime) : "")}
            </span>
            {isRecent && (
              <span className={`badge ${r.ownerAnswer ? "ok" : "warn"}`} style={{ marginLeft: 8 }}>
                {r.ownerAnswer ? "respondida" : "sem resposta"}
              </span>
            )}
            {r.text && <div>{r.text.length > 280 ? `${r.text.slice(0, 280)}…` : r.text}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
