"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { getJson } from "@/lib/fetcher";
import type { PlaceAnalysis } from "@/lib/types";

// Os dois primeiros seguem a paleta da agência; os demais servem para usar a cor do cliente.
const THEMES = [
  { name: "Preto e dourado", bg: "#1a1a1a", fg: "#e5e0d8", stars: "#c5b358" },
  { name: "Dourado", bg: "#c5b358", fg: "#1a1a1a", stars: "#1a1a1a" },
  { name: "Azul", bg: "#1f4fd1", fg: "#ffffff", stars: "#fcd34d" },
  { name: "Verde", bg: "#2f6b3a", fg: "#ffffff", stars: "#fcd34d" },
  { name: "Vinho", bg: "#7a1f2b", fg: "#ffffff", stars: "#fcd34d" },
];

export default function CardPage() {
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("Gostou do atendimento?");
  const [message, setMessage] = useState("Sua avaliação no Google ajuda muito o nosso trabalho. Leva menos de 1 minuto!");
  const [theme, setTheme] = useState(THEMES[0]);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Link oficial do Google que abre direto a janela de avaliação do perfil.
  const reviewUrl = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(id)}`;

  useEffect(() => {
    getJson<PlaceAnalysis>(`/api/place/${id}`)
      .then((d) => setName(d.place.name))
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    QRCode.toDataURL(reviewUrl, { width: 640, margin: 1, color: { dark: "#111111", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [reviewUrl]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reviewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sem permissão: o link continua visível para copiar à mão */
    }
  }

  return (
    <>
      <div className="no-print">
        <p>
          <Link href={`/analise/${id}`}>← Voltar para a análise</Link>
        </p>
        <h1>Card de avaliação</h1>
        <p className="sub">Imprima e deixe no balcão, ou envie o link pelo WhatsApp depois do atendimento.</p>
        {error && <div className="error">{error}</div>}

        <section className="card">
          <div className="grid2">
            <label className="field">
              Nome exibido
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              Título
              <input value={headline} onChange={(e) => setHeadline(e.target.value)} />
            </label>
          </div>
          <label className="field" style={{ marginTop: 10 }}>
            Mensagem
            <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
            <span className="small">Cores:</span>
            {THEMES.map((t) => (
              <button
                key={t.name}
                type="button"
                title={t.name}
                aria-label={`Tema ${t.name}`}
                aria-pressed={theme.name === t.name}
                onClick={() => setTheme(t)}
                style={{
                  background: t.bg,
                  border: `3px solid ${t.stars}`,
                  width: 32,
                  height: 32,
                  padding: 0,
                  borderRadius: "50%",
                  outline: theme.name === t.name ? "2px solid var(--ink)" : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
          <div className="row" style={{ marginTop: 14, alignItems: "center" }}>
            <input readOnly value={reviewUrl} style={{ flex: 1, minWidth: 240 }} onFocus={(e) => e.target.select()} />
            <button className="btn-ghost" onClick={copy}>
              {copied ? "Copiado!" : "Copiar link"}
            </button>
            <button onClick={() => window.print()}>Imprimir card</button>
          </div>
        </section>
      </div>

      <div
        className="review-card"
        style={{ ["--card" as string]: theme.bg, ["--card-fg" as string]: theme.fg, ["--card-stars" as string]: theme.stars }}
      >
        <div className="review-card-top">
          <div className="review-card-stars">★★★★★</div>
          <div className="review-card-headline">{headline}</div>
        </div>
        <div className="review-card-body">
          {qr ? <img src={qr} alt="QR code para avaliar no Google" /> : <div className="small">Gerando QR code...</div>}
          <p className="review-card-msg">{message}</p>
          <p className="review-card-cta">Aponte a câmera do celular para o código</p>
          <p className="review-card-name">{name}</p>
        </div>
      </div>

      <style>{`
        .review-card { width: 360px; margin: 8px auto 40px; border-radius: 18px; overflow: hidden; background: #f7f4ef;
          border: 1px solid var(--line); box-shadow: 0 6px 24px rgba(0,0,0,.08); text-align: center; color: #1a1a1a; }
        .review-card-top { background: var(--card); color: var(--card-fg); padding: 22px 20px 18px; }
        .review-card-stars { font-size: 26px; letter-spacing: 4px; color: var(--card-stars); }
        .review-card-headline { font: 700 24px/1.15 var(--display); margin-top: 4px; }
        .review-card-body { padding: 20px 24px 24px; }
        .review-card-body img { width: 220px; height: 220px; }
        .review-card-msg { font-size: 15px; margin: 12px 0 6px; }
        .review-card-cta { font-size: 12px; color: #57524a; margin: 0; }
        .review-card-name { font: 700 17px var(--display); margin: 14px 0 0; padding-top: 12px; border-top: 2px solid #c5b358; }
        @media print {
          .review-card { box-shadow: none; margin: 0 auto; border: 1px solid #ccc; }
        }
      `}</style>
    </>
  );
}
