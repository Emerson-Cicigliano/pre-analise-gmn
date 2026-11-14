"use client";

import { useEffect, useState } from "react";
import UpdatesCard from "@/components/UpdatesCard";
import { getJson, postJson } from "@/lib/fetcher";
import type { AgencySettings } from "@/lib/types";

type Status = { places: boolean; dataforseo: boolean; claude: boolean };

const INTEGRATIONS: { key: keyof Status; name: string; env: string; what: string }[] = [
  { key: "places", name: "Google Places API", env: "GOOGLE_PLACES_API_KEY", what: "Busca, ficha, concorrentes e grade aproximada." },
  {
    key: "dataforseo",
    name: "DataForSEO",
    env: "DATAFORSEO_LOGIN e DATAFORSEO_PASSWORD",
    what: "Ranking real do Maps na grade, todas as avaliações com respostas e categorias secundárias.",
  },
  { key: "claude", name: "Claude (IA)", env: "ANTHROPIC_API_KEY", what: "Análise das avaliações e respostas sugeridas." },
];

export default function ConfiguracoesPage() {
  const [s, setS] = useState<AgencySettings | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ settings: AgencySettings; providers: Status }>("/api/settings")
      .then((d) => {
        setS(d.settings);
        setStatus(d.providers);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    setMsg(null);
    setError(null);
    try {
      const d = await postJson<{ settings: AgencySettings }>("/api/settings", s, "PUT");
      setS(d.settings);
      setMsg("Configurações salvas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar");
    }
  }

  if (error && !s) return <div className="error">{error}</div>;
  if (!s || !status) return <p className="small">Carregando...</p>;

  const set = <K extends keyof AgencySettings>(k: K, v: AgencySettings[K]) => setS({ ...s, [k]: v });

  return (
    <>
      <h1>Configurações</h1>
      <p className="sub">Dados da agência usados na proposta, nas respostas e nos cards.</p>

      <UpdatesCard />

      <section className="card">
        <h2>Integrações</h2>
        <p className="sub">As chaves ficam no arquivo .env.local da pasta do projeto. Depois de alterar, reinicie o servidor.</p>
        {INTEGRATIONS.map((i) => (
          <div className="check" key={i.key} style={{ gridTemplateColumns: "110px 1fr" }}>
            <span className={`pill ${status[i.key] ? "ok" : "falta"}`}>{status[i.key] ? "Configurada" : "Não configurada"}</span>
            <div>
              <strong>{i.name}</strong>
              <div className="small">{i.what}</div>
              {!status[i.key] && <div className="tip">Variável: {i.env}</div>}
            </div>
          </div>
        ))}
      </section>

      <form onSubmit={save}>
        <section className="card">
          <h2>Agência</h2>
          <div className="grid2" style={{ marginTop: 12 }}>
            <label className="field">
              Nome da agência
              <input value={s.agencyName} onChange={(e) => set("agencyName", e.target.value)} />
            </label>
            <label className="field">
              Responsável
              <input value={s.responsible} onChange={(e) => set("responsible", e.target.value)} />
            </label>
            <label className="field">
              Telefone / WhatsApp
              <input value={s.phone} onChange={(e) => set("phone", e.target.value)} />
            </label>
            <label className="field">
              E-mail
              <input value={s.email} onChange={(e) => set("email", e.target.value)} />
            </label>
            <label className="field">
              Site
              <input value={s.website} onChange={(e) => set("website", e.target.value)} />
            </label>
            <label className="field">
              Tom das respostas às avaliações
              <input value={s.replyTone} onChange={(e) => set("replyTone", e.target.value)} />
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Serviços da proposta</h2>
          <p className="sub" style={{ margin: 0 }}>
            Os serviços (fixos e recorrentes), os tempos de contrato e as observações agora ficam na página{" "}
            <strong>Proposta</strong> de cada análise: abra uma análise, clique em <strong>Proposta</strong>, ajuste e use
            “Salvar como padrão”.
          </p>
        </section>

        <div className="row">
          <button>Salvar</button>
          {msg && <span className="small">{msg}</span>}
        </div>
        {error && <div className="error">{error}</div>}
      </form>
    </>
  );
}
