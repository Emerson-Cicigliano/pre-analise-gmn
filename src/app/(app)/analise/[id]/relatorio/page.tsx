"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CompareGrids,
  CompareView,
  SearchVolumeView,
  Gauge,
  GridSquares,
  GridSummary,
  HealthItem,
  LevelCounts,
  ManualItems,
  RegionTable,
  regionSentence,
  sortedChecklist,
} from "@/components/report";
import { dateBR, getJson, postJson } from "@/lib/fetcher";
import { useProfileActivity } from "@/lib/activity";
import { loadManual, manualPendingCount, manualView, type ManualState } from "@/lib/manual";
import { regionRanking } from "@/lib/region";
import type { AgencySettings, CompareResult, GeogridResult, PlaceAnalysis, SearchVolumeResult } from "@/lib/types";

/** Relatório enxuto para imprimir/salvar em PDF: saúde do perfil, ranking da região e como chegar em 1º. */
export default function RelatorioPage() {
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<PlaceAnalysis | null>(null);
  const [grid, setGrid] = useState<GeogridResult | null>(null);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [agency, setAgency] = useState("");
  const [manual, setManual] = useState<ManualState>({});
  const [error, setError] = useState<string | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [volume, setVolume] = useState<SearchVolumeResult | null>(null);
  const [volumeKw, setVolumeKw] = useState("");
  const [volumeError, setVolumeError] = useState<string | null>(null);
  const [loadingVolume, setLoadingVolume] = useState(false);
  const { activity } = useProfileActivity(id, !!a?.providers?.dataforseo);

  async function loadVolume(keyword: string) {
    if (!keyword.trim()) return;
    setLoadingVolume(true);
    setVolumeError(null);
    try {
      setVolume(await postJson<SearchVolumeResult>("/api/search-volume", { placeId: id, keyword }));
    } catch (e) {
      setVolume(null);
      setVolumeError(e instanceof Error ? e.message : "Falha ao buscar o volume de pesquisas");
    } finally {
      setLoadingVolume(false);
    }
  }

  useEffect(() => {
    setManual(loadManual(id));
    Promise.all([
      getJson<PlaceAnalysis>(`/api/place/${id}`),
      getJson<{ grid: GeogridResult | null }>(`/api/grid/${id}`),
      getJson<{ settings: AgencySettings }>("/api/settings"),
    ])
      .then(([analysis, g, s]) => {
        setA(analysis);
        setGrid(g.grid);
        setAgency(s.settings.agencyName);
        // Pesquisas da mesma palavra-chave da grade (ou da categoria do negócio).
        const kw = g.grid?.keyword ?? analysis.place.category ?? "";
        setVolumeKw(kw);
        loadVolume(kw);
        if (g.grid) {
          setLoadingCompare(true);
          postJson<CompareResult>("/api/compare", { placeId: id })
            .then(setCompare)
            .catch(() => setCompare(null))
            .finally(() => setLoadingCompare(false));
        }
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const rows = useMemo(() => (grid ? regionRanking(grid, id) : []), [grid, id]);

  if (error) return <div className="error">{error}</div>;
  if (!a) return <p className="small">Montando o relatório...</p>;

  const { place, score, checklist } = a;
  const now = new Date();
  const stamp = `${now.toLocaleDateString("pt-BR")}, ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  const mView = manualView(place, activity);
  const manualPending = manualPendingCount(manual, mView);

  const Header = ({ title }: { title: string }) => (
    <header className="rhead">
      <span>{title}</span>
      <span>{stamp}</span>
    </header>
  );

  return (
    <div className="report">
      <div className="row no-print" style={{ marginBottom: 18, alignItems: "center" }}>
        <Link className="btn btn-ghost" href={`/analise/${id}`}>
          ← Voltar
        </Link>
        <button onClick={() => window.print()}>Imprimir / salvar PDF</button>
        {loadingCompare && <span className="small">Montando a comparação com o 1º colocado...</span>}
        {!grid && <span className="small">Rode a grade de posição na análise para incluir o ranking da região.</span>}
      </div>

      <section className="rpage">
        <Header title="Análise de Saúde do Perfil da Empresa no Google" />
        <h1>Análise de Saúde da {place.name}</h1>
        <div className="health-head" style={{ margin: "18px 0 8px" }}>
          <Gauge score={score} />
          <LevelCounts checklist={checklist} manualPending={manualPending} />
        </div>
        {sortedChecklist(checklist).map((c) => (
          <HealthItem key={c.id} item={c} />
        ))}
        <ManualItems state={manual} view={mView} />
        <footer className="rfoot">{agency || "Pré-análise GMN"}</footer>
      </section>

      {grid && (
        <section className="rpage">
          <Header title="Análise de Saúde do Perfil da Empresa no Google" />
          <h2 className="rtitle">Ranking por região: “{grid.keyword}”</h2>
          <p>
            Grade {grid.size}×{grid.size} com {String(grid.spacingKm).replace(".", ",")} km entre pontos, centrada no endereço do
            negócio. Cada quadrado mostra a posição do perfil na busca do Google Maps feita daquele ponto.
            {grid.createdAt ? ` Rodado em ${dateBR(grid.createdAt)}.` : ""}
          </p>
          <div className="region-head">
            <GridSquares grid={grid} />
            <GridSummary grid={grid} />
          </div>
          <h2 className="rtitle" style={{ marginTop: 28 }}>
            Ranking da região
          </h2>
          <p>{regionSentence(place.name, rows)}</p>
          <RegionTable rows={rows} />
          {(grid.compared?.length ?? 0) > 0 && (
            <>
              <h2 className="rtitle" style={{ marginTop: 28 }}>
                Grade dos concorrentes selecionados
              </h2>
              <p>Mesma busca e mesmos pontos, para comparar a presença do cliente com a de cada concorrente.</p>
              <CompareGrids grid={grid} targetId={place.id} targetName={place.name} />
            </>
          )}
          <footer className="rfoot">{agency || "Pré-análise GMN"}</footer>
        </section>
      )}

      {compare && (
        <section className="rpage">
          <Header title="Como chegar em 1º no Google Maps" />
          <h1>
            Como {place.name} {compare.alreadyFirst ? "se mantém" : "chega"} em 1º
          </h1>
          <CompareView name={place.name} data={compare} />
          <footer className="rfoot">{agency || "Pré-análise GMN"}</footer>
        </section>
      )}

      <section className="rpage">
        <Header title="Pesquisas no Google" />
        <h2 className="rtitle">Pesquisas no último mês{volume ? `: “${volume.keyword}”` : ""}</h2>
        <p>Quantas vezes o serviço do negócio foi pesquisado no Google na região no último mês, e semana a semana.</p>
        <form
          className="row no-print"
          style={{ margin: "10px 0 16px" }}
          onSubmit={(e) => {
            e.preventDefault();
            loadVolume(volumeKw);
          }}
        >
          <label className="field grow">
            Palavra-chave pesquisada
            <input value={volumeKw} onChange={(e) => setVolumeKw(e.target.value)} placeholder="Ex.: padaria" />
          </label>
          <button disabled={loadingVolume || !volumeKw.trim()}>{loadingVolume ? "Buscando..." : "Atualizar"}</button>
        </form>
        {loadingVolume && <p className="small">Buscando o volume de pesquisas...</p>}
        {volumeError && <div className="error">{volumeError}</div>}
        {volume && !loadingVolume && <SearchVolumeView data={volume} />}
        <footer className="rfoot">{agency || "Pré-análise GMN"}</footer>
      </section>
    </div>
  );
}
