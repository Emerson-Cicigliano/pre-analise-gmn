"use client";

import { useEffect, useState } from "react";
import { dismissUpdate, pendingUpdate, type LatestRelease } from "@/lib/updates";

/** Faixa no topo avisando que saiu uma versão nova do portal no GitHub. */
export default function UpdateBanner() {
  const [update, setUpdate] = useState<LatestRelease | null>(null);

  useEffect(() => {
    pendingUpdate()
      .then(setUpdate)
      .catch(() => {
        /* sem internet ou GitHub fora do ar: sem aviso */
      });
  }, []);

  if (!update) return null;
  return (
    <div className="update-banner no-print" role="status">
      <span>
        🔔 Nova versão <strong>{update.version}</strong> disponível.
      </span>
      <a href="/configuracoes#atualizacoes">Ver o que mudou</a>
      <button
        type="button"
        aria-label="Dispensar aviso"
        onClick={() => {
          dismissUpdate(update.version);
          setUpdate(null);
        }}
      >
        ×
      </button>
    </div>
  );
}
