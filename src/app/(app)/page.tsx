"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlaceSummary } from "@/lib/types";

export default function Home() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlaceSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ao voltar para a busca, mostra de novo o último termo e os resultados (vale enquanto a aba estiver aberta).
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("busca") ?? "null") as { q: string; results: PlaceSummary[] } | null;
      if (saved) {
        setQ(saved.q);
        setResults(saved.results);
      }
    } catch {
      /* sem histórico de busca */
    }
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.results);
      try {
        sessionStorage.setItem("busca", JSON.stringify({ q, results: data.results }));
      } catch {
        /* armazenamento indisponível */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na busca");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1>Pré-análise de Perfil da Empresa no Google</h1>
      <p className="sub">
        Encontre a empresa, veja a nota de saúde da ficha, compare com concorrentes e meça a posição no mapa por
        palavra-chave.
      </p>

      <form className="card row" onSubmit={search}>
        <label className="field grow">
          Nome da empresa + cidade
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex.: Padaria Pão Dourado Campinas"
            autoFocus
          />
        </label>
        <button disabled={loading || q.trim().length < 3}>{loading ? "Buscando..." : "Buscar"}</button>
      </form>

      {error && <div className="error">{error}</div>}

      {results && (
        <div className="results">
          {results.length === 0 && <p className="small">Nenhuma empresa encontrada. Tente incluir a cidade.</p>}
          {results.map((r) => (
            <Link key={r.id} href={`/analise/${r.id}`} className="result">
              <strong>{r.name}</strong>
              <span className="small">
                {r.category ? `${r.category} · ` : ""}
                {r.rating !== null ? `★ ${r.rating.toFixed(1)} (${r.userRatingCount}) · ` : "Sem avaliações · "}
                {r.address}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
