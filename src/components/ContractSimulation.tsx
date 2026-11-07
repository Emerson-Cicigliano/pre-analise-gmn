"use client";

import { useState } from "react";
import { brl } from "@/lib/fetcher";

/**
 * Simulação de contrato: total = fixo + recorrente × meses; parcela = total ÷ meses (parcelas iguais).
 * Mostra o que o cliente paga por mês em cada tempo de contrato, sem o susto do valor inicial.
 */
export default function ContractSimulation({
  fixedTotal,
  recurringTotal,
  terms,
  onTermsChange,
}: {
  fixedTotal: number;
  recurringTotal: number;
  terms: number[];
  /** Quando informado, os tempos de contrato podem ser adicionados, alterados e removidos. */
  onTermsChange?: (terms: number[]) => void;
}) {
  const [newTerm, setNewTerm] = useState("");
  const sorted = [...terms].sort((a, b) => a - b);

  function addTerm() {
    const n = Math.round(Number(newTerm));
    if (!onTermsChange || !(n >= 1 && n <= 60) || terms.includes(n)) return;
    onTermsChange([...terms, n].sort((a, b) => a - b));
    setNewTerm("");
  }

  return (
    <div className="simulation">
      <div className="sim-totals">
        <div>
          <span className="small">Total fixo (pago uma vez)</span>
          <b>{brl(fixedTotal)}</b>
        </div>
        <div>
          <span className="small">Total recorrente (por mês)</span>
          <b>{brl(recurringTotal)}</b>
        </div>
      </div>

      {onTermsChange && (
        <div className="row no-print" style={{ alignItems: "end", margin: "14px 0 6px" }}>
          <span className="small" style={{ alignSelf: "center" }}>
            Tempos de contrato:
          </span>
          {sorted.map((t) => (
            <span key={t} className="term-chip">
              {t} {t === 1 ? "mês" : "meses"}
              <button type="button" aria-label={`Remover ${t} meses`} onClick={() => onTermsChange(terms.filter((x) => x !== t))}>
                ×
              </button>
            </span>
          ))}
          <label className="field" style={{ width: 120 }}>
            Meses
            <input
              type="number"
              min={1}
              max={60}
              value={newTerm}
              placeholder="ex.: 10"
              onChange={(e) => setNewTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTerm();
                }
              }}
            />
          </label>
          <button type="button" className="btn-ghost btn-sm" onClick={addTerm}>
            + Adicionar tempo de contrato
          </button>
        </div>
      )}

      {sorted.length > 0 && (
        <table className="sim-table">
          <thead>
            <tr>
              <th>Contrato</th>
              <th className="num">Fixo</th>
              <th className="num">Recorrente × meses</th>
              <th className="num">Total do contrato</th>
              <th className="num">Parcela mensal</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const total = fixedTotal + recurringTotal * t;
              return (
                <tr key={t}>
                  <td>
                    {t} {t === 1 ? "mês" : "meses"}
                  </td>
                  <td className="num">{brl(fixedTotal)}</td>
                  <td className="num">
                    {brl(recurringTotal)} × {t} = {brl(recurringTotal * t)}
                  </td>
                  <td className="num">{brl(total)}</td>
                  <td className="num">
                    <strong>
                      {t}× {brl(total / t)}
                    </strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
