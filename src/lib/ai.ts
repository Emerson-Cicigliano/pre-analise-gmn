import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { AppError } from "./http";
import type { FullReview, ReviewAnalysis } from "./types";

const MODEL = "claude-opus-5-5";
// Se o modelo principal recusar, a própria API refaz o pedido num modelo alternativo.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

export const hasClaude = () => !!process.env.ANTHROPIC_API_KEY;

function client() {
  if (!hasClaude()) throw new AppError("Chave do Claude não configurada (ANTHROPIC_API_KEY).", 400);
  return new Anthropic();
}

function formatReview(r: FullReview) {
  const date = r.publishTime ? r.publishTime.slice(0, 10) : "sem data";
  const reply = r.ownerAnswer ? " | respondida" : " | sem resposta";
  return `[${r.rating}★ | ${date}${reply}] ${r.text.replace(/\s+/g, " ").trim() || "(sem texto)"}`;
}

const ReviewAnalysisSchema = z.object({
  sentimentoGeral: z.enum(["positivo", "misto", "negativo"]),
  resumo: z.string(),
  pontosFortes: z.array(z.object({ tema: z.string(), mencoes: z.number().int(), exemplo: z.string() })),
  pontosFracos: z.array(z.object({ tema: z.string(), mencoes: z.number().int(), exemplo: z.string() })),
  palavrasChave: z.array(z.string()),
  sugestoes: z.array(z.string()),
});

// Cobre quase todos os perfis; ~60 mil tokens de entrada no limite.
const MAX_REVIEWS_FOR_ANALYSIS = 1000;

export async function analyzeReviews(business: { name: string; category: string | null }, reviews: FullReview[]): Promise<ReviewAnalysis> {
  const sample = reviews.filter((r) => r.text.trim()).slice(0, MAX_REVIEWS_FOR_ANALYSIS);
  if (!sample.length) throw new AppError("Não há avaliações com texto para analisar", 400);

  const res = await client().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "medium", format: betaZodOutputFormat(ReviewAnalysisSchema) },
    system:
      "Você é um consultor de SEO local e reputação no Google. Analisa avaliações de clientes de um negócio e " +
      "entrega um diagnóstico objetivo em português do Brasil, útil para o dono do negócio e para a agência que o atende.",
    messages: [
      {
        role: "user",
        content:
          `Negócio: ${business.name}${business.category ? ` (${business.category})` : ""}\n` +
          `Avaliações (${sample.length}, mais recentes primeiro):\n${sample.map(formatReview).join("\n")}\n\n` +
          "Identifique os temas elogiados e criticados com a contagem aproximada de menções e um trecho curto de exemplo, " +
          "as palavras que os clientes mais usam para descrever o negócio (úteis como palavras-chave no perfil) e de 3 a 6 " +
          "sugestões práticas, priorizadas, para melhorar a reputação e o ranqueamento local.",
      },
    ],
  });

  if (res.stop_reason === "refusal") throw new AppError("O modelo recusou analisar estas avaliações", 422);
  if (!res.parsed_output) throw new AppError("Não foi possível interpretar a análise gerada", 502);
  return res.parsed_output;
}

export async function draftReply(
  business: { name: string; category: string | null },
  review: FullReview,
  opts: { tone: string; signature: string },
): Promise<string> {
  const res = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    ...FALLBACK,
    output_config: { effort: "low" },
    system:
      "Você escreve respostas do proprietário para avaliações no Google, em português do Brasil. Regras: responda ao que o " +
      "cliente disse de forma específica; nada de frases genéricas copiadas; em avaliações negativas, reconheça o problema " +
      "sem discutir, peça desculpas quando couber e convide para resolver por um canal privado; nunca prometa descontos " +
      "nem invente fatos; não afirme ações que o negócio não confirmou (como 'já repassamos à equipe' ou 'já corrigimos'), " +
      "prefira intenções ('vamos verificar'); no máximo 4 frases; mencione de forma natural o tipo de serviço quando fizer sentido. " +
      "Devolva só o texto da resposta, sem aspas nem comentários.",
    messages: [
      {
        role: "user",
        content:
          `Negócio: ${business.name}${business.category ? ` (${business.category})` : ""}\n` +
          `Tom desejado: ${opts.tone}\n` +
          (opts.signature ? `Assinatura ao final: ${opts.signature}\n` : "") +
          `Avaliação de ${review.author} (${review.rating} estrelas): ${review.text || "(sem texto, só a nota)"}`,
      },
    ],
  });

  if (res.stop_reason === "refusal") throw new AppError("O modelo recusou responder esta avaliação", 422);
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new AppError("Resposta vazia do modelo", 502);
  return text;
}
