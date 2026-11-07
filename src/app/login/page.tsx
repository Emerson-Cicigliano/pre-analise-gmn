"use client";

import { useState } from "react";
import BrandMark from "@/components/BrandMark";

export default function LoginPage() {
  const [senha, setSenha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível entrar");
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar");
      setLoading(false);
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={entrar}>
        <div className="brand" style={{ marginBottom: 18 }}>
          <BrandMark size={34} />
          Pré-análise GMN
        </div>
        <label className="field">
          Senha de acesso
          <input type="password" autoComplete="current-password" autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        <button style={{ marginTop: 14, width: "100%" }} disabled={loading || !senha}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
        {error && <div className="error">{error}</div>}
      </form>
    </main>
  );
}
