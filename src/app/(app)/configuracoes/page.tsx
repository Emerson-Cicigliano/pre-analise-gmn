"use client";

import { useEffect, useState } from "react";
import ContractSimulation from "@/components/ContractSimulation";
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
  const setService = (i: number, patch: Partial<AgencySettings["services"][number]>) =>
    set(
      "services",
      s.services.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    );

  return (
    <>
      <h1>Configurações</h1>
      <p className="sub">Dados da agência usados na proposta, nas respostas e nos cards.</p>

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
          <p className="sub">Aparecem pré-selecionados na proposta; lá dá para ajustar cada caso.</p>

          {(["fixo", "recorrente"] as const).map((type) => (
            <div key={type} className="service-group">
              <h3>{type === "fixo" ? "Fixo (pago uma vez)" : "Recorrente (mensalidade)"}</h3>
              <p className="small" style={{ marginTop: -4 }}>
                {type === "fixo"
                  ? "Serviços cobrados uma única vez, como construção de site ou otimização inicial do perfil."
                  : "Serviços cobrados todo mês, como gestão do perfil e postagens."}
              </p>
              {s.services.map((sv, i) =>
                sv.type !== type ? null : (
                  <div key={i} className="row" style={{ marginBottom: 12, alignItems: "start" }}>
                    <label className="field" style={{ flex: 1, minWidth: 180 }}>
                      Serviço
                      <input value={sv.name} onChange={(e) => setService(i, { name: e.target.value })} />
                    </label>
                    <label className="field" style={{ flex: 2, minWidth: 220 }}>
                      Descrição
                      <input value={sv.description} onChange={(e) => setService(i, { description: e.target.value })} />
                    </label>
                    <label className="field" style={{ width: 140 }}>
                      {type === "fixo" ? "Valor (R$)" : "Valor/mês (R$)"}
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={sv.price}
                        onChange={(e) => setService(i, { price: Number(e.target.value) })}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-sm btn-danger"
                      style={{ marginTop: 22 }}
                      onClick={() => set("services", s.services.filter((_, j) => j !== i))}
                    >
                      Remover
                    </button>
                  </div>
                ),
              )}
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => set("services", [...s.services, { name: "", description: "", price: 0, type }])}
              >
                + Adicionar serviço {type === "fixo" ? "fixo" : "recorrente"}
              </button>
            </div>
          ))}

          <h3 style={{ marginTop: 22 }}>Simulação de contrato</h3>
          <p className="small" style={{ marginTop: -4 }}>
            Total do contrato = fixo + recorrente × meses. A parcela divide esse total igualmente pelos meses do contrato.
          </p>
          <ContractSimulation
            fixedTotal={s.services.filter((x) => x.type === "fixo").reduce((t, x) => t + x.price, 0)}
            recurringTotal={s.services.filter((x) => x.type === "recorrente").reduce((t, x) => t + x.price, 0)}
            terms={s.contractTerms}
            onTermsChange={(terms) => set("contractTerms", terms)}
          />

          <label className="field" style={{ marginTop: 16 }}>
            Observações da proposta
            <textarea rows={3} value={s.proposalNotes} onChange={(e) => set("proposalNotes", e.target.value)} />
          </label>
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
