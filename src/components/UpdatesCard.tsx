"use client";

import { useState } from "react";
import { APP_VERSION, compareVersions, fetchLatestRelease, UPDATE_REPO, type LatestRelease } from "@/lib/updates";

/** Quadro de Configurações: versão instalada, botão "Buscar atualizações" e o que mudou na versão nova. */
export default function UpdatesCard() {
  const [latest, setLatest] = useState<LatestRelease | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setChecking(true);
    setError(null);
    try {
      setLatest(await fetchLatestRelease());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao buscar atualizações");
    } finally {
      setChecking(false);
    }
  }

  const hasUpdate = latest && compareVersions(latest.version, APP_VERSION) > 0;

  return (
    <section className="card" id="atualizacoes">
      <h2>Atualizações</h2>
      <div className="row" style={{ alignItems: "center" }}>
        <span>
          Versão instalada: <strong>v{APP_VERSION}</strong>
        </span>
        <button type="button" className="btn-ghost btn-sm" onClick={check} disabled={checking}>
          {checking ? "Buscando..." : "Buscar atualizações"}
        </button>
      </div>
      {error && <div className="error">{error}</div>}

      {latest && !hasUpdate && (
        <p className="small" style={{ marginBottom: 0 }}>
          ✓ Você está na versão mais recente ({latest.version}).
        </p>
      )}

      {latest && hasUpdate && (
        <div style={{ marginTop: 12 }}>
          <p className="notice" style={{ marginTop: 0 }}>
            🔔 Nova versão <strong>{latest.version}</strong> disponível, publicada em{" "}
            {new Date(latest.publishedAt).toLocaleDateString("pt-BR")}.
          </p>
          <h3>{latest.name}</h3>
          <div className="small" style={{ whiteSpace: "pre-wrap", color: "var(--ink)" }}>
            {latest.notes.replace(/\*\*/g, "")}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <a className="btn btn-sm" href={latest.url} target="_blank" rel="noreferrer">
              Baixar a versão nova ↗
            </a>
          </div>
          <p className="small" style={{ marginBottom: 0 }}>
            <strong>Como atualizar:</strong> baixe o ZIP da versão nova, copie os arquivos <code>wrangler.jsonc</code> e{" "}
            <code>.env.local</code> da pasta antiga para a nova e rode <code>npm install</code> e <code>npm run deploy</code>.
            Quem usa Git: <code>git pull</code> e <code>npm run deploy</code>. Seus clientes e dados não são apagados.
          </p>
        </div>
      )}

      <p className="small" style={{ marginBottom: 0 }}>
        O portal confere sozinho uma vez por dia e avisa no topo quando sai uma versão nova. Nada é instalado sem você.
        Versões publicadas em{" "}
        <a href={`https://github.com/${UPDATE_REPO}/releases`} target="_blank" rel="noreferrer">
          github.com/{UPDATE_REPO}
        </a>
        .
      </p>
    </section>
  );
}
